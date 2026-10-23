/**
 * Satchida gateway — SUPERSEDED.
 *
 * This service was the inference front door and the enforcement point. It is no
 * longer in the request path, and nothing starts it any more: `fleet/scripts/
 * dev-gateway.mjs` now starts the Privacy router instead.
 *
 * WHERE EACH DUTY WENT
 * --------------------
 *   licence / seat cap / spend cap  →  One-API (`:4000`), which resolves the
 *                                      per-seat `tk_` token, intersects the
 *                                      seat, group and token allowlists, and
 *                                      counts the tokens it bills
 *   provider key custody            →  Bifrost (`:8700`), behind a virtual key
 *   model selection                →  the Node router (`:4001`)
 *   prompt-injection shield         →  the Node router (`:4001`),
 *                                      `satchida/router/src/shield.mjs`
 *   identity prompt and date        →  the Node router (`:4001`)
 *   local Privacy inference        →  the Privacy router (`:4099`),
 *                                      `fleet/src/privacy/router.mjs`, which
 *                                      verifies the seat assertion, enforces
 *                                      the fair-use ladder and applies the
 *                                      child safety controls
 *
 * The source is kept because its tests still document the enforcement behaviour
 * that was migrated, and because a reader comparing the two will want to see
 * what moved. It must not be started.
 *
 * The original description follows.
 *
 * Satchida gateway — the enforcement point.
 *
 * Every cloud inference request crosses this service. It is the only place where
 * a provider API key exists in plaintext, and the only place where entitlement
 * is decided. A client may tamper with anything on its own machine; nothing it
 * does there reaches this service without satisfying the checks below.
 *
 * Enforcement, in order:
 *   1. licence token valid, unexpired, bound to this client   (Ed25519)
 *   2. seat cap not exceeded
 *   3. spend/balance cap not exhausted
 *   4. provider key unwrapped in memory, used, wiped
 *
 * No provider key ever reaches the client, a model context, or a log line.
 */
import { createServer } from 'node:http';
import { verifyLicence, authorise } from './licence.mjs';
import { openSecret, loadMasterKey, redact } from './keystore.mjs';
import { resolveModel, hasImageContent, asMode, createCatalogueReader, identityPrompt, dateContext } from './models.mjs';
import { inspectMessages, hasRoleInjection, ASSISTANT_NAME } from './shield.mjs';
import { verifyPrivacyAssertion } from './privacy/router.mjs';

const PORT = Number(process.env.SATCHIDA_GATEWAY_PORT ?? 4000);
const HOST = process.env.SATCHIDA_GATEWAY_HOST ?? '127.0.0.1';

/** Injected so the enforcement logic is testable without a keyring or network. */
export function createGateway({
  publicKey,
  keys = { recordFor: () => undefined, reveal: null },
  spend = { balanceFor: () => ({ creditsRemaining: Infinity }) },
  seats = { inUseFor: () => 0 },
  fetchImpl = fetch,
  masterKey = null,
  upstreams = defaultUpstreams(keys, process.env),
  env = process.env,
  readCatalogue = createCatalogueReader({ fetchImpl }),
  privacyRouter = null,
} = {}) {
  // Default to the real keyring; tests inject `keys.reveal` instead.
  const open = keys.reveal ?? ((record, mk) => openSecret(record, mk ?? loadMasterKey()));
  const mk = masterKey ?? (keys.reveal ? null : loadMasterKey());
  void keys;

  async function handle(req, res, url) {
    const send = (status, body) => {
      const payload = JSON.stringify(body);
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(payload);
    };

    // Pass-through to Satchida Router dashboard & roster management
    if (url.pathname === '/dashboard' || url.pathname === '/roster' || url.pathname.startsWith('/api/roster')) {
      try {
        const routerUrl = `http://127.0.0.1:4001${url.pathname}${url.search}`;
        const routerResp = await fetchImpl(routerUrl, {
          method: req.method,
          headers: req.headers,
          body: ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req),
        });
        const cType = routerResp.headers.get('content-type') || 'text/html';
        res.writeHead(routerResp.status, { 'content-type': cType });
        const buf = Buffer.from(await routerResp.arrayBuffer());
        return res.end(buf);
      } catch (e) {
        return send(502, { error: 'router_dashboard_unavailable', detail: e.message });
      }
    }

    // ---- 1. licence -----------------------------------------------------
    // LibreChat sends the endpoint apiKey as a standard bearer credential.
    // Accept that first, then our dedicated header, then an explicit query param.
    const authz = req.headers.authorization;
    const bearer =
      typeof authz === 'string' && authz.toLowerCase().startsWith('bearer ')
        ? authz.slice(7).trim()
        : null;
    const licenceToken = bearer || req.headers['x-satchida-licence'] || url.searchParams.get('licence');
    if (!licenceToken) return send(401, { error: 'no_licence', detail: 'licence token required' });

    const verdict = verifyLicence(licenceToken, publicKey);

    // Privacy traffic carries a Privacy ASSERTION rather than a licence.
    //
    // The assertion is a stricter credential than the licence: it is bound to a
    // tenant, a seat, a profile and a mode, while the licence only says which
    // client is licensed and how many seats it may hold. So for Privacy the
    // assertion is the authoritative credential and the router does the real
    // verification; the gateway's job is only to route it there.
    //
    // A licence still has to be present for the client to exist, so a Privacy
    // request with neither credential is refused exactly as before.
    const wantsPrivacy = (url.searchParams.get('provider') || 'local') === 'privacy';
    if (!verdict.valid) {
      if (wantsPrivacy && privacyRouter && bearer) {
        // The router performs the authoritative verification, including the replay
        // check. The gateway only needs to know the request is addressed to
        // Privacy and carries a credential the operator signed, and it does not
        // consume the jti, so the router still sees it as unused.
        try {
          verifyPrivacyAssertion(bearer, {
            publicKeys: privacyRouter.publicKeys,
            audience: privacyRouter.audience,
            tenantId: privacyRouter.tenantId,
            now: Math.floor(Date.now() / 1000),
          });
        } catch (err) {
          return send(401, { error: 'licence_invalid', detail: redact(err?.message) });
        }
      } else {
        return send(401, { error: 'licence_invalid', detail: verdict.reason });
      }
    }
    const clientId = verdict.valid ? verdict.payload.cid : 'privacy-tenant';

    // ---- 0. Models Catalogue Intercept (POST-LICENCE) -------------------
    // Prevents leakage of internal provider model names (Together, TokenHarbor, etc.)
    // Returns strictly the licensed, branded modes: Chat, Work, Study, Privacy.
    // For coding environments (like VS Code / Cline), Chat is excluded as it is
    // not relevant to the IDE context.
    // Gated behind the licence verdict so an unauthenticated probe (or a raw
    // scanner hitting the public ingress) gets 401 and never the alias list.
    if (url.pathname === '/v1/models' && req.method === 'GET') {
      const isCodeClient = req.headers['x-satchida-client'] === 'vscode' ||
                           (req.headers['user-agent'] && /vscode|code-server|cline|continue/i.test(req.headers['user-agent']));
      const allowedModes = isCodeClient ? ['Work', 'Study', 'Privacy'] : ['Work', 'Chat', 'Privacy', 'Study'];
      return send(200, {
        object: 'list',
        data: allowedModes.map(id => ({
          id,
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: 'satchida'
        }))
      });
    }

    // ---- Privacy mode ---------------------------------------------------
    //
    // Privacy is served by the Privacy router, not forwarded to the bare local
    // runtime. The router is the only component that verifies the operator's
    // signed assertion, enforces the fair-use ladder and applies the child
    // safety controls. Forwarding Privacy straight to llama.cpp would bypass all
    // three, which is the failure this separation exists to prevent.
    //
    // This branch sits BEFORE the licence caps because Privacy carries a
    // different credential. The seat and balance caps are the operator's
    // commercial enforcement; Privacy is a flat-rate local feature, so the
    // binding constraint there is the tenant's own GPU, which the router
    // enforces through the fair-use ladder. The licence gate above has already
    // established that the caller presented a credential the operator signed.
    if (wantsPrivacy) {
      if (!privacyRouter) {
        return send(503, { error: 'privacy_unavailable', code: 'privacy_router_not_configured' });
      }
      return forwardToPrivacyRouter(req, res, url);
    }

    // ---- 2 & 3. caps ----------------------------------------------------
    const decision = authorise({
      payload: verdict.payload,
      clientId,
      seatsInUse: seats.inUseFor(clientId),
      spend: spend.balanceFor(clientId),
    });
    if (!decision.allowed) {
      return send(402, { error: decision.code, seatsRemaining: decision.seatsRemaining ?? 0 });
    }

    // ---- 4. upstream ----------------------------------------------------
    // Local inference needs no credential, but it still transits this service so
    // that seat and balance caps apply to Privacy mode as well. Routing it here
    // rather than direct is deliberate: otherwise Privacy mode would be the one
    // path with no enforcement at all.
    // Local-first: the default route is the local inference server. Cloud routing
    // is opt-in per request AND requires a sealed key for that client, so it can
    // never be reached by accident or by a client flipping a local setting.
    const satchidaClient = req.headers['x-satchida-client'];
    const provider = satchidaClient ? 'satchida-router' : (url.searchParams.get('provider') || 'local');

    const target = upstreams.resolve(provider, clientId);
    if (!target) {
      return send(503, { error: 'no_route_for_provider', provider });
    }

    let secret = null;
    if (target.record) {
      try {
        secret = open(target.record, mk);
      } catch (err) {
        // never surface key material, even in an error path
        return send(500, { error: 'key_unavailable', detail: redact(err.message) });
      }
    }

    const headers = { 'content-type': req.headers['content-type'] ?? 'application/json' };
    if (secret) headers.authorization = `Bearer ${secret.toString('utf8')}`;
    // Forward Satchida headers to the router so it can apply per-client overrides.
    if (satchidaClient) {
      headers['x-satchida-client'] = satchidaClient;
    }

    try {
      const isTranscription = req.method === 'POST' && url.pathname === '/v1/audio/transcriptions';
      const rawBody = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req);

      // ---- 5. model resolution -------------------------------------------
      // LibreChat sends a display label (Chat/Work/Study/Privacy). The upstream
      // only knows its own GGUF aliases. Translating here — after the caps, so
      // nothing bypasses enforcement — is what makes chat work at all.
      const upstreamUrl = isTranscription
        ? new URL('/v1/audio/transcriptions', target.baseUrl).toString()
        : target.baseUrl + url.pathname.replace(/^\/v1/, '');
      // ---- 6. prompt-injection shield -------------------------------------
      // Runs AFTER the licence and cap checks (so an unauthenticated caller is
      // still refused with 401 and never learns the filter exists) and BEFORE
      // the upstream call, so a request aimed at the model or at our own
      // configuration never leaves the machine.
      if (!isTranscription) {
        const verdict = screenBody(rawBody, env);
        if (verdict.blocked) {
          // LibreChat always asks for SSE (`addParams: stream: true`), so a
          // plain JSON body would not render. Answering in the same shape as the
          // upstream keeps the chat UI on its normal path.
          return wantsStream(rawBody)
            ? sendStream(res, verdict.answer)
            : send(200, chatCompletion(verdict.answer));
        }
      }

      // Skip model translation for satchida-router — the router resolves mode
      // labels itself (clientOverrides, client modeOrder, etc.). Forward the
      // body as-is so the router receives the original Chat/Work/Study/Privacy
      // label and applies its own selection logic.
      const outboundBody =
        provider === 'satchida-router'
          ? null
          : await translateModel(rawBody, { env, readCatalogue, baseUrl: target.baseUrl });

      const upstream = await fetchImpl(upstreamUrl, {
        method: req.method,
        headers,
        body: outboundBody ?? rawBody,
        duplex: 'half',
      });

      if (isTranscription && !upstream.ok) {
        return send(upstream.status, { error: 'STT upstream error', code: 'stt_upstream_error' });
      }

      const contentType = upstream.headers.get('content-type') ?? 'application/json';

      /**
       * Stream the response through instead of buffering it.
       *
       * Buffering made every reply feel broken: LibreChat asked for SSE, and the
       * user watched an empty box for the whole generation before a single token
       * appeared. Measured on this machine, a 150-word answer arrived in one lump
       * after ~10s where the upstream had produced its first token at ~6s. A
       * streamed body keeps the UI responsive and, on a local model, is the
       * difference between "it is thinking" and "it is hung".
       *
       * `upstream.body` is absent in the injected-`fetchImpl` tests, so those
       * still take the buffered path.
       */
      if (upstream.body && typeof upstream.body.getReader === 'function') {
        res.writeHead(upstream.status, { 'content-type': contentType });
        try {
          for await (const chunk of upstream.body) {
            if (!res.write(Buffer.from(chunk))) {
              // Respect backpressure so a slow client cannot balloon memory.
              await new Promise((resolve) => res.once('drain', resolve));
            }
          }
        } catch {
          // A client that navigated away mid-stream is normal, not an error worth
          // a 5xx: the headers are already sent, so just stop cleanly.
          if (!res.writableEnded) res.end();
        }
        if (!res.writableEnded) res.end();
        return;
      }

      const body = Buffer.from(await upstream.arrayBuffer());
      res.writeHead(upstream.status, { 'content-type': contentType });
      res.end(body);
    } catch (err) {
      const isTranscription = req.method === 'POST' && url.pathname === '/v1/audio/transcriptions';
      if (isTranscription) {
        return send(503, { error: 'STT service unavailable', code: 'stt_unavailable' });
      }
      send(502, { error: 'upstream_failed', detail: redact(err?.message) });
    } finally {
      // The key is wiped whether the call succeeded, failed, or threw.
      secret?.fill?.(0);
    }
  }

  /**
   * Forward a Privacy request to the Privacy router.
   *
   * The assertion is carried in the Authorization header and is consumed by the
   * router, which is what makes the request attributable to a named seat. The
   * body is forwarded untouched: the router applies the child safety system
   * prompt itself, because that prompt has to be inside the body the model
   * actually receives.
   */
  async function forwardToPrivacyRouter(req, res, url) {
    const rawBody = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req);
    const routerUrl = new URL(url.pathname + url.search, privacyRouter.baseUrl).toString();
    const headers = {
      'content-type': req.headers['content-type'] ?? 'application/json',
      accept: req.headers.accept ?? 'application/json',
    };
    const authorization = req.headers.authorization;
    if (authorization) headers.authorization = authorization;

    try {
      const upstream = await fetchImpl(routerUrl, {
        method: req.method,
        headers,
        body: rawBody,
        duplex: 'half',
      });
      const contentType = upstream.headers.get('content-type') ?? 'application/json';
      // The router's fair-use headers are passed through so the client can show
      // a queue position and a resume time rather than a bare 429.
      const passthrough = {};
      for (const name of [
        'x-satchida-queue-position',
        'x-satchida-fair-use-tier',
        'x-satchida-mode',
        'retry-after',
      ]) {
        const value = upstream.headers.get(name);
        if (value) passthrough[name] = value;
      }
      res.writeHead(upstream.status, { 'content-type': contentType, ...passthrough });
      if (!upstream.body) return res.end();
      for await (const chunk of upstream.body) {
        if (!res.write(Buffer.from(chunk))) {
          await new Promise((resolve) => res.once('drain', resolve));
        }
      }
      if (!res.writableEnded) res.end();
    } catch (err) {
      send(503, { error: 'privacy_unavailable', code: 'privacy_router_unreachable', detail: redact(err?.message) });
    }
  }

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    handle(req, res, url).catch((err) => {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'gateway_error', detail: redact(err?.message) }));
    });
  });

  // listen(port = 0) binds an ephemeral port; tests use the returned address.
  const listen = (port = PORT, host = HOST) =>
    new Promise((resolve) => server.listen(port, host, () => resolve(server.address())));

  // closeAllConnections() matters: undici keeps connections alive, so a bare
  // server.close() would wait forever and hang the test runner.
  const close = () =>
    new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections?.();
    });

  return { server, listen, close };
}

/**
 * Resolve a provider name to an upstream. `local` is a fixed base URL with no
 * credential; everything else must have a sealed record.
 *
 * `privacy` is deliberately absent. Privacy traffic must carry an operator-signed
 * assertion and pass the fair-use gate, so it is served by the Privacy router
 * rather than forwarded to the bare local runtime. Sending it straight to
 * llama.cpp would bypass the assertion, the replay protection and the child
 * safety checks, which is the whole reason the router exists.
 */
export function defaultUpstreams(keys, env = {}) {
  const localBaseUrl = env.SATCHIDA_LOCAL_URL || 'http://127.0.0.1:8080';
  const routerBaseUrl = env.SATCHIDA_ROUTER_URL || 'http://127.0.0.1:4001/v1';
  return {
    resolve(provider, clientId) {
      if (provider === 'satchida-router') {
        return { baseUrl: routerBaseUrl, record: null };
      }
      if (provider === 'local') {
        return { baseUrl: localBaseUrl, record: null };
      }
      const record = keys.recordFor?.(clientId, provider);
      if (!record) return null;
      return { baseUrl: record.baseUrl || env.SATCHIDA_CLOUD_URL, record };
    },
  };
}

/**
 * Rewrite a mode label in a JSON request body to a concrete upstream model id.
 *
 * Returns null when there is nothing to do — non-JSON bodies (multipart audio),
 * bodies that do not parse, and requests naming a real model id are forwarded
 * byte-for-byte. Failing open here is deliberate: a translation bug must not
 * turn a working direct-model request into a gateway error.
 */
async function translateModel(rawBody, { env, readCatalogue, baseUrl }) {
  if (!rawBody || rawBody.length === 0) return null;
  let parsed;
  try {
    parsed = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  // The identity rule applies to EVERY chat request, including agents and the
  // memory extractor — those are exactly the paths that ask a model to describe
  // itself. It does not apply to embeddings or audio, which carry no messages.
  let body = withIdentityPrompt(parsed, env);

  // Model resolution only applies to our mode labels. A real model id passes
  // through untouched, so the gateway stays a working pass-through.
  const mode = asMode(parsed.model);
  if (mode !== null) {
    const available = await readCatalogue(baseUrl);
    const resolved = resolveModel({
      model: parsed.model,
      available,
      env,
      needsVision: hasImageContent(parsed.messages),
    });
    if (resolved.model !== parsed.model) {
      body = { ...body, model: resolved.model };
    }
  }

  if (body === parsed) return null;
  return Buffer.from(JSON.stringify(body), 'utf8');
}

/** Answer for a message trying to open a new privileged turn for itself. */
const ROLE_INJECTION_ANSWER = "I'm Satchida SI. Send me a task and I'll help with it.";

/**
 * Inspect a raw request body and decide whether to answer locally.
 *
 * Fail-open by design: a body that does not parse, or a non-JSON body, is not
 * screened here — it is forwarded as before. A screen that could itself throw
 * would turn a filter failure into an outage.
 */
function screenBody(rawBody, env) {
  if (env?.SATCHIDA_SHIELD === 'off') return { blocked: false };
  if (!rawBody || rawBody.length === 0) return { blocked: false };
  let parsed;
  try {
    parsed = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return { blocked: false };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { blocked: false };
  if (hasRoleInjection(parsed.messages)) {
    return { blocked: true, kind: 'role_injection', answer: ROLE_INJECTION_ANSWER };
  }
  return inspectMessages({ messages: parsed.messages });
}

/** Did the caller ask for a streamed response? */
function wantsStream(rawBody) {
  if (!rawBody) return false;
  try {
    return JSON.parse(rawBody.toString('utf8'))?.stream === true;
  } catch {
    return false;
  }
}

/**
 * The local answer, delivered as SSE so the streaming client renders it.
 *
 * Field-for-field the shape llama.cpp sends, because the client reads
 * `delta.tool_calls` on every chunk — omitting it is what made the first
 * version crash the UI.
 */
function sendStream(res, content) {
  const id = `chatcmpl-shield-${Date.now().toString(36)}`;
  const created = Math.floor(Date.now() / 1000);
  const base = { id, object: 'chat.completion.chunk', created, model: ASSISTANT_NAME };
  const chunks = [
    { ...base, choices: [{ index: 0, delta: { role: 'assistant', content: '', tool_calls: null }, logprobs: null, finish_reason: null }] },
    { ...base, choices: [{ index: 0, delta: { content, tool_calls: null }, logprobs: null, finish_reason: null }] },
    { ...base, choices: [{ index: 0, delta: {}, logprobs: null, finish_reason: 'stop' }] },
  ];
  const payload = `${chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('')}data: [DONE]\n\n`;
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });
  res.end(payload);
}

/**
 * A non-streamed chat completion the client can render.
 *
 * This must match what llama.cpp actually returns, field for field, and not a
 * minimal shape. The first version omitted `tool_calls` and the LibreChat client
 * crashed on it — "Cannot use 'in' operator to search for 'tool_calls' in
 * undefined" — rendering a red error box instead of the answer. An API probe
 * would have passed: the response was a valid 200 with the right text. Only
 * clicking the UI showed it.
 */
function chatCompletion(content) {
  return {
    id: `chatcmpl-shield-${Date.now().toString(36)}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: ASSISTANT_NAME,
    system_fingerprint: 'fp_shield',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content, tool_calls: null },
        logprobs: null,
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      prompt_tokens_details: { cached_tokens: 0 },
    },
  };
}

/**
 * Put the identity rule first in the conversation.
 *
 * It is PREPENDED even when the caller already sent a system message, and that
 * ordering is the whole point. LibreChat always sends one — the agent/memory
 * system prompt — so a "only if absent" rule silently never fires, and the model
 * answers "I am Qwen". An earlier version did exactly that and the browser still
 * leaked the vendor name while a direct API probe looked clean, which is the
 * failure the standing browser-verification directive exists to catch.
 *
 * Prepending rather than merging keeps an agent's authored instructions intact:
 * they still apply, they just no longer get to be the first thing the model reads.
 */
function withIdentityPrompt(parsed, env) {
  if (!Array.isArray(parsed.messages) || parsed.messages.length === 0) return parsed;
  const parts = [identityPrompt(env), dateContext(env)].filter((p) => p && p.length > 0);
  if (parts.length === 0) return parsed;

  // The identity rule is PREPENDED as its own system message, and the caller's
  // system messages are left where they were. Merging them into one message
  // looked equivalent and was not: an agent's authored instructions have to
  // survive as a separate message, because that is what every downstream
  // consumer reads, and a provider that honours only the first system message
  // would otherwise lose the agent prompt entirely.
  const finalMessages = [{ role: 'system', content: parts.join('\n\n') }];
  for (const m of parsed.messages) {
    // An empty system message carries nothing and would render as a blank turn.
    if (m?.role === 'system' && !m.content) continue;
    finalMessages.push(m);
  }

  return {
    ...parsed,
    messages: finalMessages,
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export { PORT, HOST };