import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { logger } from '@librechat/data-schemas';
import { opencodeConfigSchema } from 'librechat-data-provider';
import type { TOpenCodeConfig } from 'librechat-data-provider';
import type { AppConfig } from '@librechat/data-schemas';
import type { Request, Response } from 'express';
import type { OpenCodeClient, OpenCodeSession } from './client';
import type { OpenCodePtyRegistry } from './ptyRegistry';
import type { OpenCodePreviewManager } from './preview';
import type { OpenCodeProjectRecord } from './paths';
import type { OpenCodeWebSocketLike } from './ws';
import type { OpenCodeError } from './errors';
import {
  createOpenCodePreviewManager,
  getPreviewCookieName,
  getPreviewProxyBasePath,
  proxyOpenCodePreviewRequest,
} from './preview';
import {
  assertWritablePath,
  ensureProjectWorkspace,
  readSafeDirTree,
  resolveInsideRoot,
  resolveProjectRoot,
} from './paths';
import { createOpenCodePtyRegistry } from './ptyRegistry';
import { getSafeErrorMetadata } from '~/utils/errors';
import { createOpenCodeClient } from './client';
import { relayOpenCodeEvents } from './sse';

const SESSION_ID_RE = /^ses[A-Za-z0-9_-]+$/;
const PERMISSION_ID_RE = /^per[A-Za-z0-9_-]+$/;
const QUESTION_ID_RE = /^que[A-Za-z0-9_-]+$/;
const ALLOWED_PERMISSION_REPLIES = new Set(['once', 'always', 'reject']);

const WORKSPACE_RUNTIME_CONTRACT = `\n\n[Workspace Runtime Contract — apply automatically when building or updating a web app:
1. Build a self-contained runnable Node.js ESM app ("type": "module" in package.json with "scripts": { "dev": "node --watch server.mjs" } so server edits hot-reload automatically).
2. In server.mjs, import createServer from "node:http" and readFileSync from "node:fs", listen on Number(process.env.PORT || 0) on host "127.0.0.1" (never use placeholder strings like [IP_ADDRESS]), and log "Server listening on http://127.0.0.1:" + server.address().port.
3. In index.html / frontend code, always use relative paths ("./api/...", never absolute location.origin + "/api/...") so endpoints and EventSource SSE work inside the preview proxy.
4. When scraping or fetching live data (e.g., metals/gold prices, tickers, or JS-rendered sites where plain HTML has no price strings), do not stop to ask a non-technical user whether to install Puppeteer — either query http://127.0.0.1:3080/api/opencode/reader?url=<encodedUrl> or automatically discover and query the site's underlying JSON/XHR/WebSocket/RSS feed so real live values render out of the box.
5. Always run "node --check server.mjs" and automatically fix any syntax or runtime issues before finishing.]`;

function appendWorkspaceContract(
  userText: string,
  context?: { projectId?: string; userId?: string },
): string {
  const ctxTag =
    context?.projectId && context?.userId
      ? `\n[Satchida-Context: projectId=${context.projectId} userId=${context.userId}]`
      : '';
  if (userText.includes('[Workspace Runtime Contract')) {
    return `${userText}${ctxTag}`;
  }
  return `${userText}${WORKSPACE_RUNTIME_CONTRACT}${ctxTag}`;
}

export type { OpenCodeProjectRecord } from './paths';

export interface OpenCodeHttpDeps {
  getAppConfig: (options?: { tenantId?: string }) => Promise<AppConfig | null | undefined>;
  getChatProject: (userId: string, projectId: string) => Promise<OpenCodeProjectRecord | null>;
  updateChatProject?: (
    userId: string,
    projectId: string,
    input: { localPath?: string },
  ) => Promise<OpenCodeProjectRecord | null>;
  ptyRegistry?: OpenCodePtyRegistry;
  previewManager?: OpenCodePreviewManager;
  createUpstreamWebSocket?: (
    url: string,
    options?: { headers?: Record<string, string> },
  ) => OpenCodeWebSocketLike;
  verifyJwt?: (token: string) => { id: string; tenantId?: string } | null;
  getServerPassword?: () => string | undefined;
  fetchImpl?: typeof fetch;
  isUserInPlatformAdminGroup?: (userId: string) => Promise<boolean>;
  getUserSeatCredential?: (userId: string) => Promise<{
    seatToken?: string | null;
    accountType?: string | null;
    tenantId?: string | null;
    role?: string | null;
    familyRole?: string | null;
  } | null>;
  enforcePlatformAdminForPty?: boolean;
}

export interface OpenCodeHttpHandlers {
  getStatus: (req: Request, res: Response) => Promise<Response>;
  proxyLlmToGateway: (req: Request, res: Response) => Promise<void>;
  provisionWorkspace: (req: Request, res: Response) => Promise<Response>;
  getTree: (req: Request, res: Response) => Promise<Response>;
  readFile: (req: Request, res: Response) => Promise<Response>;
  writeFile: (req: Request, res: Response) => Promise<Response>;
  createPty: (req: Request, res: Response) => Promise<Response>;
  resizePty: (req: Request, res: Response) => Promise<Response>;
  createPtyConnectToken: (req: Request, res: Response) => Promise<Response>;
  createSessionPrompt: (req: Request, res: Response) => Promise<Response>;
  listSessions: (req: Request, res: Response) => Promise<Response>;
  createSession: (req: Request, res: Response) => Promise<Response>;
  sendPrompt: (req: Request, res: Response) => Promise<Response>;
  abortSession: (req: Request, res: Response) => Promise<Response>;
  getSessionMessages: (req: Request, res: Response) => Promise<Response>;
  getSessionDiff: (req: Request, res: Response) => Promise<Response>;
  revertSession: (req: Request, res: Response) => Promise<Response>;
  unrevertSession: (req: Request, res: Response) => Promise<Response>;
  getProviders: (req: Request, res: Response) => Promise<Response>;
  listAgents: (req: Request, res: Response) => Promise<Response>;
  listPermissions: (req: Request, res: Response) => Promise<Response>;
  replyPermission: (req: Request, res: Response) => Promise<Response>;
  listQuestions: (req: Request, res: Response) => Promise<Response>;
  replyQuestion: (req: Request, res: Response) => Promise<Response>;
  rejectQuestion: (req: Request, res: Response) => Promise<Response>;
  streamEvents: (req: Request, res: Response) => Promise<void>;
  getVcs: (req: Request, res: Response) => Promise<Response>;
  getPreviewStatus: (req: Request, res: Response) => Promise<Response>;
  startPreview: (req: Request, res: Response) => Promise<Response>;
  stopPreview: (req: Request, res: Response) => Promise<Response>;
  proxyPreview: (req: Request, res: Response) => Promise<void>;
  readUrlContent: (req: Request, res: Response) => Promise<Response>;
  exportProjectZip: (req: Request, res: Response) => Promise<Response>;
}

interface AuthenticatedRequest extends Request {
  user?: {
    id?: string;
    _id?: { toString(): string };
    username?: string;
    email?: string;
    tenantId?: string;
    role?: string;
    accountType?: string;
    seatToken?: string;
  };
}

const ADMIN_FREE_PROVIDERS = new Set(['opencode', 'opencode-go']);
const PLATFORM_OPERATOR_TENANTS = new Set(['', 'satchida-master']);
const ENTITLED_VIBECODING_ACCOUNT_TYPES = new Set([
  'work_study',
  'workstudy',
  'pro',
  'pro_family',
  'privacy',
  'enterprise',
]);

function sendError(res: Response, error: OpenCodeError): Response {
  return res.status(error.status).json({ error: { code: error.code } });
}

function getUserId(req: AuthenticatedRequest): string | null {
  const id = req.user?.id ?? req.user?._id?.toString();
  return typeof id === 'string' && id.length > 0 ? id : null;
}

function isSameCanonicalDirectory(projectRoot: string, candidateDir: string | undefined): boolean {
  if (!candidateDir) {
    return false;
  }
  const a = path.resolve(projectRoot);
  const b = path.resolve(candidateDir);
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function hasRootHtmlFile(projectRoot: string): boolean {
  if (
    fs.existsSync(path.join(projectRoot, 'index.html')) ||
    fs.existsSync(path.join(projectRoot, 'app.html'))
  ) {
    return true;
  }
  try {
    const entries = fs.readdirSync(projectRoot, { withFileTypes: true });
    return entries.some((entry) => entry.isFile() && /\.(?:html|htm)$/i.test(entry.name));
  } catch {
    return false;
  }
}

function inspectProjectScripts(projectRoot: string): {
  availableScripts: string[];
  recommendedCommand: string;
} {
  const availableScripts: string[] = [];
  let recommendedCommand = '';
  const hasServerMjs = fs.existsSync(path.join(projectRoot, 'server.mjs'));
  const hasServerJs = fs.existsSync(path.join(projectRoot, 'server.js'));
  const hasHtml = hasRootHtmlFile(projectRoot);
  const pkgPath = path.join(projectRoot, 'package.json');

  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
        scripts?: Record<string, string>;
      };
      const scripts = pkg.scripts ?? {};
      const candidateOrder = [
        'dev:mock',
        'dev:frontend',
        'dev:minimal',
        'dev:static',
        'dev',
        'start',
        'preview',
        'serve',
      ];
      for (const key of candidateOrder) {
        if (typeof scripts[key] === 'string' && scripts[key].trim().length > 0) {
          availableScripts.push(key === 'start' ? 'npm start' : `npm run ${key}`);
        }
      }
      if (hasServerMjs && !availableScripts.includes('node --watch server.mjs')) {
        availableScripts.push('node --watch server.mjs');
      }
      if (hasServerJs && !availableScripts.includes('node server.js')) {
        availableScripts.push('node server.js');
      }
      if (hasHtml && !availableScripts.includes('static')) {
        availableScripts.push('static');
      }
      if (availableScripts.length > 0) {
        recommendedCommand = availableScripts[0];
      }
    } catch {
      /* ignore malformed package.json */
    }
  } else {
    if (hasServerMjs) {
      availableScripts.push('node --watch server.mjs');
    }
    if (hasServerJs) {
      availableScripts.push('node server.js');
    }
    if (hasHtml) {
      availableScripts.push('static');
    }
    if (fs.existsSync(path.join(projectRoot, 'app.py'))) {
      availableScripts.push('python app.py');
    } else if (fs.existsSync(path.join(projectRoot, 'main.py'))) {
      availableScripts.push('python main.py');
    } else if (fs.existsSync(path.join(projectRoot, 'manage.py'))) {
      availableScripts.push('python manage.py runserver');
    }
    if (availableScripts.length > 0) {
      recommendedCommand = availableScripts[0];
    }
  }

  return { availableScripts, recommendedCommand };
}

interface PromptImageAttachment {
  name?: string;
  mime?: string;
  dataUrl?: string;
}

async function processPromptImages(params: {
  images: unknown;
  userPromptText: string;
  projectRoot: string;
  seatToken?: string | null;
  fetchFn: typeof fetch;
}): Promise<string> {
  if (!Array.isArray(params.images) || params.images.length === 0) {
    return '';
  }
  const validImages = (params.images as PromptImageAttachment[]).filter(
    (img) =>
      img &&
      typeof img.dataUrl === 'string' &&
      /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,/i.test(img.dataUrl),
  );
  if (validImages.length === 0) {
    return '';
  }

  const screenshotsDir = path.join(params.projectRoot, '.satchida-screenshots');
  try {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  } catch {
    /* ignore */
  }

  const notes: string[] = [];
  for (let i = 0; i < Math.min(validImages.length, 3); i++) {
    const img = validImages[i];
    const dataUrl = img.dataUrl ?? '';
    const match = /^data:(image\/([a-z0-9+.-]+));base64,(.+)$/i.exec(dataUrl);
    if (!match) {
      continue;
    }
    const ext = match[2] === 'jpeg' ? 'jpg' : match[2];
    const safeBase = (img.name ?? `screenshot-${i + 1}`)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.[^.]+$/, '')
      .slice(0, 40);
    const filename = `${Date.now()}-${safeBase}.${ext}`;
    const relPath = `.satchida-screenshots/${filename}`;
    const fullPath = path.join(screenshotsDir, filename);
    try {
      fs.writeFileSync(fullPath, Buffer.from(match[3], 'base64'));
    } catch {
      /* ignore write failure */
    }

    let visionAnalysis = '';
    const gatewayBase = (
      process.env.SATCHIDA_AUTOROUTER_BASE_URL || 'http://127.0.0.1:4000/v1'
    ).replace(/\/+$/, '');
    const authToken = params.seatToken || process.env.SATCHIDA_GATEWAY_VK || '';
    if (authToken) {
      try {
        const vRes = await params.fetchFn(`${gatewayBase}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
            'X-Satchida-Mode': 'Motion',
          },
          body: JSON.stringify({
            model: 'Motion',
            max_tokens: 450,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Inspect this attached UI/code screenshot for a coding task ("${params.userPromptText.slice(0, 200)}"). List all visible text, error messages, layout/styling defects, and UI components concisely.`,
                  },
                  {
                    type: 'image_url',
                    image_url: { url: dataUrl },
                  },
                ],
              },
            ],
          }),
        });
        if (vRes.ok) {
          const vJson = (await vRes.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          visionAnalysis = (vJson.choices?.[0]?.message?.content ?? '').trim();
        }
      } catch {
        /* ignore vision fallback error */
      }
    }

    notes.push(
      visionAnalysis
        ? `[Attached Screenshot #${i + 1} saved in workspace at "${relPath}"]\nVisual Inspection & OCR of Screenshot #${i + 1}:\n${visionAnalysis}`
        : `[Attached Screenshot #${i + 1} saved in workspace at "${relPath}"]`,
    );
  }

  return notes.length > 0 ? `\n\n${notes.join('\n\n')}` : '';
}

function buildUncompressedZipBuffer(entries: Array<{ name: string; data: Buffer }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name.replace(/\\/g, '/'), 'utf8');
    const crc = zlib.crc32(entry.data) >>> 0;
    const size = entry.data.length;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
    localHeader.writeUInt16LE(0, 8); // store method (0)
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(size, 18);
    localHeader.writeUInt32LE(size, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(size, 20);
    centralHeader.writeUInt32LE(size, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += 30 + nameBuf.length + size;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

async function loadResolvedConfig(
  deps: OpenCodeHttpDeps,
  req: AuthenticatedRequest,
): Promise<TOpenCodeConfig> {
  const appConfig = await deps.getAppConfig({ tenantId: req.user?.tenantId });
  const parsed = opencodeConfigSchema.safeParse(appConfig?.opencode ?? {});
  return parsed.success ? parsed.data : opencodeConfigSchema.parse({});
}

export function createOpenCodeHttpHandlers(deps: OpenCodeHttpDeps): OpenCodeHttpHandlers {
  const resolvePassword = deps.getServerPassword ?? (() => process.env.OPENCODE_SERVER_PASSWORD);
  const ptyRegistry = deps.ptyRegistry ?? createOpenCodePtyRegistry();
  const previewManager = deps.previewManager ?? createOpenCodePreviewManager();
  interface SeatCallerRecord {
    userId: string;
    tenantId?: string | null;
    projectId?: string;
    projectRoot?: string;
    isPlatformAdmin: boolean;
    seatToken?: string | null;
    accountType?: string | null;
    updatedAt: number;
  }

  let activeLlmCaller: SeatCallerRecord | null = null;
  const callersByUserId = new Map<string, SeatCallerRecord>();
  const callersByProjectId = new Map<string, SeatCallerRecord>();
  const callersByProjectRoot = new Map<string, SeatCallerRecord>();

  async function isPlatformAdminUser(req: AuthenticatedRequest): Promise<boolean> {
    const userId = getUserId(req);
    if (!userId) {
      return false;
    }
    const tenantId = (req.user?.tenantId ?? '').trim();
    // Tenant Admins on non-master customer tenants are strictly excluded from
    // the Platform Admin exception (cannot use OpenCode Zen/Go or terminal bypass).
    if (!PLATFORM_OPERATOR_TENANTS.has(tenantId)) {
      return false;
    }
    return (req.user?.role ?? '').toUpperCase() === 'ADMIN';
  }

  async function recordActiveLlmCaller(
    req: AuthenticatedRequest,
    context?: { projectId?: string; projectRoot?: string },
  ): Promise<{ ok: true; isPlatformAdmin: boolean } | { ok: false; error: OpenCodeError }> {
    const userId = getUserId(req);
    if (!userId) {
      return { ok: false, error: { code: 'OPENCODE_UNAUTHORIZED', status: 401 } };
    }
    const isPlatformAdmin = await isPlatformAdminUser(req);
    let seatToken: string | null | undefined = req.user?.seatToken;
    let accountType: string | null | undefined = req.user?.accountType;

    if (deps.getUserSeatCredential) {
      const cred = await deps.getUserSeatCredential(userId);
      if (cred) {
        seatToken = cred.seatToken ?? seatToken;
        accountType = cred.accountType ?? accountType;
        if (cred.familyRole === 'minor' || cred.familyRole === 'child') {
          return { ok: false, error: { code: 'OPENCODE_UNAUTHORIZED', status: 403 } };
        }
      }
    }

    if (
      !isPlatformAdmin &&
      accountType &&
      !ENTITLED_VIBECODING_ACCOUNT_TYPES.has(accountType.toLowerCase())
    ) {
      return { ok: false, error: { code: 'OPENCODE_UNAUTHORIZED', status: 403 } };
    }

    const record: SeatCallerRecord = {
      userId,
      projectId: context?.projectId,
      projectRoot: context?.projectRoot,
      isPlatformAdmin,
      seatToken,
      accountType,
      updatedAt: Date.now(),
    };
    activeLlmCaller = record;
    callersByUserId.set(userId, record);
    if (context?.projectId) {
      callersByProjectId.set(context.projectId, record);
    }
    if (context?.projectRoot) {
      callersByProjectRoot.set(context.projectRoot.toLowerCase(), record);
    }
    return { ok: true, isPlatformAdmin };
  }

  function isModelAllowedForCaller(
    model: { providerID: string; modelID: string } | undefined,
    isPlatformAdmin: boolean,
  ): boolean {
    if (!model) {
      return true;
    }
    const allowedGatewayModel = process.env.OPENCODE_GATEWAY_MODEL || 'Vibecoding';
    if (model.providerID === 'satchida' && model.modelID === allowedGatewayModel) {
      return true;
    }
    if (isPlatformAdmin && ADMIN_FREE_PROVIDERS.has(model.providerID)) {
      return true;
    }
    return false;
  }

  async function resolveRequestContext(req: AuthenticatedRequest): Promise<
    | {
        ok: true;
        userId: string;
        tenantId?: string;
        projectId: string;
        config: TOpenCodeConfig;
        project: OpenCodeProjectRecord;
        projectRoot: string;
      }
    | { ok: false; error: OpenCodeError }
  > {
    const userId = getUserId(req);
    if (!userId) {
      return { ok: false, error: { code: 'OPENCODE_UNAUTHORIZED', status: 401 } };
    }

    const config = await loadResolvedConfig(deps, req);
    if (!config.enabled) {
      return { ok: false, error: { code: 'OPENCODE_DISABLED', status: 403 } };
    }

    const projectId = req.params?.projectId;
    if (typeof projectId !== 'string' || projectId.length === 0) {
      return { ok: false, error: { code: 'INVALID_REQUEST', status: 400 } };
    }

    const project = await deps.getChatProject(userId, projectId);
    if (!project) {
      return { ok: false, error: { code: 'PROJECT_NOT_FOUND', status: 404 } };
    }

    const rootResult = resolveProjectRoot(project, config.allowedRoots);
    if (!rootResult.ok) {
      return rootResult;
    }

    if (deps.updateChatProject && project.localPath !== rootResult.value) {
      void deps.updateChatProject(userId, projectId, { localPath: rootResult.value }).catch(() => {
        /* ignore background canonical path persistence error */
      });
    }

    return {
      ok: true,
      userId,
      tenantId: req.user?.tenantId,
      projectId,
      config,
      project,
      projectRoot: rootResult.value,
    };
  }

  function requireClient(
    config: TOpenCodeConfig,
  ): { ok: true; client: OpenCodeClient } | { ok: false; error: OpenCodeError } {
    const password = resolvePassword();
    if (!password || password.length === 0) {
      logger.error('[OpenCodeHttp] Refusing upstream call: OPENCODE_SERVER_PASSWORD is unset');
      return { ok: false, error: { code: 'OPENCODE_MISCONFIGURED', status: 503 } };
    }
    return {
      ok: true,
      client: createOpenCodeClient({
        baseUrl: config.baseUrl,
        password,
        timeoutMs: config.requestTimeoutMs,
        fetchImpl: deps.fetchImpl,
      }),
    };
  }

  async function assertSessionOwnedByProject(
    client: OpenCodeClient,
    projectRoot: string,
    sessionId: unknown,
  ): Promise<{ ok: true; session: OpenCodeSession } | { ok: false; error: OpenCodeError }> {
    if (typeof sessionId !== 'string' || !SESSION_ID_RE.test(sessionId)) {
      return { ok: false, error: { code: 'INVALID_REQUEST', status: 400 } };
    }
    const sessionRes = await client.getSession({ sessionId, directory: projectRoot });
    if (!sessionRes.ok) {
      return sessionRes;
    }
    if (!isSameCanonicalDirectory(projectRoot, sessionRes.value.directory)) {
      return { ok: false, error: { code: 'PROJECT_NOT_FOUND', status: 404 } };
    }
    return { ok: true, session: sessionRes.value };
  }

  return {
    getStatus: async (req: Request, res: Response) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const userId = getUserId(authReq);
        if (!userId) {
          return sendError(res, { code: 'OPENCODE_UNAUTHORIZED', status: 401 });
        }

        const config = await loadResolvedConfig(deps, authReq);
        if (!config.enabled) {
          return res.json({ enabled: false, reachable: false, version: null });
        }

        const password = resolvePassword();
        if (!password || password.length === 0) {
          return res.json({ enabled: true, reachable: false, version: null });
        }

        const client = createOpenCodeClient({
          baseUrl: config.baseUrl,
          password,
          timeoutMs: Math.min(config.requestTimeoutMs, 5_000),
          fetchImpl: deps.fetchImpl,
        });
        const health = await client.getHealth();
        if (!health.ok || health.value.healthy !== true) {
          return res.json({ enabled: true, reachable: false, version: null });
        }

        const isPlatformAdmin = await isPlatformAdminUser(authReq);
        return res.json({
          enabled: true,
          reachable: true,
          version: health.value.version,
          isPlatformAdmin,
        });
      } catch (error) {
        logger.error('[OpenCodeHttp] getStatus failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    getTree: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          return sendError(res, ctx.error);
        }
        const tree = readSafeDirTree(ctx.projectRoot, ctx.projectRoot, 0, 4);
        return res.json({
          rootPath: ctx.projectRoot,
          projectName: ctx.project.name ?? '',
          tree,
        });
      } catch (error) {
        logger.error('[OpenCodeHttp] getTree failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    readFile: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          return sendError(res, ctx.error);
        }

        const targetPath = req.query?.path;
        if (typeof targetPath !== 'string' || targetPath.length === 0) {
          return sendError(res, { code: 'INVALID_REQUEST', status: 400 });
        }

        const resolved = resolveInsideRoot(ctx.projectRoot, targetPath, { mustExist: true });
        if (!resolved.ok) {
          return sendError(res, resolved.error);
        }

        const stats = fs.statSync(resolved.value);
        if (!stats.isFile()) {
          return sendError(res, { code: 'PATH_INVALID', status: 400 });
        }
        if (stats.size > ctx.config.maxFileBytes) {
          return sendError(res, { code: 'FILE_TOO_LARGE', status: 413 });
        }

        const content = fs.readFileSync(resolved.value, 'utf8');
        return res.json({
          path: resolved.value,
          content,
          size: stats.size,
        });
      } catch (error) {
        logger.error('[OpenCodeHttp] readFile failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    writeFile: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          return sendError(res, ctx.error);
        }

        const body = req.body as { path?: unknown; content?: unknown } | undefined;
        if (typeof body?.path !== 'string' || typeof body.content !== 'string') {
          return sendError(res, { code: 'INVALID_REQUEST', status: 400 });
        }

        const byteLength = Buffer.byteLength(body.content, 'utf8');
        if (byteLength > ctx.config.maxFileBytes) {
          return sendError(res, { code: 'FILE_TOO_LARGE', status: 413 });
        }

        const resolved = resolveInsideRoot(ctx.projectRoot, body.path, { mustExist: false });
        if (!resolved.ok) {
          return sendError(res, resolved.error);
        }

        const writable = assertWritablePath(ctx.projectRoot, resolved.value);
        if (!writable.ok) {
          return sendError(res, writable.error);
        }

        if (fs.existsSync(resolved.value) && fs.statSync(resolved.value).isDirectory()) {
          return sendError(res, { code: 'PATH_INVALID', status: 400 });
        }

        fs.mkdirSync(path.dirname(resolved.value), { recursive: true });
        fs.writeFileSync(resolved.value, body.content, 'utf8');
        return res.json({ ok: true, path: resolved.value });
      } catch (error) {
        logger.error('[OpenCodeHttp] writeFile failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    createPty: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          return sendError(res, ctx.error);
        }

        if (deps.enforcePlatformAdminForPty) {
          const isAdmin = await isPlatformAdminUser(req as AuthenticatedRequest);
          if (!isAdmin) {
            return sendError(res, { code: 'OPENCODE_UNAUTHORIZED', status: 403 });
          }
        }
        const callerCheck = await recordActiveLlmCaller(req as AuthenticatedRequest);
        if (!callerCheck.ok) {
          return sendError(res, callerCheck.error);
        }

        const clientRes = requireClient(ctx.config);
        if (!clientRes.ok) {
          return sendError(res, clientRes.error);
        }

        const body = req.body as
          | { command?: unknown; args?: unknown; title?: unknown; mode?: unknown }
          | undefined;
        let command = typeof body?.command === 'string' ? body.command : undefined;
        let args = Array.isArray(body?.args)
          ? body.args.filter((item): item is string => typeof item === 'string')
          : undefined;
        let title = typeof body?.title === 'string' ? body.title : undefined;
        const mode = body?.mode === 'shell' ? 'shell' : 'opencode';

        if (command === undefined && mode === 'opencode') {
          const npmBin =
            process.platform === 'win32' && process.env.APPDATA
              ? path.join(
                  process.env.APPDATA,
                  'npm',
                  'node_modules',
                  'opencode-ai',
                  'bin',
                  'opencode.exe',
                )
              : null;
          command =
            process.env.OPENCODE_BIN || (npmBin && fs.existsSync(npmBin) ? npmBin : 'opencode');
          args = ['attach', '--pure', ctx.config.baseUrl, '--dir', ctx.projectRoot];
          title = title ?? 'Satchida Vibe TUI';
        }

        const result = await clientRes.client.createPty({
          directory: ctx.projectRoot,
          body: {
            cwd: ctx.projectRoot,
            ...(command !== undefined && { command }),
            ...(args !== undefined && { args }),
            ...(title !== undefined && { title }),
          },
        });

        if (!result.ok) {
          return sendError(res, result.error);
        }

        const issued = ptyRegistry.registerPty({
          ptyId: result.value.id,
          userId: ctx.userId,
          tenantId: ctx.tenantId,
          projectId: ctx.projectId,
          projectRoot: ctx.projectRoot,
        });

        return res.json({
          ...result.value,
          connectTicket: issued.connectTicket,
          expiresIn: issued.expiresIn,
        });
      } catch (error) {
        logger.error('[OpenCodeHttp] createPty failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    resizePty: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          return sendError(res, ctx.error);
        }

        if (deps.enforcePlatformAdminForPty) {
          const isAdmin = await isPlatformAdminUser(req as AuthenticatedRequest);
          if (!isAdmin) {
            return sendError(res, { code: 'OPENCODE_UNAUTHORIZED', status: 403 });
          }
        }
        const callerCheck = await recordActiveLlmCaller(req as AuthenticatedRequest);
        if (!callerCheck.ok) {
          return sendError(res, callerCheck.error);
        }

        const clientRes = requireClient(ctx.config);
        if (!clientRes.ok) {
          return sendError(res, clientRes.error);
        }

        const ptyId = req.params?.ptyId;
        if (typeof ptyId !== 'string' || !/^pty_[^/]+$/.test(ptyId)) {
          return sendError(res, { code: 'INVALID_REQUEST', status: 400 });
        }

        const entry = ptyRegistry.getPtyOwner(ptyId);
        if (!entry || entry.userId !== ctx.userId || entry.projectId !== ctx.projectId) {
          return sendError(res, { code: 'OPENCODE_UNAUTHORIZED', status: 403 });
        }

        const body = req.body as { cols?: unknown; rows?: unknown } | undefined;
        const cols = typeof body?.cols === 'number' ? Math.round(body.cols) : 0;
        const rows = typeof body?.rows === 'number' ? Math.round(body.rows) : 0;
        if (cols < 20 || cols > 500 || rows < 5 || rows > 200) {
          return sendError(res, { code: 'INVALID_REQUEST', status: 400 });
        }

        const result = await clientRes.client.updatePty({
          ptyId,
          directory: ctx.projectRoot,
          size: { rows, cols },
        });
        if (!result.ok) {
          return sendError(res, result.error);
        }
        return res.json({ ok: true, cols, rows });
      } catch (error) {
        logger.error('[OpenCodeHttp] resizePty failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    createPtyConnectToken: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          return sendError(res, ctx.error);
        }

        if (deps.enforcePlatformAdminForPty) {
          const isAdmin = await isPlatformAdminUser(req as AuthenticatedRequest);
          if (!isAdmin) {
            return sendError(res, { code: 'OPENCODE_UNAUTHORIZED', status: 403 });
          }
        }
        const callerCheck = await recordActiveLlmCaller(req as AuthenticatedRequest);
        if (!callerCheck.ok) {
          return sendError(res, callerCheck.error);
        }

        const clientRes = requireClient(ctx.config);
        if (!clientRes.ok) {
          return sendError(res, clientRes.error);
        }

        const ptyId = req.params?.ptyId;
        if (typeof ptyId !== 'string' || !/^pty_[^/]+$/.test(ptyId)) {
          return sendError(res, { code: 'INVALID_REQUEST', status: 400 });
        }

        const issued = ptyRegistry.issueConnectTicket(ptyId, ctx.userId, ctx.projectId);
        if (!issued) {
          return sendError(res, { code: 'OPENCODE_UNAUTHORIZED', status: 403 });
        }

        return res.json({
          ticket: issued.connectTicket,
          expiresIn: issued.expiresIn,
        });
      } catch (error) {
        logger.error('[OpenCodeHttp] createPtyConnectToken failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    listSessions: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          return sendError(res, ctx.error);
        }
        const clientRes = requireClient(ctx.config);
        if (!clientRes.ok) {
          return sendError(res, clientRes.error);
        }

        const result = await clientRes.client.listSessions({ directory: ctx.projectRoot });
        if (!result.ok) {
          return sendError(res, result.error);
        }

        const filtered = result.value.filter((session) =>
          isSameCanonicalDirectory(ctx.projectRoot, session.directory),
        );
        return res.json(filtered);
      } catch (error) {
        logger.error('[OpenCodeHttp] listSessions failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    createSession: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          return sendError(res, ctx.error);
        }
        const clientRes = requireClient(ctx.config);
        if (!clientRes.ok) {
          return sendError(res, clientRes.error);
        }

        const body = req.body as { title?: unknown; agent?: unknown } | undefined;
        const title =
          typeof body?.title === 'string' && body.title.trim().length > 0
            ? body.title.trim()
            : `${ctx.project.name ?? 'Project'} Session`;
        const agent =
          typeof body?.agent === 'string' && body.agent.trim().length > 0
            ? body.agent.trim()
            : undefined;

        const result = await clientRes.client.createSession({
          directory: ctx.projectRoot,
          body: {
            title,
            ...(agent !== undefined && { agent }),
          },
        });
        if (!result.ok) {
          return sendError(res, result.error);
        }
        return res.json(result.value);
      } catch (error) {
        logger.error('[OpenCodeHttp] createSession failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    sendPrompt: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          return sendError(res, ctx.error);
        }
        const clientRes = requireClient(ctx.config);
        if (!clientRes.ok) {
          return sendError(res, clientRes.error);
        }

        const owned = await assertSessionOwnedByProject(
          clientRes.client,
          ctx.projectRoot,
          req.params?.sessionId,
        );
        if (!owned.ok) {
          return sendError(res, owned.error);
        }

        const body = req.body as
          | {
              text?: unknown;
              agent?: unknown;
              model?: { providerID?: unknown; modelID?: unknown };
              images?: unknown;
            }
          | undefined;

        if (typeof body?.text !== 'string' || body.text.trim().length === 0) {
          return sendError(res, { code: 'INVALID_REQUEST', status: 400 });
        }

        const model =
          body.model &&
          typeof body.model.providerID === 'string' &&
          body.model.providerID.length > 0 &&
          typeof body.model.modelID === 'string' &&
          body.model.modelID.length > 0
            ? { providerID: body.model.providerID, modelID: body.model.modelID }
            : undefined;

        const callerCheck = await recordActiveLlmCaller(req as AuthenticatedRequest, {
          projectId: ctx.projectId,
          projectRoot: ctx.projectRoot,
        });
        if (!callerCheck.ok) {
          return sendError(res, callerCheck.error);
        }
        if (!isModelAllowedForCaller(model, callerCheck.isPlatformAdmin)) {
          return sendError(res, { code: 'PROVIDER_NOT_ALLOWED', status: 403 });
        }

        const agent =
          typeof body.agent === 'string' && body.agent.trim().length > 0
            ? body.agent.trim()
            : undefined;

        const imageNotes = await processPromptImages({
          images: body.images,
          userPromptText: body.text,
          projectRoot: ctx.projectRoot,
          seatToken: callersByUserId.get(ctx.userId)?.seatToken,
          fetchFn: deps.fetchImpl ?? fetch,
        });

        const result = await clientRes.client.sendPromptAsync({
          sessionId: owned.session.id,
          directory: ctx.projectRoot,
          body: {
            parts: [
              {
                type: 'text',
                text: appendWorkspaceContract(`${body.text}${imageNotes}`, {
                  projectId: ctx.projectId,
                  userId: ctx.userId,
                }),
              },
            ],
            ...(model !== undefined && { model }),
            ...(agent !== undefined && { agent }),
          },
        });

        if (!result.ok) {
          return sendError(res, result.error);
        }
        return res.status(202).json({ accepted: true });
      } catch (error) {
        logger.error('[OpenCodeHttp] sendPrompt failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    abortSession: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          return sendError(res, ctx.error);
        }
        const clientRes = requireClient(ctx.config);
        if (!clientRes.ok) {
          return sendError(res, clientRes.error);
        }

        const owned = await assertSessionOwnedByProject(
          clientRes.client,
          ctx.projectRoot,
          req.params?.sessionId,
        );
        if (!owned.ok) {
          return sendError(res, owned.error);
        }

        const result = await clientRes.client.abortSession({
          sessionId: owned.session.id,
          directory: ctx.projectRoot,
        });
        if (!result.ok) {
          return sendError(res, result.error);
        }
        return res.json({ aborted: result.value });
      } catch (error) {
        logger.error('[OpenCodeHttp] abortSession failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    getSessionMessages: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          return sendError(res, ctx.error);
        }
        const clientRes = requireClient(ctx.config);
        if (!clientRes.ok) {
          return sendError(res, clientRes.error);
        }

        const owned = await assertSessionOwnedByProject(
          clientRes.client,
          ctx.projectRoot,
          req.params?.sessionId,
        );
        if (!owned.ok) {
          return sendError(res, owned.error);
        }

        const result = await clientRes.client.getSessionMessages({
          sessionId: owned.session.id,
          directory: ctx.projectRoot,
        });
        if (!result.ok) {
          return sendError(res, result.error);
        }
        return res.json(result.value);
      } catch (error) {
        logger.error('[OpenCodeHttp] getSessionMessages failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    getSessionDiff: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          return sendError(res, ctx.error);
        }
        const clientRes = requireClient(ctx.config);
        if (!clientRes.ok) {
          return sendError(res, clientRes.error);
        }

        const owned = await assertSessionOwnedByProject(
          clientRes.client,
          ctx.projectRoot,
          req.params?.sessionId,
        );
        if (!owned.ok) {
          return sendError(res, owned.error);
        }

        const messageId =
          typeof req.query?.messageID === 'string' && req.query.messageID.length > 0
            ? req.query.messageID
            : undefined;

        const result = await clientRes.client.getSessionDiff({
          sessionId: owned.session.id,
          directory: ctx.projectRoot,
          messageId,
        });
        if (!result.ok) {
          return sendError(res, result.error);
        }
        return res.json(result.value);
      } catch (error) {
        logger.error('[OpenCodeHttp] getSessionDiff failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    revertSession: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          return sendError(res, ctx.error);
        }
        const clientRes = requireClient(ctx.config);
        if (!clientRes.ok) {
          return sendError(res, clientRes.error);
        }

        const owned = await assertSessionOwnedByProject(
          clientRes.client,
          ctx.projectRoot,
          req.params?.sessionId,
        );
        if (!owned.ok) {
          return sendError(res, owned.error);
        }

        const body = req.body as { messageID?: unknown; partID?: unknown } | undefined;
        if (typeof body?.messageID !== 'string' || !/^msg/.test(body.messageID)) {
          return sendError(res, { code: 'INVALID_REQUEST', status: 400 });
        }
        const partID =
          typeof body.partID === 'string' && /^prt/.test(body.partID) ? body.partID : undefined;

        const result = await clientRes.client.revertSession({
          sessionId: owned.session.id,
          directory: ctx.projectRoot,
          body: {
            messageID: body.messageID,
            ...(partID !== undefined && { partID }),
          },
        });
        if (!result.ok) {
          return sendError(res, result.error);
        }
        return res.json(result.value);
      } catch (error) {
        logger.error('[OpenCodeHttp] revertSession failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    unrevertSession: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          return sendError(res, ctx.error);
        }
        const clientRes = requireClient(ctx.config);
        if (!clientRes.ok) {
          return sendError(res, clientRes.error);
        }

        const owned = await assertSessionOwnedByProject(
          clientRes.client,
          ctx.projectRoot,
          req.params?.sessionId,
        );
        if (!owned.ok) {
          return sendError(res, owned.error);
        }

        const result = await clientRes.client.unrevertSession({
          sessionId: owned.session.id,
          directory: ctx.projectRoot,
        });
        if (!result.ok) {
          return sendError(res, result.error);
        }
        return res.json(result.value);
      } catch (error) {
        logger.error('[OpenCodeHttp] unrevertSession failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    getProviders: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          return sendError(res, ctx.error);
        }
        const clientRes = requireClient(ctx.config);
        if (!clientRes.ok) {
          return sendError(res, clientRes.error);
        }

        const result = await clientRes.client.getProviders({ directory: ctx.projectRoot });
        if (!result.ok) {
          return sendError(res, result.error);
        }
        const isPlatformAdmin = await isPlatformAdminUser(req as AuthenticatedRequest);
        const allowedProviders = result.value.providers.filter(
          (p) => p.id === 'satchida' || (isPlatformAdmin && ADMIN_FREE_PROVIDERS.has(p.id)),
        );
        return res.json({
          providers: allowedProviders.length > 0 ? allowedProviders : result.value.providers,
          default: result.value.default,
        });
      } catch (error) {
        logger.error('[OpenCodeHttp] getProviders failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    listAgents: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          return sendError(res, ctx.error);
        }
        const clientRes = requireClient(ctx.config);
        if (!clientRes.ok) {
          return sendError(res, clientRes.error);
        }

        const result = await clientRes.client.listAgents({ directory: ctx.projectRoot });
        if (!result.ok) {
          return sendError(res, result.error);
        }
        return res.json(result.value);
      } catch (error) {
        logger.error('[OpenCodeHttp] listAgents failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    listPermissions: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          return sendError(res, ctx.error);
        }
        const clientRes = requireClient(ctx.config);
        if (!clientRes.ok) {
          return sendError(res, clientRes.error);
        }

        const [permRes, sessionsRes] = await Promise.all([
          clientRes.client.listPermissions({ directory: ctx.projectRoot }),
          clientRes.client.listSessions({ directory: ctx.projectRoot }),
        ]);
        if (!permRes.ok) {
          return sendError(res, permRes.error);
        }
        if (!sessionsRes.ok) {
          return sendError(res, sessionsRes.error);
        }

        const projectSessionIds = new Set(
          sessionsRes.value
            .filter((s) => isSameCanonicalDirectory(ctx.projectRoot, s.directory))
            .map((s) => s.id),
        );
        return res.json(permRes.value.filter((item) => projectSessionIds.has(item.sessionID)));
      } catch (error) {
        logger.error('[OpenCodeHttp] listPermissions failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    replyPermission: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          return sendError(res, ctx.error);
        }
        const clientRes = requireClient(ctx.config);
        if (!clientRes.ok) {
          return sendError(res, clientRes.error);
        }

        const requestId = req.params?.requestId;
        if (typeof requestId !== 'string' || !PERMISSION_ID_RE.test(requestId)) {
          return sendError(res, { code: 'INVALID_REQUEST', status: 400 });
        }

        const body = req.body as { reply?: unknown; message?: unknown } | undefined;
        if (typeof body?.reply !== 'string' || !ALLOWED_PERMISSION_REPLIES.has(body.reply)) {
          return sendError(res, { code: 'INVALID_REQUEST', status: 400 });
        }

        const pendingRes = await clientRes.client.listPermissions({ directory: ctx.projectRoot });
        if (!pendingRes.ok) {
          return sendError(res, pendingRes.error);
        }
        const target = pendingRes.value.find((item) => item.id === requestId);
        if (!target) {
          return sendError(res, { code: 'FILE_NOT_FOUND', status: 404 });
        }
        const owned = await assertSessionOwnedByProject(
          clientRes.client,
          ctx.projectRoot,
          target.sessionID,
        );
        if (!owned.ok) {
          return sendError(res, { code: 'FILE_NOT_FOUND', status: 404 });
        }

        const result = await clientRes.client.replyPermission({
          requestId,
          directory: ctx.projectRoot,
          body: {
            reply: body.reply as 'once' | 'always' | 'reject',
            ...(typeof body.message === 'string' && { message: body.message }),
          },
        });
        if (!result.ok) {
          return sendError(res, result.error);
        }
        return res.json({ ok: result.value });
      } catch (error) {
        logger.error('[OpenCodeHttp] replyPermission failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    listQuestions: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          return sendError(res, ctx.error);
        }
        const clientRes = requireClient(ctx.config);
        if (!clientRes.ok) {
          return sendError(res, clientRes.error);
        }

        const [qRes, sessionsRes] = await Promise.all([
          clientRes.client.listQuestions({ directory: ctx.projectRoot }),
          clientRes.client.listSessions({ directory: ctx.projectRoot }),
        ]);
        if (!qRes.ok) {
          return sendError(res, qRes.error);
        }
        if (!sessionsRes.ok) {
          return sendError(res, sessionsRes.error);
        }

        const projectSessionIds = new Set(
          sessionsRes.value
            .filter((s) => isSameCanonicalDirectory(ctx.projectRoot, s.directory))
            .map((s) => s.id),
        );
        return res.json(qRes.value.filter((item) => projectSessionIds.has(item.sessionID)));
      } catch (error) {
        logger.error('[OpenCodeHttp] listQuestions failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    replyQuestion: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          return sendError(res, ctx.error);
        }
        const clientRes = requireClient(ctx.config);
        if (!clientRes.ok) {
          return sendError(res, clientRes.error);
        }

        const requestId = req.params?.requestId;
        if (typeof requestId !== 'string' || !QUESTION_ID_RE.test(requestId)) {
          return sendError(res, { code: 'INVALID_REQUEST', status: 400 });
        }

        const body = req.body as { answers?: unknown } | undefined;
        if (
          !Array.isArray(body?.answers) ||
          !body.answers.every(
            (group) => Array.isArray(group) && group.every((item) => typeof item === 'string'),
          )
        ) {
          return sendError(res, { code: 'INVALID_REQUEST', status: 400 });
        }

        const pendingRes = await clientRes.client.listQuestions({ directory: ctx.projectRoot });
        if (!pendingRes.ok) {
          return sendError(res, pendingRes.error);
        }
        const target = pendingRes.value.find((item) => item.id === requestId);
        if (!target) {
          return sendError(res, { code: 'FILE_NOT_FOUND', status: 404 });
        }
        const owned = await assertSessionOwnedByProject(
          clientRes.client,
          ctx.projectRoot,
          target.sessionID,
        );
        if (!owned.ok) {
          return sendError(res, { code: 'FILE_NOT_FOUND', status: 404 });
        }

        const result = await clientRes.client.replyQuestion({
          requestId,
          directory: ctx.projectRoot,
          body: { answers: body.answers as string[][] },
        });
        if (!result.ok) {
          return sendError(res, result.error);
        }
        return res.json({ ok: result.value });
      } catch (error) {
        logger.error('[OpenCodeHttp] replyQuestion failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    rejectQuestion: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          return sendError(res, ctx.error);
        }
        const clientRes = requireClient(ctx.config);
        if (!clientRes.ok) {
          return sendError(res, clientRes.error);
        }

        const requestId = req.params?.requestId;
        if (typeof requestId !== 'string' || !QUESTION_ID_RE.test(requestId)) {
          return sendError(res, { code: 'INVALID_REQUEST', status: 400 });
        }

        const pendingRes = await clientRes.client.listQuestions({ directory: ctx.projectRoot });
        if (!pendingRes.ok) {
          return sendError(res, pendingRes.error);
        }
        const target = pendingRes.value.find((item) => item.id === requestId);
        if (!target) {
          return sendError(res, { code: 'FILE_NOT_FOUND', status: 404 });
        }
        const owned = await assertSessionOwnedByProject(
          clientRes.client,
          ctx.projectRoot,
          target.sessionID,
        );
        if (!owned.ok) {
          return sendError(res, { code: 'FILE_NOT_FOUND', status: 404 });
        }

        const result = await clientRes.client.rejectQuestion({
          requestId,
          directory: ctx.projectRoot,
        });
        if (!result.ok) {
          return sendError(res, result.error);
        }
        return res.json({ ok: result.value });
      } catch (error) {
        logger.error('[OpenCodeHttp] rejectQuestion failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    streamEvents: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          sendError(res, ctx.error);
          return;
        }
        const clientRes = requireClient(ctx.config);
        if (!clientRes.ok) {
          sendError(res, clientRes.error);
          return;
        }

        const rawSessionId = req.query?.sessionId;
        let sessionFilter: string | undefined;
        if (typeof rawSessionId === 'string' && rawSessionId.length > 0) {
          const owned = await assertSessionOwnedByProject(
            clientRes.client,
            ctx.projectRoot,
            rawSessionId,
          );
          if (!owned.ok) {
            sendError(res, owned.error);
            return;
          }
          sessionFilter = owned.session.id;
        }

        await relayOpenCodeEvents({
          req,
          res,
          client: clientRes.client,
          projectRoot: ctx.projectRoot,
          sessionFilter,
        });
      } catch (error) {
        logger.error('[OpenCodeHttp] streamEvents failed', getSafeErrorMetadata(error));
        if (!res.headersSent) {
          sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
        }
      }
    },

    createSessionPrompt: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          return sendError(res, ctx.error);
        }

        const clientRes = requireClient(ctx.config);
        if (!clientRes.ok) {
          return sendError(res, clientRes.error);
        }

        const body = req.body as
          | {
              prompt?: unknown;
              title?: unknown;
              agent?: unknown;
              model?: { providerID?: unknown; modelID?: unknown };
              images?: unknown;
            }
          | undefined;
        if (typeof body?.prompt !== 'string' || body.prompt.trim().length === 0) {
          return sendError(res, { code: 'INVALID_REQUEST', status: 400 });
        }

        const sessionTitle =
          typeof body.title === 'string' && body.title.trim().length > 0
            ? body.title.trim()
            : `${ctx.project.name ?? 'Project'} Task`;

        const model =
          body.model &&
          typeof body.model.providerID === 'string' &&
          typeof body.model.modelID === 'string'
            ? { providerID: body.model.providerID, modelID: body.model.modelID }
            : undefined;
        const callerCheck = await recordActiveLlmCaller(req as AuthenticatedRequest, {
          projectId: ctx.projectId,
          projectRoot: ctx.projectRoot,
        });
        if (!callerCheck.ok) {
          return sendError(res, callerCheck.error);
        }
        if (!isModelAllowedForCaller(model, callerCheck.isPlatformAdmin)) {
          return sendError(res, { code: 'PROVIDER_NOT_ALLOWED', status: 403 });
        }

        const sessionResult = await clientRes.client.createSession({
          directory: ctx.projectRoot,
          body: { title: sessionTitle },
        });
        if (!sessionResult.ok) {
          return sendError(res, sessionResult.error);
        }

        const agent =
          typeof body.agent === 'string' && body.agent.trim().length > 0
            ? body.agent.trim()
            : undefined;

        const imageNotes = await processPromptImages({
          images: body.images,
          userPromptText: body.prompt,
          projectRoot: ctx.projectRoot,
          seatToken: callersByUserId.get(ctx.userId)?.seatToken,
          fetchFn: deps.fetchImpl ?? fetch,
        });

        const promptResult = await clientRes.client.sendPromptAsync({
          sessionId: sessionResult.value.id,
          directory: ctx.projectRoot,
          body: {
            parts: [
              {
                type: 'text',
                text: appendWorkspaceContract(`${body.prompt}${imageNotes}`, {
                  projectId: ctx.projectId,
                  userId: ctx.userId,
                }),
              },
            ],
            ...(model !== undefined && { model }),
            ...(agent !== undefined && { agent }),
          },
        });
        if (!promptResult.ok) {
          return sendError(res, promptResult.error);
        }

        return res.status(202).json({
          session: sessionResult.value,
          project: ctx.project,
          accepted: true,
        });
      } catch (error) {
        logger.error('[OpenCodeHttp] createSessionPrompt failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    getVcs: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          return sendError(res, ctx.error);
        }
        const clientRes = requireClient(ctx.config);
        if (!clientRes.ok) {
          return sendError(res, clientRes.error);
        }

        const [infoRes, statusRes, diffRes] = await Promise.all([
          clientRes.client.getVcsInfo({ directory: ctx.projectRoot }),
          clientRes.client.getVcsStatus({ directory: ctx.projectRoot }),
          clientRes.client.getVcsDiff({ directory: ctx.projectRoot }),
        ]);

        return res.json({
          info: infoRes.ok ? infoRes.value : {},
          status: statusRes.ok ? statusRes.value : [],
          diff: diffRes.ok ? diffRes.value : [],
        });
      } catch (error) {
        logger.error('[OpenCodeHttp] getVcs failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    getPreviewStatus: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          return sendError(res, ctx.error);
        }
        const session = previewManager.getSession(ctx.projectId);
        if (session && session.userId === ctx.userId) {
          res.cookie(getPreviewCookieName(ctx.projectId), session.previewToken, {
            httpOnly: true,
            sameSite: 'lax',
            path: getPreviewProxyBasePath(ctx.projectId),
          });
        }
        const scriptInfo = inspectProjectScripts(ctx.projectRoot);
        return res.json({
          ...previewManager.getPublicStatus(ctx.projectId, ctx.userId),
          ...scriptInfo,
        });
      } catch (error) {
        logger.error('[OpenCodeHttp] getPreviewStatus failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    startPreview: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          return sendError(res, ctx.error);
        }
        const clientRes = requireClient(ctx.config);
        if (!clientRes.ok) {
          return sendError(res, clientRes.error);
        }

        const scriptInfo = inspectProjectScripts(ctx.projectRoot);
        const body = req.body as { command?: unknown; args?: unknown } | undefined;
        let command =
          typeof body?.command === 'string' && body.command.trim().length > 0
            ? body.command.trim()
            : '';
        let args = Array.isArray(body?.args)
          ? body.args.filter((item): item is string => typeof item === 'string')
          : [];

        // If default "npm run dev" was sent but project recommends e.g. "static", "npm run dev:mock", or "node --watch server.mjs", use recommendedCommand
        if (
          !command ||
          (command === 'npm run dev' &&
            scriptInfo.recommendedCommand &&
            scriptInfo.recommendedCommand !== 'npm run dev')
        ) {
          command = scriptInfo.recommendedCommand;
        }

        if (!command) {
          return res.json({
            running: false,
            ptyId: null,
            port: null,
            proxyPath: null,
            command: null,
            logs: [
              'No runnable dev server or HTML entry file was detected in this workspace yet. Ask Satchida Code to build an app or click "Auto-Configure & Run with AI".',
            ],
            ...scriptInfo,
          });
        }

        let session;
        if (command === 'static') {
          session = await previewManager.startStaticPreview({
            projectId: ctx.projectId,
            userId: ctx.userId,
            projectRoot: ctx.projectRoot,
            client: clientRes.client,
          });
        } else {
          if (args.length === 0 && command.includes(' ')) {
            const parts = command.split(/\s+/).filter(Boolean);
            command = parts[0];
            args = parts.slice(1);
          }

          const password = resolvePassword() ?? '';
          session = await previewManager.startPreview({
            projectId: ctx.projectId,
            userId: ctx.userId,
            projectRoot: ctx.projectRoot,
            command,
            args,
            baseUrl: ctx.config.baseUrl,
            password,
            client: clientRes.client,
            createUpstreamWebSocket: deps.createUpstreamWebSocket,
          });
        }

        if (!session) {
          return sendError(res, { code: 'UPSTREAM_ERROR', status: 502 });
        }

        res.cookie(getPreviewCookieName(ctx.projectId), session.previewToken, {
          httpOnly: true,
          sameSite: 'lax',
          path: getPreviewProxyBasePath(ctx.projectId),
        });

        return res.json({
          ...previewManager.getPublicStatus(ctx.projectId, ctx.userId),
          ...scriptInfo,
        });
      } catch (error) {
        logger.error('[OpenCodeHttp] startPreview failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    stopPreview: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          return sendError(res, ctx.error);
        }
        const clientRes = requireClient(ctx.config);
        if (!clientRes.ok) {
          return sendError(res, clientRes.error);
        }

        const stopped = await previewManager.stopPreview({
          projectId: ctx.projectId,
          userId: ctx.userId,
          client: clientRes.client,
        });
        res.clearCookie(getPreviewCookieName(ctx.projectId), {
          path: getPreviewProxyBasePath(ctx.projectId),
        });
        return res.json({ stopped });
      } catch (error) {
        logger.error('[OpenCodeHttp] stopPreview failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    proxyPreview: async (req: Request, res: Response) => {
      try {
        const projectId = req.params?.projectId;
        if (typeof projectId !== 'string' || projectId.length === 0) {
          sendError(res, { code: 'INVALID_REQUEST', status: 400 });
          return;
        }

        const cookieName = getPreviewCookieName(projectId);
        const cookieVal =
          req.cookies && typeof req.cookies[cookieName] === 'string'
            ? (req.cookies[cookieName] as string)
            : undefined;

        let session = previewManager.verifyPreviewCookie(projectId, cookieVal);
        let verifiedUserId: string | null = session?.userId ?? null;

        if (!verifiedUserId && deps.verifyJwt) {
          const authHeader = req.headers.authorization;
          const authValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
          const bearerToken =
            typeof authValue === 'string' && /^Bearer\s+/i.test(authValue)
              ? authValue.replace(/^Bearer\s+/i, '').trim()
              : undefined;
          const cookieRefresh =
            req.cookies && typeof req.cookies.refreshToken === 'string'
              ? (req.cookies.refreshToken as string)
              : undefined;
          const candidateToken = bearerToken || cookieRefresh;

          if (candidateToken) {
            try {
              const verified = deps.verifyJwt(candidateToken);
              if (verified?.id) {
                verifiedUserId = verified.id;
                const candidate = previewManager.getSession(projectId);
                if (candidate && candidate.userId === verified.id) {
                  session = candidate;
                }
              }
            } catch {
              verifiedUserId = null;
            }
          }
        }

        if (!verifiedUserId) {
          sendError(res, { code: 'OPENCODE_UNAUTHORIZED', status: 401 });
          return;
        }

        const project = await deps.getChatProject(verifiedUserId, projectId);
        if (!project) {
          sendError(res, { code: 'PROJECT_NOT_FOUND', status: 404 });
          return;
        }

        // Self-healing auto-start if preview server is not running (e.g. after service restart)
        if (!session || session.port === null) {
          const config = await loadResolvedConfig(deps, {
            user: { id: verifiedUserId },
          } as AuthenticatedRequest);
          const rootRes = resolveProjectRoot(project, config.allowedRoots);
          const password = resolvePassword() ?? '';
          if (config.enabled && rootRes.ok) {
            const scriptInfo = inspectProjectScripts(rootRes.value);
            if (scriptInfo.recommendedCommand === 'static') {
              const clientRes = requireClient(config);
              session = await previewManager.startStaticPreview({
                projectId,
                userId: verifiedUserId,
                projectRoot: rootRes.value,
                client: clientRes.ok ? clientRes.client : undefined,
              });
            } else if (scriptInfo.recommendedCommand && password) {
              const clientRes = requireClient(config);
              if (clientRes.ok) {
                const parts = scriptInfo.recommendedCommand.split(/\s+/).filter(Boolean);
                const cmd = parts[0];
                const args = parts.slice(1);
                session = await previewManager.startPreview({
                  projectId,
                  userId: verifiedUserId,
                  projectRoot: rootRes.value,
                  command: cmd,
                  args,
                  baseUrl: config.baseUrl,
                  password,
                  client: clientRes.client,
                  createUpstreamWebSocket: deps.createUpstreamWebSocket,
                });
              }
            }
          }
        }

        if (!session) {
          sendError(res, { code: 'UPSTREAM_UNAVAILABLE', status: 503 });
          return;
        }

        res.cookie(cookieName, session.previewToken, {
          httpOnly: true,
          sameSite: 'lax',
          path: getPreviewProxyBasePath(projectId),
        });

        proxyOpenCodePreviewRequest(req, res, session, () => {
          previewManager.invalidateSession(projectId);
        });
      } catch (error) {
        logger.error('[OpenCodeHttp] proxyPreview failed', getSafeErrorMetadata(error));
        if (!res.headersSent) {
          sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
        }
      }
    },

    provisionWorkspace: async (req: Request, res: Response) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const userId = getUserId(authReq);
        if (!userId) {
          return sendError(res, { code: 'OPENCODE_UNAUTHORIZED', status: 401 });
        }

        const config = await loadResolvedConfig(deps, authReq);
        if (!config.enabled) {
          return sendError(res, { code: 'OPENCODE_DISABLED', status: 403 });
        }

        const projectId = req.params?.projectId;
        if (typeof projectId !== 'string' || projectId.length === 0) {
          return sendError(res, { code: 'INVALID_REQUEST', status: 400 });
        }

        const project = await deps.getChatProject(userId, projectId);
        if (!project) {
          return sendError(res, { code: 'PROJECT_NOT_FOUND', status: 404 });
        }

        const existing = resolveProjectRoot(project, config.allowedRoots);
        if (existing.ok) {
          if (deps.updateChatProject && project.localPath !== existing.value) {
            await deps.updateChatProject(userId, projectId, { localPath: existing.value });
          }
          return res.json({ localPath: existing.value, created: false });
        }

        const ensured = ensureProjectWorkspace(projectId, project.name, config.allowedRoots, {
          userId,
          username: authReq.user?.username,
          email: authReq.user?.email,
        });
        if (!ensured.ok) {
          return sendError(res, ensured.error);
        }

        if (deps.updateChatProject) {
          await deps.updateChatProject(userId, projectId, { localPath: ensured.value });
        }

        return res.json({ localPath: ensured.value, created: true });
      } catch (error) {
        logger.error('[OpenCodeHttp] provisionWorkspace failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },

    proxyLlmToGateway: async (req: Request, res: Response) => {
      try {
        const expectedVk = process.env.SATCHIDA_GATEWAY_VK || '';
        const authHeader = req.headers.authorization;
        const incomingBearer =
          typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';

        if (!expectedVk || incomingBearer !== expectedVk) {
          sendError(res, { code: 'OPENCODE_UNAUTHORIZED', status: 401 });
          return;
        }

        const gatewayBase = (
          process.env.SATCHIDA_AUTOROUTER_BASE_URL || 'http://127.0.0.1:4000/v1'
        ).replace(/\/+$/, '');
        const subPath = req.path.replace(/^\/+/, '');
        const targetUrl = `${gatewayBase}/${subPath}`;

        const bodyStr = req.body ? JSON.stringify(req.body) : '';
        let caller: SeatCallerRecord | null | undefined = null;

        // 1. Deterministic concurrent multi-user lookup via embedded Satchida-Context tag
        const ctxMatch = /\[Satchida-Context:\s*projectId=([^\s\]]+)\s+userId=([^\s\]]+)\]/i.exec(
          bodyStr,
        );
        if (ctxMatch) {
          caller = callersByUserId.get(ctxMatch[2]) ?? callersByProjectId.get(ctxMatch[1]);
        }

        // 2. Fallback concurrent lookup by matching canonical project directory in system prompt
        if (!caller && bodyStr.length > 0 && callersByProjectRoot.size > 0) {
          const lowerBody = bodyStr.toLowerCase();
          for (const [rootKey, rec] of callersByProjectRoot.entries()) {
            const escapedRoot = rootKey.replace(/\\/g, '\\\\');
            if (lowerBody.includes(rootKey) || lowerBody.includes(escapedRoot)) {
              caller = rec;
              break;
            }
          }
        }

        // 3. Fallback to most recent active caller
        if (!caller) {
          caller = activeLlmCaller;
        }
        if (process.env.SATCHIDA_TENANT_MODE === 'true' && !caller?.seatToken) {
          sendError(res, { code: 'OPENCODE_UNAUTHORIZED', status: 403 });
          return;
        }

        // Privacy Mode & Tier Enforcement:
        // When user is on privacy tier OR privacy mode is requested, route STRICTLY
        // to the local llama.cpp fleet on 127.0.0.1:8080 (zero cloud/gateway routing).
        const isPrivacyTier = caller?.accountType?.toLowerCase() === 'privacy';
        const isPrivacyMode =
          req.headers['x-satchida-mode']?.toString().toLowerCase() === 'privacy' || isPrivacyTier;

        let upstreamTargetUrl = targetUrl;
        let upstreamHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caller?.seatToken || expectedVk}`,
          'X-Satchida-Mode': isPrivacyMode ? 'Privacy' : 'Vibecoding',
          'X-Tenant-Id': caller?.tenantId || 'satchida-master',
        };

        if (isPrivacyMode) {
          const llamaBase = (
            process.env.SATCHIDA_LLAMA_BASE_URL || 'http://127.0.0.1:8080/v1'
          ).replace(/\/+$/, '');
          upstreamTargetUrl = `${llamaBase}/${subPath}`;
          upstreamHeaders = {
            'Content-Type': 'application/json',
            ...(caller?.seatToken ? { Authorization: `Bearer ${caller.seatToken}` } : {}),
            'X-Satchida-Privacy-Local': 'true',
            'X-Satchida-Mode': 'Privacy',
          };
        }

        const fetchFn = deps.fetchImpl ?? fetch;
        const isGetOrHead = req.method === 'GET' || req.method === 'HEAD';
        const upstreamRes = await fetchFn(upstreamTargetUrl, {
          method: req.method,
          headers: upstreamHeaders,
          ...(!isGetOrHead && req.body ? { body: JSON.stringify(req.body) } : {}),
        });

        res.status(upstreamRes.status);
        const contentType = upstreamRes.headers.get('content-type');
        if (contentType) {
          res.setHeader('Content-Type', contentType);
        }

        if (!upstreamRes.body) {
          const text = await upstreamRes.text();
          res.send(text);
          return;
        }

        const reader = upstreamRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          res.write(Buffer.from(value));
        }
        res.end();
      } catch (error) {
        logger.error('[OpenCodeHttp] proxyLlmToGateway failed', getSafeErrorMetadata(error));
        if (!res.headersSent) {
          sendError(res, { code: 'UPSTREAM_UNAVAILABLE', status: 502 });
        } else {
          res.end();
        }
      }
    },

    readUrlContent: async (req: Request, res: Response) => {
      try {
        const rawUrl = typeof req.query?.url === 'string' ? req.query.url.trim() : '';
        if (!rawUrl) {
          return sendError(res, { code: 'INVALID_REQUEST', status: 400 });
        }
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(rawUrl);
        } catch {
          return sendError(res, { code: 'INVALID_REQUEST', status: 400 });
        }
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          return sendError(res, { code: 'INVALID_REQUEST', status: 400 });
        }
        const host = parsedUrl.hostname.toLowerCase();
        if (
          host === 'localhost' ||
          host === '127.0.0.1' ||
          host === '0.0.0.0' ||
          host === '::1' ||
          host.startsWith('10.') ||
          host.startsWith('192.168.') ||
          host.startsWith('169.254.') ||
          /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)
        ) {
          return sendError(res, { code: 'PATH_OUTSIDE_ROOT', status: 403 });
        }

        const fetchFn = deps.fetchImpl ?? fetch;
        const upstream = await fetchFn(parsedUrl.toString(), {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          },
          redirect: 'follow',
        });
        const body = await upstream.text();
        const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(body);
        const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';
        const descMatch =
          /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i.exec(body) ||
          /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i.exec(body);
        const description = descMatch ? descMatch[1].trim() : '';

        const links: Array<{ text: string; href: string }> = [];
        const linkRe = /<a\s[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
        let lMatch: RegExpExecArray | null;
        while ((lMatch = linkRe.exec(body)) !== null && links.length < 50) {
          const href = lMatch[1].trim();
          const text = lMatch[2]
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (href && text) {
            links.push({ text: text.slice(0, 140), href });
          }
        }

        const embeddedJson: unknown[] = [];
        const ldRe =
          /<script[^>]+(?:type=["']application\/(?:ld\+)?json["']|id=["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script>/gi;
        let jMatch: RegExpExecArray | null;
        while ((jMatch = ldRe.exec(body)) !== null && embeddedJson.length < 5) {
          try {
            embeddedJson.push(JSON.parse(jMatch[1].trim()));
          } catch {
            /* ignore non-json script */
          }
        }

        const cleanText = body
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 12_000);

        return res.json({
          ok: true,
          url: parsedUrl.toString(),
          status: upstream.status,
          title,
          description,
          linksCount: links.length,
          links,
          embeddedJson,
          text: cleanText,
        });
      } catch (error) {
        logger.error('[OpenCodeHttp] readUrlContent failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'UPSTREAM_UNAVAILABLE', status: 502 });
      }
    },

    exportProjectZip: async (req: Request, res: Response) => {
      try {
        const ctx = await resolveRequestContext(req as AuthenticatedRequest);
        if (!ctx.ok) {
          return sendError(res, ctx.error);
        }

        const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage']);
        const zipEntries: Array<{ name: string; data: Buffer }> = [];
        const maxTotalBytes = 25 * 1024 * 1024;
        let totalBytes = 0;

        function walk(dir: string, relPrefix: string) {
          let entries: fs.Dirent[];
          try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
          } catch {
            return;
          }
          for (const entry of entries) {
            if (totalBytes >= maxTotalBytes || zipEntries.length >= 400) {
              return;
            }
            if (entry.name.startsWith('.env') && entry.name !== '.env.example') {
              continue;
            }
            const fullPath = path.join(dir, entry.name);
            const relName = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
              if (!SKIP_DIRS.has(entry.name)) {
                walk(fullPath, relName);
              }
            } else if (entry.isFile()) {
              try {
                const st = fs.statSync(fullPath);
                if (st.size <= 2 * 1024 * 1024 && totalBytes + st.size <= maxTotalBytes) {
                  const data = fs.readFileSync(fullPath);
                  totalBytes += data.length;
                  zipEntries.push({ name: relName, data });
                }
              } catch {
                /* skip unreadable file */
              }
            }
          }
        }

        walk(ctx.projectRoot, '');
        const zipBuffer = buildUncompressedZipBuffer(zipEntries);
        const safeSlug =
          (ctx.project.name ?? 'project')
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'project';

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${safeSlug}.zip"`);
        res.setHeader('Content-Length', String(zipBuffer.length));
        return res.status(200).send(zipBuffer);
      } catch (error) {
        logger.error('[OpenCodeHttp] exportProjectZip failed', getSafeErrorMetadata(error));
        return sendError(res, { code: 'INTERNAL_ERROR', status: 500 });
      }
    },
  };
}
