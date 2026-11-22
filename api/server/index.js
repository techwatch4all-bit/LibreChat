require('../config/credentials');

const telemetry = require('./telemetry');
const fs = require('fs');
const path = require('path');
require('module-alias')({ base: path.resolve(__dirname, '..') });
const cors = require('cors');
const axios = require('axios');
const express = require('express');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const passport = require('passport');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const { logger, runAsSystem } = require('@librechat/data-schemas');
const {
  isEnabled,
  issueCsp,
  apiNotFound,
  createMetrics,
  applyCspNonce,
  createCspPolicy,
  shellCacheHeaders,
  escapeHtmlAttribute,
  ErrorController,
  memoryDiagnostics,
  createSecurityHeaders,
  performStartupChecks,
  handleJsonParseError,
  GenerationJobManager,
  QUERY_DEVTOOLS_HEADER,
  createStreamServices,
  agentStartupIngressMiddleware,
  agentStartupTelemetryMiddleware,
  initializeFileStorage,
  initializeDeploymentSkills,
  initializeDeploymentPlugins,
  getDeploymentPluginSkills,
  getDeploymentPluginHookCapabilities,
  registerDeploymentPluginHooks,
  hasDeploymentPluginHooks,
  hasDeploymentPluginToolApprovalHooks,
  setPluginHookSource,
  loadToolApprovalHooks,
  maybeInjectQueryDevtoolsBootstrap,
  injectConfiguredFooterBootstrap,
  preAuthTenantMiddleware,
  requestContextMiddleware,
  registerShutdownTask,
  getRemainingShutdownMs,
  registerBackgroundTaskShutdown,
  configureServerTimeouts,
  setupGracefulShutdown,
  updateInterfacePermissions,
  configureMessageFilterRegexValidator,
  configureFileConfigRegexEngine,
  configureAgentEventRuntime,
  createAgentEventTerminalHandler,
  createScheduleWriteGate,
  startCodeEnvironmentLifecycleReconciler,
  waitForKeyvRedisClient,
  warnOnUnreachableDeliveryPaths,
  createCodeApiUploadRegistry,
  createOpenCodePtyUpgradeHandler,
  deadManLeaseGuard,
  createStaticPreviewRelayMiddleware,
} = require('@librechat/api');
const { connectDb, indexSync } = require('~/db');
const {
  updateAccessPermissions,
  sweepOrphanedPreviews,
  getRoleByName,
  seedDatabase,
} = require('~/models');
const initializeOAuthReconnectManager = require('./services/initializeOAuthReconnectManager');
const { capabilityContextMiddleware } = require('./middleware/roles/capabilities');
const createValidateImageRequest = require('./middleware/validateImageRequest');
const { initializeGitHubSkillSync } = require('./services/Skills/sync');
const { initializeAgentTriggerService } = require('./services/Agents/triggers');
const { resumeAgentEventDetachedAction } = require('./services/Agents/detachedActionResume');
const { initializeScheduleEngine, recordExpiredScheduleApproval } = require('./services/Schedules');
const { jwtLogin, ldapLogin, passportLogin } = require('~/strategies');
const { startExpiredFileSweep } = require('./services/Files/process');
const { checkMigrations } = require('./services/start/migration');
const optionalJwtAuth = require('./middleware/optionalJwtAuth');
const initializeMCPs = require('./services/initializeMCPs');
const { configureSubagentTaskRouting } = require('./services/Endpoints/agents/subagentThreadStore');
const configureSocialLogins = require('./socialLogins');
const createSpaFallback = require('./utils/fallback');
const { getAppConfig } = require('./services/Config');
const staticCache = require('./utils/staticCache');
const noIndex = require('./middleware/noIndex');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const agentEventMethods = require('~/models');

/** Route admin file-config MIME patterns through a linear-time engine (ReDoS-safe) on upload. */
configureFileConfigRegexEngine();

/** Reject messageFilter PII patterns the RE2 runtime engine cannot compile, at config load. */
configureMessageFilterRegexValidator();

const { PORT, HOST, ALLOW_SOCIAL_LOGIN, DISABLE_COMPRESSION, TRUST_PROXY } = process.env ?? {};

// Allow PORT=0 to be used for automatic free port assignment
// HARD INVARIANT: LibreChat production ingress is permanently pinned to port 3080.
// Any stale environment variable (e.g. PORT=5274) from parent shells or legacy pins must NEVER divert LibreChat off 3080.
const resolvedPort = Number(PORT);
const port =
  !isNaN(resolvedPort) && (resolvedPort === 3080 || resolvedPort === 0) ? resolvedPort : 3080;
if (!isNaN(resolvedPort) && resolvedPort !== 3080 && resolvedPort !== 0) {
  logger.warn(
    `[PORT-GUARD] Disregarding invalid/stale PORT=${resolvedPort}. Enforcing production port 3080.`,
  );
}
const host = HOST || 'localhost';
const trusted_proxy = Number(TRUST_PROXY) || 1; /* trust first proxy by default */

const app = express();
app.locals.codeApiUploadRegistry = createCodeApiUploadRegistry();
let serverReady = false;
/** @type {import('@librechat/api').ScheduleEngineState} */
let scheduleEngineState = 'starting';

const SERVER_NOT_READY_CODE = 'SERVER_NOT_READY';
const CHAT_START_RETRY_AFTER_SECONDS = '1';

const rejectChatStartsUntilReady = (req, res, next) => {
  if (serverReady || req.method !== 'POST' || req.path === '/abort') {
    return next();
  }

  res.set('Retry-After', CHAT_START_RETRY_AFTER_SECONDS);
  return res.status(503).json({
    code: SERVER_NOT_READY_CODE,
    error: 'Server is still starting. Please retry shortly.',
  });
};

const rejectScheduleWritesUntilReady = createScheduleWriteGate({
  getState: () => scheduleEngineState,
  retryAfterSeconds: CHAT_START_RETRY_AFTER_SECONDS,
});

const configureGenerationStreams = () => {
  const streamServices = createStreamServices();
  GenerationJobManager.configure({
    ...streamServices,
    cleanupOnComplete: !isEnabled(process.env.STREAM_KEEP_COMPLETED_JOBS),
  });
  GenerationJobManager.setApprovalExpiredHandler(recordExpiredScheduleApproval);
  GenerationJobManager.setTerminalHostActionHandler(
    createAgentEventTerminalHandler(agentEventMethods, {
      resumeDetachedAction: resumeAgentEventDetachedAction,
    }),
  );
  GenerationJobManager.initialize();
  // Stop active generations and close their SSE streams while the HTTP server drains.
  registerShutdownTask(
    'generation job manager prepare',
    () => GenerationJobManager.prepareForShutdown(),
    {
      phase: 'pre-drain',
      priority: 100,
    },
  );
  /** Spend the shutdown budget that is actually left waiting for detached generations to
   *  record their own provider drains, holding back a reserve for the tasks after this one.
   *  Abandoning an unrecorded drain fences the next generation permanently. */
  const destroyGenerationJobManager = () => {
    const remaining = getRemainingShutdownMs();
    return GenerationJobManager.destroy(
      remaining == null
        ? undefined
        : { settlementBudgetMs: Math.max(0, remaining - SHUTDOWN_TEARDOWN_RESERVE_MS) },
    );
  };
  // Tear down stream resources before shared caches and telemetry exporters shut down.
  registerShutdownTask('generation job manager', destroyGenerationJobManager, { priority: 100 });
};

/** Reserved for the shutdown tasks that run after the generation job manager. */
const SHUTDOWN_TEARDOWN_RESERVE_MS = 10_000;

const startServer = async () => {
  await waitForKeyvRedisClient();
  await configureSubagentTaskRouting();
  const { metricsMiddleware, metricsRouter } = createMetrics({
    collectAgentEventActorStorageMetrics: () =>
      runAsSystem(async () => {
        const now = new Date();
        const [receiptMetrics, reconciliationMetrics] = await Promise.all([
          agentEventMethods.getAgentEventActorReceiptStorageMetrics(now),
          agentEventMethods.getAgentEventActorReconciliationStorageMetrics(now),
        ]);
        return {
          ...receiptMetrics,
          pendingReconciliations: reconciliationMetrics.pending,
          oldestPendingAgeSeconds: reconciliationMetrics.oldestPendingAgeSeconds,
        };
      }),
  });
  if (!process.env.METRICS_SECRET) {
    logger.warn('[metrics] METRICS_SECRET is not set - /metrics will return 401 for all requests');
  }

  if (typeof Bun !== 'undefined') {
    axios.defaults.headers.common['Accept-Encoding'] = 'gzip';
  }
  await connectDb();

  logger.info('Connected to MongoDB');
  startCodeEnvironmentLifecycleReconciler({ mongoose });
  indexSync().catch((err) => {
    logger.error('[indexSync] Background sync failed:', err);
  });

  app.disable('x-powered-by');
  app.set('trust proxy', trusted_proxy);

  /* Registered ahead of every route so health checks carry the headers too. */
  const securityHeaders = createSecurityHeaders();
  if (securityHeaders) {
    app.use(securityHeaders);
  }

  if (isEnabled(process.env.TRUST_TENANT_HEADER)) {
    logger.warn(
      '[Security] TRUST_TENANT_HEADER is active. Ensure your reverse proxy strips and sets ' +
        'X-Tenant-Id — untrusted clients must not be able to supply it directly.',
    );
  } else if (isEnabled(process.env.TENANT_ISOLATION_STRICT)) {
    logger.warn(
      '[Security] TENANT_ISOLATION_STRICT is active while TRUST_TENANT_HEADER is disabled. ' +
        'Pre-authentication tenant headers will be ignored.',
    );
  }

  await runAsSystem(seedDatabase);
  /* Recover stuck `status: 'pending'` records from a crash mid-render.
   * `runAsSystem` is required — `File` is tenant-isolated and strict
   * mode rejects unscoped queries. Lazy sweep in the preview endpoint
   * covers anything younger than the boot cutoff. */
  runAsSystem(sweepOrphanedPreviews).catch((err) => {
    logger.error('[sweepOrphanedPreviews] Background sweep failed:', err);
  });
  const appConfig = await getAppConfig({ baseOnly: true });
  registerBackgroundTaskShutdown({
    interruptGraceMs: appConfig?.endpoints?.agents?.backgroundTasks?.shutdownInterruptGraceMs,
  });
  configureAgentEventRuntime(appConfig?.endpoints?.agents?.eventDriven);
  warnOnUnreachableDeliveryPaths(appConfig);
  initializeFileStorage(appConfig);
  const projectRoot = path.resolve(__dirname, '../..');
  // Plugin hooks execute only when the operator opts in via DEPLOYMENT_PLUGIN_HOOKS;
  // without it, declared hook documents load as parsed-but-inert with a warning.
  await initializeDeploymentPlugins({
    projectRoot,
    hookCapabilities: getDeploymentPluginHookCapabilities(),
  });
  // Hand the run seam its plugin-hook source without a packages/api-internal
  // agents -> plugins import (see agents/hooks/source.ts).
  setPluginHookSource({
    hasHooks: hasDeploymentPluginHooks,
    hasToolApprovalHooks: hasDeploymentPluginToolApprovalHooks,
    register: registerDeploymentPluginHooks,
  });
  await initializeDeploymentSkills({
    projectRoot,
    additionalSkills: getDeploymentPluginSkills(),
  });
  initializeGitHubSkillSync(appConfig);
  startExpiredFileSweep({ appConfig, loadAppConfig: getAppConfig });
  // Register any programmatic tool-approval policy hooks declared in
  // `endpoints.agents.toolApproval.hooks`. Honor the `enabled` kill switch: when tool
  // approval is off we pass no hooks, so a disabled endpoint imports/runs nothing (and any
  // previously loaded batch is unregistered). Hooks are read from the BASE config only —
  // they register once, process-wide; per-user/tenant differences belong inside the hook
  // (via its context), not in per-override module lists.
  const toolApproval = appConfig?.endpoints?.agents?.toolApproval;
  await loadToolApprovalHooks(toolApproval?.enabled ? toolApproval.hooks : undefined, {
    basePath: path.resolve(__dirname, '../..'),
  });
  await runAsSystem(async () => {
    await performStartupChecks(appConfig);
    await updateInterfacePermissions({ appConfig, getRoleByName, updateAccessPermissions });
  });

  /* Route modules build their rate limiters as they load, so they load only after the
   * startup checks have applied `rateLimits` from librechat.yaml. */
  const routes = require('./routes');

  const indexPath = path.join(appConfig.paths.dist, 'index.html');

  // The SPA shell is served from memory for every request, but the on-disk
  // `client/dist/index.html` changes whenever the client is rebuilt. Cache the
  // parsed base href once; re-read the shell only when the file's mtime moves so
  // a freshly rebuilt client is picked up without a server restart. If a re-read
  // fails (the dist file is mid-replace), fall back to the last good shell
  // instead of returning a 500 to every visitor mid-deploy.
  const baseHref = (() => {
    if (!process.env.DOMAIN_CLIENT) {
      return null;
    }
    const clientUrl = new URL(process.env.DOMAIN_CLIENT);
    const base = clientUrl.pathname.endsWith('/') ? clientUrl.pathname : `${clientUrl.pathname}/`;
    if (base === '/') {
      return null;
    }
    logger.info(`Setting base href to ${base}`);
    return base;
  })();

  let indexHTML = '';
  let indexMtime = -1;
  const renderIndexHtml = () => {
    let mtime = indexMtime;
    try {
      mtime = fs.statSync(indexPath).mtimeMs;
    } catch {
      /* dist not present yet / briefly gone; keep whatever we last have */
    }
    if (indexHTML && mtime === indexMtime) {
      return indexHTML;
    }
    try {
      const fresh = fs.readFileSync(indexPath, 'utf8');
      const withBase = baseHref
        ? fresh.replace(/base href="\/"/, `base href="${baseHref}"`)
        : fresh;
      /* The composer lays out against whether a footer bar sits beneath it, and
       * `/api/config` answers that only after it has painted. One shell serves
       * every request, before there is a caller whose overrides could be
       * resolved, so the answer is the deployment's base configuration;
       * `/api/config` resolves the caller's and the client prefers it. */
      indexHTML = injectConfiguredFooterBootstrap(withBase, {
        customFooter: process.env.CUSTOM_FOOTER,
        interfaceConfig: appConfig?.interfaceConfig,
      });
      indexMtime = mtime;
    } catch (err) {
      logger.error(`[indexHtml] failed to re-read shell, serving cached copy: ${err.message}`);
    }
    return indexHTML;
  };

  const cspPolicy = createCspPolicy();
  const shellCache = shellCacheHeaders(cspPolicy != null);

  const sendIndexHtml = (req, res) => {
    res.set(shellCache);
    res.vary(QUERY_DEVTOOLS_HEADER);

    const lang = req.cookies.lang || req.headers['accept-language']?.split(',')[0] || 'en-US';
    const saneLang = escapeHtmlAttribute(lang);
    let updatedIndexHtml = renderIndexHtml().replace(/lang="en-US"/g, () => `lang="${saneLang}"`);
    updatedIndexHtml = maybeInjectQueryDevtoolsBootstrap(updatedIndexHtml, req);

    /* Nonce last: every injected script above must be stamped too. */
    if (cspPolicy) {
      const csp = issueCsp(cspPolicy);
      res.set(csp.headerName, csp.headerValue);
      updatedIndexHtml = applyCspNonce(updatedIndexHtml, csp.nonce);
    }

    res.type('html');
    res.send(updatedIndexHtml);
  };

  app.get('/health', (_req, res) => res.status(200).send('OK'));
  app.get('/livez', (_req, res) => res.status(200).send('OK'));
  app.get('/readyz', (_req, res) => {
    if (!serverReady) {
      return res.status(503).send('NOT_READY');
    }
    return res.status(200).send('OK');
  });

  /* Middleware */
  app.use(requestContextMiddleware);
  app.use('/api/agents/chat', agentStartupIngressMiddleware);
  app.use(metricsMiddleware);
  app.use(noIndex);
  app.use(express.json({ limit: '3mb' }));
  app.use(express.urlencoded({ extended: true, limit: '3mb' }));
  app.use(handleJsonParseError);

  /**
   * Express 5 Compatibility: Make req.query writable for mongoSanitize
   * In Express 5, req.query is read-only by default, but express-mongo-sanitize needs to modify it
   */
  app.use((req, _res, next) => {
    Object.defineProperty(req, 'query', {
      ...Object.getOwnPropertyDescriptor(req, 'query'),
      value: req.query,
      writable: true,
    });
    next();
  });

  app.use(mongoSanitize());
  app.use(cors());
  app.use(cookieParser());

  if (!isEnabled(DISABLE_COMPRESSION)) {
    app.use(compression());
  } else {
    console.warn('Response compression has been disabled via DISABLE_COMPRESSION.');
  }

  app.get('/index.html', sendIndexHtml);
  if (process.env.SANDPACK_STATIC_BUNDLER_URL) {
    /** Serves the vendored sandpack static-preview relay for wildcard session
     * hosts (<sessionId>-<base>) when the deployment self-hosts the static
     * preview (SANDPACK_STATIC_BUNDLER_URL pointed at this app's own origin). */
    app.use(
      createStaticPreviewRelayMiddleware({
        assets: appConfig.paths.assets,
        sessionBaseHost: new URL(process.env.SANDPACK_STATIC_BUNDLER_URL).hostname,
      }),
    );
  }
  app.use('/assets/vendor', (_req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  });
  /* Artifact iframes are sandboxed WITHOUT allow-same-origin (opaque origin), so ES-module
   * imports of the vendored Axonometra engine need CORS; classic script tags do not. These
   * bundles are public MIT assets, so a wildcard allow-origin discloses nothing. */
  app.use('/assets/vendor/axonometra', (_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  });
  // OpenFilm Studio static assets (CanvasView, index chunks, CSS)
  const openfilmStudioUiAssets =
    'C:\\Users\\WinDiesel\\AppData\\Local\\npm-cache\\_npx\\ab5ca1f87d8cabd8\\node_modules\\openfilm\\studio\\ui\\dist\\assets';
  if (fs.existsSync(openfilmStudioUiAssets)) {
    app.use(
      '/assets',
      (req, res, next) => {
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Cross-Origin-Opener-Policy');
        res.removeHeader('Cross-Origin-Embedder-Policy');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Access-Control-Allow-Origin', '*');
        next();
      },
      express.static(openfilmStudioUiAssets, { maxAge: '1y', immutable: true }),
    );
  }
  // Invalidate 304 cache on OpenFilm Studio assets
  app.use('/assets/index-hCOubUll.js', (req, res, next) => {
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Cross-Origin-Opener-Policy');
    res.removeHeader('Cross-Origin-Embedder-Policy');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  // OpenFilm Studio projects route handler (serve Studio HTML directly with session cookie),
  // excluding LibreChat's own /projects and /projects/<24-hex ObjectId> SPA routes unless explicitly from Studio.
  app.use((req, res, next) => {
    if (req.method === 'GET' && (req.path === '/projects' || req.path.startsWith('/projects/'))) {
      const referer = req.headers['referer'] || '';
      const runInfo = routes.openfilm?.getStudioRunInfo?.();
      const expectedKey = runInfo?.key;
      const isStudioReq =
        referer.includes('/api/openfilm/') ||
        Boolean(req.query?.key || req.headers['x-studio-key']) ||
        Boolean(expectedKey && referer.includes(`key=${expectedKey}`));
      const isLibreChatProjectSpaRoute =
        req.path === '/projects' ||
        req.path === '/projects/' ||
        /^\/projects\/[0-9a-f]{24}\/?$/i.test(req.path);
      if (isLibreChatProjectSpaRoute && !isStudioReq) {
        return next();
      }
      const studioKey = req.query?.key || expectedKey;
      if (studioKey) {
        res.cookie('openfilm_studio_4747', studioKey, {
          path: '/',
          httpOnly: false,
          sameSite: 'lax',
          secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
        });
        res.cookie('openfilm_studio_4747_framed', studioKey, {
          path: '/',
          httpOnly: false,
          sameSite: 'none',
          secure: true,
        });
      }
      res.removeHeader('X-Frame-Options');
      res.removeHeader('Cross-Origin-Opener-Policy');
      res.removeHeader('Cross-Origin-Embedder-Policy');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
      if (
        fs.existsSync(
          'C:\\Users\\WinDiesel\\AppData\\Local\\npm-cache\\_npx\\ab5ca1f87d8cabd8\\node_modules\\openfilm\\studio\\ui\\dist\\index.html',
        )
      ) {
        return res.sendFile(
          'C:\\Users\\WinDiesel\\AppData\\Local\\npm-cache\\_npx\\ab5ca1f87d8cabd8\\node_modules\\openfilm\\studio\\ui\\dist\\index.html',
        );
      }
    }
    next();
  });
  app.use(staticCache(appConfig.paths.dist));
  app.use(staticCache(appConfig.paths.fonts));
  app.use('/assets', staticCache(appConfig.paths.assets));
  app.use(staticCache(appConfig.paths.assets));

  if (telemetry.enabled) {
    app.use(telemetry.telemetryMiddleware);
  }
  app.use('/api/agents/chat', agentStartupTelemetryMiddleware);

  if (!ALLOW_SOCIAL_LOGIN) {
    console.warn('Social logins are disabled. Set ALLOW_SOCIAL_LOGIN=true to enable them.');
  }

  /* OAUTH */
  app.use(passport.initialize());
  passport.use(jwtLogin());
  passport.use(passportLogin());

  /* LDAP Auth */
  if (process.env.LDAP_URL && process.env.LDAP_USER_SEARCH_BASE) {
    passport.use(ldapLogin);
  }

  if (isEnabled(ALLOW_SOCIAL_LOGIN)) {
    await configureSocialLogins(app, appConfig);
  }

  /* Per-request capability cache — must be registered before any route that calls hasCapability */
  app.use(capabilityContextMiddleware);

  /* Pre-auth tenant context for unauthenticated routes that need tenant scoping.
   * The reverse proxy / auth gateway sets `X-Tenant-Id` header for multi-tenant deployments. */
  app.use('/oauth', preAuthTenantMiddleware, routes.oauth);

  /* Dead-man cryptographic lease & anti-clock-tampering guard */
  app.use(deadManLeaseGuard);

  /* Remote Cryptographic License & Lease Update Directives (from One-API HQ) */
  app.post('/api/admin/license/update', optionalJwtAuth, (req, res) => {
    try {
      const { license } = req.body || {};
      if (!license || typeof license !== 'string') {
        return res.status(400).json({ error: 'License token is required' });
      }
      const isAdmin = req.user && String(req.user.role || '').toUpperCase() === 'ADMIN';
      const hmacSecret = process.env.SATCHIDA_HQ_HMAC_SECRET || process.env.SATCHIDA_CLIENT_SECRET;
      const incomingSig = req.headers['x-satchida-hq-signature'];
      let hasValidHmac = false;
      if (hmacSecret && typeof incomingSig === 'string' && incomingSig.length > 0) {
        const crypto = require('crypto');
        const expected = crypto.createHmac('sha256', hmacSecret).update(license).digest('hex');
        const a = Buffer.from(incomingSig, 'utf8');
        const b = Buffer.from(expected, 'utf8');
        hasValidHmac = a.length === b.length && crypto.timingSafeEqual(a, b);
      }
      const isLoopback =
        req.ip === '127.0.0.1' ||
        req.ip === '::1' ||
        req.ip === '::ffff:127.0.0.1';
      if (!isAdmin && !hasValidHmac && !(isLoopback && !hmacSecret)) {
        return res.status(403).json({ error: 'Admin or HQ cryptographic authorization required' });
      }
      const { updateNodeLicense } = require('@librechat/api');
      const result = updateNodeLicense(license);
      if (!result.success) {
        return res.status(400).json({ error: result.error || 'Failed to update license' });
      }
      return res.status(200).json({
        success: true,
        message: 'Cryptographic license lease verified, activated and un-locked.',
        data: result.payload,
      });
    } catch (err) {
      return res.status(500).json({ error: 'License update failed' });
    }
  });

  /* Remote Signed Delta Release Push & Verification (triggered from One-API HQ) */
  app.post('/api/admin/release/apply', optionalJwtAuth, (req, res) => {
    try {
      const isAdmin = req.user && String(req.user.role || '').toUpperCase() === 'ADMIN';
      const hmacSecret = process.env.SATCHIDA_HQ_HMAC_SECRET || process.env.SATCHIDA_CLIENT_SECRET;
      const isLoopback =
        req.ip === '127.0.0.1' ||
        req.ip === '::1' ||
        req.ip === '::ffff:127.0.0.1';
      if (!isAdmin && !(isLoopback && !hmacSecret)) {
        return res.status(403).json({ error: 'Admin or HQ authorization required' });
      }
      const { execFileSync } = require('child_process');
      const updaterPath = path.resolve(__dirname, '..', '..', 'scripts', 'satchida-updater.mjs');
      const gatewayOverride =
        typeof req.body?.gatewayUrl === 'string' && req.body.gatewayUrl.trim().length > 0
          ? req.body.gatewayUrl.trim()
          : process.env.SATCHIDA_GATEWAY_URL || 'http://127.0.0.1:4000';
      const rawOut = execFileSync(process.execPath, [updaterPath, '--json'], {
        cwd: path.resolve(__dirname, '..', '..'),
        encoding: 'utf8',
        timeout: 60000,
        windowsHide: true,
        env: { ...process.env, SATCHIDA_GATEWAY_URL: gatewayOverride },
      }).trim();
      const parsed = JSON.parse(rawOut);
      return res.status(200).json({
        success: true,
        verified: Boolean(parsed.verified),
        version: parsed.version,
        appliedFiles: parsed.appliedFiles ?? 0,
        message: parsed.message || 'Release update applied and verified.',
      });
    } catch (err) {
      logger.error('[ReleaseApply] Failed to apply pushed release:', err);
      return res.status(500).json({
        success: false,
        verified: false,
        error: 'Release update failed on tenant node',
      });
    }
  });

  /* API Endpoints */
  app.use('/api/auth', preAuthTenantMiddleware, routes.auth);
  app.use('/api/insights', routes.insights);
  app.use('/api/admin', routes.adminAuth);
  app.use('/api/admin/config', routes.adminConfig);
  app.use('/api/admin/code-environments', routes.adminCodeEnvironments);
  app.use('/api/code-environments', routes.codeEnvironments);
  app.use('/api/admin/langfuse', routes.adminLangfuse);
  app.use('/api/admin/grants', routes.adminGrants);
  app.use('/api/admin/groups', routes.adminGroups);
  app.use('/api/admin/roles', routes.adminRoles);
  app.use('/api/admin/skills', routes.adminSkills);
  app.use('/api/admin/users', routes.adminUsers);
  app.use('/api/admin/audit-log', routes.adminAuditLog);
  app.use('/api/admin/reconciliation', routes.adminReconciliation);
  app.use('/api/admin/entitlements', routes.adminEntitlements);
  app.use('/api/admin/vaults', routes.adminVaults);
  app.use('/api/admin/tenants', routes.adminTenants);
  app.use('/api/actions', routes.actions);
  app.use('/api/keys', routes.keys);
  app.use('/api/api-keys', routes.apiKeys);
  app.use('/api/user', routes.user);
  app.use('/api/search', routes.search);
  app.use('/api/messages', routes.messages);
  app.use('/api/convos', routes.convos);
  app.use('/api/traces', routes.traces);
  app.use('/api/presets', routes.presets);
  // Intercept OpenFilm Studio calls to /api/projects/:id before LibreChat's project router
  app.use((req, res, next) => {
    const p = req.originalUrl || req.url;
    const referer = req.headers['referer'] || '';
    const runInfo = routes.openfilm?.getStudioRunInfo?.();
    const studioKey = runInfo?.key;

    if (p.startsWith('/api/openfilm/project-sync')) {
      return next();
    }

    // LibreChat's own Chat Projects use 24-hex MongoDB ObjectIds; OpenFilm Studio uses short alphanumeric IDs
    // (e.g. PQhJ7O71SYVE) and may strip ?key= from the iframe URL after initial load.
    const isOpenFilmRefererPath =
      /\/projects\/(?!([0-9a-f]{24})(\/|\?|$))[A-Za-z0-9_-]{6,20}(\/|\?|$)/i.test(referer);
    const isStudioReferer =
      referer.includes('/api/openfilm/') ||
      isOpenFilmRefererPath ||
      Boolean(studioKey && referer.includes(`key=${studioKey}`));
    const isOpenFilmProjectIdPath =
      /^\/api\/projects\/(?!([0-9a-f]{24})(\/|$))[A-Za-z0-9_-]{6,20}(\/|$)/i.test(p);
    const isDirectOpenfilmApi = p.startsWith('/api/openfilm/');
    const isOpenfilmSpecificApi =
      p.startsWith('/api/version') ||
      p.startsWith('/api/prefs') ||
      p.startsWith('/api/examples') ||
      p.startsWith('/api/events') ||
      p.startsWith('/api/health') ||
      p.startsWith('/api/library') ||
      p.startsWith('/api/fonts') ||
      p.startsWith('/api/providers') ||
      p.startsWith('/api/local-models') ||
      p.startsWith('/api/desktop') ||
      p.startsWith('/api/saved/') ||
      p.startsWith('/api/pick-');

    const hasStudioKey = Boolean(
      studioKey && (req.query?.key === studioKey || req.headers['x-studio-key'] === studioKey),
    );

    // Route /api/projects to OpenFilm if it targets an OpenFilm short project ID, originated from OpenFilm Studio, or carries studio key
    const isOpenFilmProjectCall =
      p.startsWith('/api/projects') &&
      (isOpenFilmProjectIdPath || isStudioReferer || hasStudioKey);

    if (isDirectOpenfilmApi || isOpenfilmSpecificApi || isOpenFilmProjectCall) {
      return routes.openfilm.openfilmProxy(req, res, next);
    }
    next();
  });

  app.use('/api/projects', routes.projects);
  app.use('/api/opencode', routes.opencode);
  app.use('/api/ide', routes.ide.router);
  app.use('/api/openfilm', routes.openfilm.router);

  // Forward OpenFilm Studio /projects/* asset/API paths to OpenFilm proxy,
  // while letting LibreChat SPA routes (/projects and /projects/<24-hex ObjectId>)
  // fall through to index.html so browser reloads work cleanly.
  app.use('/projects', (req, res, next) => {
    const referer = req.headers['referer'] || '';
    const runInfo = routes.openfilm?.getStudioRunInfo?.();
    const studioKey = runInfo?.key;
    const isStudioReq =
      referer.includes('/api/openfilm/') ||
      Boolean(
        studioKey &&
          (req.query?.key === studioKey ||
            req.headers['x-studio-key'] === studioKey ||
            referer.includes(`key=${studioKey}`)),
      );
    const isLibreChatProjectSpaRoute =
      req.method === 'GET' && (req.path === '/' || /^\/[0-9a-f]{24}\/?$/i.test(req.path));
    if (isLibreChatProjectSpaRoute && !isStudioReq) {
      return next();
    }
    return routes.openfilm.openfilmProxy(req, res, next);
  });

  // Forward OpenFilm media server /p/* paths to openfilmMediaProxy (port 4748)
  app.use('/p', (req, res, next) => {
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Cross-Origin-Opener-Policy');
    res.removeHeader('Cross-Origin-Embedder-Policy');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return routes.openfilm.openfilmMediaProxy(req, res, next);
  });

  app.use('/api/prompts', routes.prompts);
  app.use('/api/skills', routes.skills);
  app.use('/api/categories', routes.categories);
  app.use('/api/endpoints', routes.endpoints);
  app.use('/api/balance', routes.balance);
  app.use('/api/models', routes.models);
  app.use('/api/config', preAuthTenantMiddleware, optionalJwtAuth, routes.config);
  app.use('/api/assistants', routes.assistants);
  app.use('/api/files', await routes.files.initialize());

  // Direct download route for AnythingLLM generated documents & presentations
  const generatedDocsPath = path.resolve(
    'D:\\LAN-AI-Infra\\AnythingLLM\\server\\storage\\documents\\generated',
  );
  if (fs.existsSync(generatedDocsPath)) {
    app.use(
      '/generated',
      express.static(generatedDocsPath, {
        setHeaders: (res, filePath) => {
          res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
        },
      }),
    );
  }

  // Teacher Voice Masterclass Explainer endpoint with Neural Indian English TTS
  const tempAudioDir = path.resolve('D:\\LAN-AI-Infra\\LibreChat\\client\\public\\temp_audio');
  if (!fs.existsSync(tempAudioDir)) {
    fs.mkdirSync(tempAudioDir, { recursive: true });
  }
  app.use('/temp_audio', express.static(tempAudioDir));

  // Motion and Video assets static route
  const motionDir = path.resolve('D:\\LAN-AI-Infra\\LibreChat\\client\\public\\motion');
  if (!fs.existsSync(motionDir)) {
    fs.mkdirSync(motionDir, { recursive: true });
  }
  app.use(
    '/motion',
    express.static(motionDir, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.mp4')) {
          res.setHeader('Content-Type', 'video/mp4');
        } else if (filePath.endsWith('.webm')) {
          res.setHeader('Content-Type', 'video/webm');
        } else if (filePath.endsWith('.mp3')) {
          res.setHeader('Content-Type', 'audio/mpeg');
        } else if (filePath.endsWith('.html')) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
        }
        res.setHeader('Access-Control-Allow-Origin', '*');
      },
    }),
  );

  // Authenticated and Privacy-Isolated /storage Static Route (tenant & user isolation)
  const storageRootDir = path.resolve('storage');
  if (!fs.existsSync(storageRootDir)) {
    fs.mkdirSync(storageRootDir, { recursive: true });
  }
  app.use('/storage', optionalJwtAuth, (req, res, next) => {
    // 1. Guard user privacy for /storage/users/:username/...
    const userMatch = req.path.match(/^\/users\/([^\/]+)/);
    if (userMatch) {
      const targetUser = decodeURIComponent(userMatch[1]);
      const currentUserName = (req.user && (req.user.name || req.user.username)) || '';
      const isOwner = currentUserName && (currentUserName === targetUser);
      const isAdmin = req.user && (req.user.role === 'ADMIN' || req.user.role === 'admin');

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Access denied to private user storage' });
      }
    }

    // 2. Serve static file with full byte-range streaming & proper MIME headers
    express.static(storageRootDir, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.mp4')) {
          res.setHeader('Content-Type', 'video/mp4');
        } else if (filePath.endsWith('.webm')) {
          res.setHeader('Content-Type', 'video/webm');
        } else if (filePath.endsWith('.mp3')) {
          res.setHeader('Content-Type', 'audio/mpeg');
        } else if (filePath.endsWith('.png')) {
          res.setHeader('Content-Type', 'image/png');
        } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
          res.setHeader('Content-Type', 'image/jpeg');
        } else if (filePath.endsWith('.pdf')) {
          res.setHeader('Content-Type', 'application/pdf');
        } else if (filePath.endsWith('.json')) {
          res.setHeader('Content-Type', 'application/json');
        }
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Access-Control-Allow-Origin', '*');
      },
    })(req, res, next);
  });

  // ComfyUI Studio reverse proxy (:8188)
  const { createProxyMiddleware } = require('http-proxy-middleware');
  const comfyProxy = createProxyMiddleware({
    target: 'http://127.0.0.1:8188',
    changeOrigin: true,
    // Upgraded explicitly in server.on('upgrade') below; ws:true would auto-hook globally.
    ws: false,
    pathRewrite: { '^/comfyui': '' },
    logLevel: 'silent',
    onError: (err, req, res) => {
      logger.error('[COMFY-PROXY-ERR]', err.message);
      if (!res.headersSent) {
        res.status(502).json({ error: 'ComfyUI studio offline' });
      }
    },
  });
  app.use('/comfyui', comfyProxy);

  // Serve template assets (thumbnails, demos) from client/public/templates
  const templatesDir = path.resolve(__dirname, '..', '..', 'client', 'public', 'templates');
  if (fs.existsSync(templatesDir)) {
    app.use('/templates', express.static(templatesDir));
  }

  // Studio Library page — the per-user gallery of every generated image and
  // video. Serve it from client/public ahead of the SPA fallback, which would
  // otherwise swallow this path and render the chat shell instead of the
  // library. The source of truth stays in client/public so client rebuilds
  // keep shipping it.
  app.get('/studio-library.html', (req, res, next) => {
    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' *;");
    const p = path.join(appConfig.paths.publicPath, 'studio-library.html');
    if (fs.existsSync(p)) {
      return res.sendFile(p);
    }
    next();
  });

  // Studio artifact home — stable directory OUTSIDE client/dist so client
  // rebuilds can never 404 a delivered creation. The montage server publishes
  // here and the Studio Library manifest lives alongside the artifacts.
  const inRepoGeneratedDir = path.resolve('storage', 'exports', 'generated');
  const externalGeneratedDir = path.resolve('D:\\LAN-AI-Infra\\Satchida-Studio\\exports\\generated');
  const studioGeneratedDir = fs.existsSync(inRepoGeneratedDir) ? inRepoGeneratedDir : externalGeneratedDir;
  if (!fs.existsSync(studioGeneratedDir)) {
    fs.mkdirSync(studioGeneratedDir, { recursive: true });
  }
  app.use(
    '/generated',
    express.static(studioGeneratedDir, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.mp4')) {
          res.setHeader('Content-Type', 'video/mp4');
        } else if (filePath.endsWith('.webm')) {
          res.setHeader('Content-Type', 'video/webm');
        } else if (filePath.endsWith('.png')) {
          res.setHeader('Content-Type', 'image/png');
        } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
          res.setHeader('Content-Type', 'image/jpeg');
        } else if (filePath.endsWith('.json')) {
          res.setHeader('Content-Type', 'application/json');
        }
        res.setHeader('Access-Control-Allow-Origin', '*');
      },
    }),
  );

  // Per-user Studio Library manifest (operator request, 2026-11-17).
  // Requires a signed-in session: media delivered in chat must be findable
  // later from the /studio-library.html page. Returns the same manifest the
  // static /generated/manifest.json exposes, but only for authenticated users.
  app.get('/api/studio/library', optionalJwtAuth, (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Sign in to view your Studio Library' });
    }
    try {
      const manifestPath = fs.existsSync(path.resolve('storage', 'exports', 'generated', 'manifest.json'))
        ? path.resolve('storage', 'exports', 'generated', 'manifest.json')
        : path.resolve('D:\\LAN-AI-Infra\\Satchida-Studio\\exports\\generated\\manifest.json');
      let entries = [];
      if (fs.existsSync(manifestPath)) {
        entries = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      }
      const owner = (req.user && (req.user.name || req.user.username)) || '';
      const scoped = entries.filter(
        (e) => !e.user || e.user === owner || e.user === 'shared' || e.user === 'template',
      );
      return res.json({ items: scoped, owner, total: entries.length });
    } catch (_err) {
      return res.status(500).json({ error: 'Library manifest unavailable' });
    }
  });

  app.post('/api/explain', express.json(), async (req, res) => {
    try {
      const { query = '', response = '', voice = 'female' } = req.body || {};
      const promptText = `You are a warm, engaging master tutor explaining a concept directly to a student.

Conversation Context:
User Prompt: "${query}"
Lesson Content:
${response.slice(0, 3000)}

RULES FOR YOUR SPOKEN EXPLANATION:
1. Identify the CORE EDUCATIONAL SUBJECT or CONCEPT being learned (e.g. Frequency Modulation vs Phase Modulation, Photosynthesis, Water Cycle, etc.).
2. NEVER say "You asked for a PowerPoint", "You asked for a slide", "You asked for a presentation", "You asked for a PDF", "You asked for a document", or mention filenames/downloads.
3. ALWAYS begin with: "You asked about [the core subject]..."
4. Explain the key intuitive concept or analogy in 2 to 3 simple, conversational, spoken sentences so the student truly understands the underlying topic.
5. Speak naturally like a real human teacher. No bullet points, no markdown, no emojis, no robotic jargon.`;

      const http = require('http');
      const gatewayKey =
        process.env.SATCHIDA_GATEWAY_VK || 'SPYfLW63OU6l04br13668aD230414eF2B2Ca38Ae8d35E9A7';
      const payload = JSON.stringify({
        model: 'Study',
        messages: [
          {
            role: 'system',
            content:
              'You are an inspiring master teacher who explains concepts simply and intuitively.',
          },
          { role: 'user', content: promptText },
        ],
        max_tokens: 180,
        temperature: 0.4,
      });

      const llmReq = http.request(
        {
          hostname: '127.0.0.1',
          port: 4000,
          path: '/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${gatewayKey}`,
            'X-Bifrost-Mode': 'study',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (llmRes) => {
          let body = '';
          llmRes.on('data', (chunk) => (body += chunk));
          llmRes.on('end', async () => {
            try {
              const parsed = JSON.parse(body);
              let speech = parsed.choices?.[0]?.message?.content?.trim() || '';

              // Clean up any stray quotes or markdown
              speech = speech.replace(/^["']|["']$/g, '').trim();

              // Select Neural Indian English Voice: Neerja (Female) or Prabhat (Male)
              const edgeVoice =
                voice === 'male' ? 'en-IN-PrabhatNeural' : 'en-IN-NeerjaExpressiveNeural';
              const tempAudioName = `tts_teacher_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`;
              const tempAudioPath = path.join(tempAudioDir, tempAudioName);

              // Synthesize high-quality Indian English voice via edge-tts helper
              const { spawn } = require('child_process');
              const pythonScript = path.resolve(
                'D:\\LAN-AI-Infra\\LibreChat\\skill\\edge_tts_service.py',
              );
              const pyProc = spawn('python', [pythonScript, edgeVoice, tempAudioPath, speech]);

              pyProc.on('close', (code) => {
                if (code === 0 && fs.existsSync(tempAudioPath)) {
                  res.json({
                    ok: true,
                    explanation: speech,
                    audioUrl: `/temp_audio/${tempAudioName}`,
                  });
                } else {
                  // Fallback to text explanation if edge-tts fails
                  res.json({ ok: true, explanation: speech, audioUrl: null });
                }
              });
            } catch (_e) {
              res.status(500).json({ ok: false, error: 'Failed to parse LLM response' });
            }
          });
        },
      );

      llmReq.on('error', (err) => {
        logger.error('Explain LLM request error:', err);
        res.status(500).json({ ok: false, error: err.message });
      });

      llmReq.setTimeout(25000, () => {
        llmReq.destroy();
        res.status(504).json({ ok: false, error: 'Explain LLM timeout' });
      });

      llmReq.write(payload);
      llmReq.end();
    } catch (err) {
      logger.error('TTS explain route error:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });
  app.use(
    '/images/',
    createValidateImageRequest({
      secureImageLinks: appConfig.secureImageLinks,
    }),
    routes.staticRoute,
  );
  app.use('/api/share', preAuthTenantMiddleware, routes.share);
  app.use('/api/roles', routes.roles);
  app.use('/api/agents/chat', rejectChatStartsUntilReady);
  app.use('/api/agents', routes.agents);
  app.use('/api/banner', routes.banner);
  app.use('/api/memories', routes.memories);
  app.use('/api/schedules', rejectScheduleWritesUntilReady, routes.schedules);
  app.use('/api/permissions', routes.accessPermissions);

  app.use('/api/tags', routes.tags);
  app.use('/api/mcp', routes.mcp);
  app.use('/api/rum', routes.rum);

  app.use('/metrics', metricsRouter);

  app.use('/api', routes.openapi);

  /** 404 for unmatched API routes */
  app.use('/api', apiNotFound);

  /** Admin panel (standalone static app mounted at /admin). Placed before the SPA
   *  fallback so /admin/* never resolves to the chat app's index.html. Real assets
   *  are served by the static mount; client-side routes (/admin, /admin/users, ...)
   *  fall through to the shell. No rebuild needed — plain `pm2 restart librechat`
   *  picks up file changes under <root>/admin. */
  const adminDistDir = path.join(__dirname, '../../admin');
  app.use('/admin', staticCache(adminDistDir), (req, res) =>
    res.sendFile(path.join(adminDistDir, 'index.html')),
  );

  /** SPA fallback - serve index.html for all unmatched routes */
  app.use(createSpaFallback(sendIndexHtml));

  /** Branded 404 fallback for any unmatched non-SPA browser request */
  app.use((req, res) => {
    const acceptsHtml =
      !req.path.startsWith('/api/') &&
      typeof req.headers.accept === 'string' &&
      req.headers.accept.includes('text/html');
    if (acceptsHtml) {
      const { renderBrandedNoticeHtml } = require('@librechat/api');
      return res
        .status(404)
        .setHeader('Content-Type', 'text/html; charset=utf-8')
        .send(
          renderBrandedNoticeHtml({
            badgeText: '404 • Page Not Found',
            badgeTone: 'warning',
            headline: 'Page Not Found',
            detail:
              'The page or resource you requested could not be found in this workspace. It may have been moved or removed.',
            actionHint:
              'Return to the main workspace or contact your <strong>Organization / Tenant Administrator</strong> if you need access.',
            showHomeButton: true,
          }),
        );
    }
    return res.status(404).json({
      error: 'The requested resource was not found.',
      message: 'Please check the address or contact your Organization / Tenant Administrator.',
    });
  });

  /** Record trace errors before the final error controller. */
  if (telemetry.enabled) {
    app.use(telemetry.telemetryErrorMiddleware);
  }
  /** Branded HTML 500 error notice for browser requests (API routes continue to ErrorController) */
  app.use((err, req, res, next) => {
    const acceptsHtml =
      !req.path.startsWith('/api/') &&
      typeof req.headers.accept === 'string' &&
      req.headers.accept.includes('text/html');
    if (acceptsHtml && !res.headersSent) {
      logger.error('[Satchida] Unhandled HTML route error:', err);
      const { renderBrandedNoticeHtml } = require('@librechat/api');
      return res
        .status(err?.status || err?.statusCode || 500)
        .setHeader('Content-Type', 'text/html; charset=utf-8')
        .send(
          renderBrandedNoticeHtml({
            badgeText: 'Service Notice',
            badgeTone: 'error',
            headline: 'Something Went Wrong',
            detail:
              'An unexpected error occurred while loading this page. Your projects and data remain safe.',
            actionHint:
              'Please refresh or contact your <strong>Organization / Tenant Administrator</strong> if this issue persists.',
            showHomeButton: true,
          }),
        );
    }
    return next(err);
  });
  /** Error handler (must be last - Express identifies error middleware by its 4-arg signature) */
  app.use(ErrorController);

  configureGenerationStreams();

  const server = app.listen(port, host, async (err) => {
    if (err) {
      logger.error('Failed to start server:', err);
      process.exit(1);
    }

    if (host === '0.0.0.0') {
      logger.info(
        `Server listening on all interfaces at port ${port}. Use http://localhost:${port} to access it`,
      );
    } else {
      logger.info(`Server listening at http://${host == '0.0.0.0' ? 'localhost' : host}:${port}`);
    }

    /**
     * The listen callback is async, so any rejection from these awaits would
     * otherwise be detached from `startServer().catch(...)` (which only
     * catches errors that happen before `app.listen`). Without explicit
     * handling, the global `unhandledRejection` handler would swallow init
     * failures and leave the server listening but only partially
     * initialized — passing liveness checks while serving broken requests.
     */
    try {
      await runAsSystem(async () => {
        await initializeMCPs();
        await initializeOAuthReconnectManager();
      });
      await checkMigrations();

      const inspectFlags = process.execArgv.some((arg) => arg.startsWith('--inspect'));
      if (inspectFlags || isEnabled(process.env.MEM_DIAG)) {
        memoryDiagnostics.start();
      }
      await initializeAgentTriggerService({
        address: server.address(),
        completionResultBatchSize:
          appConfig?.endpoints?.agents?.backgroundTasks?.completionResultBatchSize,
        idlePolling: appConfig?.endpoints?.agents?.eventDriven?.idlePolling,
      });
      const scheduleEngineArmed = (await initializeScheduleEngine()) != null;
      scheduleEngineState = scheduleEngineArmed ? 'armed' : 'unavailable';
      if (!scheduleEngineArmed) {
        // Terminal, not transient: arming is attempted once, so schedule writes are refused
        // for the life of this process. Logged at error level because the only other signal
        // an operator gets is a 503 on every write — every other health signal stays green.
        logger.error(
          '[schedules] write routes are PERMANENTLY unavailable in this process: the engine did not arm. ' +
            'Resolve the cause logged above and restart.',
        );
      }
      serverReady = true;
      logger.info('Server readiness checks passing.');

      try {
        const { startEdgeHeartbeatEmitter } = require('@librechat/api/telemetry');
        startEdgeHeartbeatEmitter(1000);
      } catch (hbErr) {
        logger.warn('[EdgeHeartbeat] Could not start telemetry emitter: ' + hbErr.message);
      }
    } catch (initErr) {
      serverReady = false;
      logger.error('Post-listen initialization failed:', initErr);
      process.exit(1);
    }
  });

  configureServerTimeouts(server);
  logger.info('HTTP server timeout configuration', {
    keepAliveTimeout: server.keepAliveTimeout,
    keepAliveTimeoutBuffer: server.keepAliveTimeoutBuffer,
    headersTimeout: server.headersTimeout,
    requestTimeout: server.requestTimeout,
  });

  const ptyWss = new WebSocket.Server({ noServer: true, perMessageDeflate: false });
  const handleOpenCodePtyUpgrade = createOpenCodePtyUpgradeHandler({
    wss: ptyWss,
    registry: routes.opencode.ptyRegistry,
    getAppConfig,
    getChatProject: (userId, projectId) =>
      runAsSystem(() => agentEventMethods.getChatProject(userId, projectId)),
    verifyJwt: (token) => {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        return null;
      }
      const decoded = jwt.verify(token, secret);
      if (!decoded || typeof decoded !== 'object' || typeof decoded.id !== 'string') {
        return null;
      }
      return { id: decoded.id, tenantId: decoded.tenantId };
    },
    createUpstreamWebSocket: (wsUrl, opts) =>
      new WebSocket(wsUrl, { ...opts, perMessageDeflate: false }),
  });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/ide')) {
      logger.info(
        `[IDE-WS] upgrade path=${url.pathname} query=${url.search.slice(0, 120)} host=${req.headers.host ?? ''} ua=${(req.headers['user-agent'] ?? '').slice(0, 60)}`,
      );
      /** The upgrade must not be anonymous: code-server's WS carries the whole
       *  IDE session. The token comes from the ide_token cookie (set by the
       *  /api/ide route after its own auth) or the ?token= query parameter.
       *  Browsers send cookies on WS upgrades automatically. */
      const parsedCookies =
        typeof req.headers.cookie === 'string' ? cookie.parse(req.headers.cookie) : {};
      const authToken = url.searchParams.get('token') ?? parsedCookies.ide_token;
      if (!authToken) {
        logger.warn('[IDE-WS] rejected: no auth token on upgrade request');
        socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }
      try {
        const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
        if (!decoded.id) {
          throw new Error('token carries no user id');
        }
        req.user = { id: decoded.id, role: decoded.role };
        logger.info(`[IDE-WS] authenticated user ${decoded.id} on upgrade`);
      } catch (err) {
        logger.warn(`[IDE-WS] rejected: invalid token (${err.message})`);
        socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }
      const upgradedAt = Date.now();
      socket.on('close', () => {
        logger.info(`[IDE-WS] socket closed after ${Date.now() - upgradedAt}ms`);
      });
      socket.on('error', (err) => {
        logger.warn(`[IDE-WS] socket error: ${err.message}`);
      });
      if (routes.ide?.vscoderProxy?.upgrade) {
        // Rewrite origin and host so code-server's internal origin-check passes
        req.headers['origin'] = `http://${routes.ide.VSCODER_TARGET.replace('http://', '')}`;
        req.headers['host'] = routes.ide.VSCODER_TARGET.replace('http://', '');
        routes.ide.vscoderProxy.upgrade(req, socket, head);
      } else {
        logger.warn('[IDE-WS] no vscoderProxy upgrade handler; destroying socket');
        socket.destroy();
      }
      return;
    }
    if (url.pathname.startsWith('/comfyui/ws')) {
      req.headers['origin'] = 'http://127.0.0.1:8188';
      req.headers['host'] = '127.0.0.1:8188';
      if (typeof comfyProxy?.upgrade === 'function') {
        comfyProxy.upgrade(req, socket, head);
        return;
      }
    }
    if (
      url.pathname.startsWith('/api/openfilm') ||
      url.pathname.startsWith('/ws') ||
      url.pathname === '/api/events' ||
      url.pathname.includes('/events')
    ) {
      if (routes.openfilm?.openfilmProxy?.upgrade) {
        const runInfo = routes.openfilm.getStudioRunInfo();
        const targetHost = (runInfo?.origin || routes.openfilm.OPENFILM_TARGET).replace(
          /^https?:\/\//,
          '',
        );
        req.headers['origin'] = `http://${targetHost}`;
        req.headers['host'] = targetHost;
        routes.openfilm.openfilmProxy.upgrade(req, socket, head);
      } else {
        socket.destroy();
      }
      return;
    }
    void handleOpenCodePtyUpgrade(req, socket, head);
  });

  setupGracefulShutdown(server);
};

/**
 * Boot rejections (e.g. `connectDb`, `getAppConfig`, `performStartupChecks`)
 * must remain fail-fast: a half-initialized process with no listening HTTP
 * server should die immediately so the orchestrator restarts it, instead of
 * being kept alive by the `unhandledRejection` handler below until the
 * liveness probe eventually times out. Mirrors the pattern in
 * `experimental.js`.
 */
startServer().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});

let messageCount = 0;
process.on('uncaughtException', (err) => {
  if (!err.message.includes('fetch failed')) {
    logger.error('There was an uncaught error:', err);
  }

  if (err.message && err.message?.toLowerCase()?.includes('abort')) {
    logger.warn('There was an uncatchable abort error.');
    return;
  }

  if (err.message.includes('GoogleGenerativeAI')) {
    logger.warn(
      '\n\n`GoogleGenerativeAI` errors cannot be caught due to an upstream issue, see: https://github.com/google-gemini/generative-ai-js/issues/303',
    );
    return;
  }

  if (err.message.includes('fetch failed')) {
    if (messageCount === 0) {
      logger.warn('Meilisearch error, search will be disabled');
      messageCount++;
    }

    return;
  }

  if (err.message.includes('OpenAIError') || err.message.includes('ChatCompletionMessage')) {
    logger.error(
      '\n\nAn Uncaught `OpenAIError` error may be due to your reverse-proxy setup or stream configuration, or a bug in the `openai` node package.',
    );
    return;
  }

  if (err.stack && err.stack.includes('@librechat/agents')) {
    logger.error(
      '\n\nAn error occurred in the agents system. The error has been logged and the app will continue running.',
      {
        message: err.message,
        stack: err.stack,
      },
    );
    return;
  }

  if (isEnabled(process.env.CONTINUE_ON_UNCAUGHT_EXCEPTION)) {
    logger.error('Unhandled error encountered. The app will continue running.', {
      name: err?.name,
      message: err?.message,
      stack: err?.stack,
    });
    return;
  }

  process.exit(1);
});

/**
 * Unhandled promise rejection handler.
 *
 * Node 15+ terminates the process by default when a promise rejection is
 * unhandled. MCP OAuth reconnect storms and streamable-HTTP transport resets
 * can produce transient fire-and-forget rejections (ECONNRESET, token refresh
 * races) that are recoverable — the server should log and keep serving other
 * requests rather than silently crash under load.
 *
 * Non-Error reasons are forwarded as-is so structured payloads (e.g.
 * `{ code: "ECONNRESET", errno: -104 }`) survive instead of being collapsed to
 * "[object Object]" by `String()`.
 */
process.on('unhandledRejection', (reason) => {
  if (reason instanceof Error) {
    logger.error('Unhandled promise rejection. The app will continue running.', {
      name: reason.name,
      message: reason.message,
      stack: reason.stack,
      cause: reason.cause,
    });
    return;
  }
  logger.error('Unhandled promise rejection. The app will continue running.', { reason });
});

/** Export app for easier testing purposes */
module.exports = app;
