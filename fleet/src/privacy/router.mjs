import { createServer } from 'node:http';
import { randomBytes, sign as signBytes, verify as verifyBytes, createPublicKey } from 'node:crypto';
import { isIP } from 'node:net';
import {
  createFairUseController,
  estimateTokensFromBytes,
} from './fairuse.mjs';
import { createAllowanceReader } from './allowance.mjs';
import { resolveModel } from '../models.mjs';
import { createCatalogueReader } from '../models.mjs';

const MAX_TOKEN_BYTES = 8192;
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const MAX_ASSERTION_TTL_SECONDS = 300;
const MAX_REPLAY_ENTRIES = 100_000;
const CLOCK_SKEW_SECONDS = 15;
const OPAQUE_SEAT = /^[A-Za-z0-9_-]{16,128}$/;

/**
 * Normalise a capacity report into the flat shape the fair-use controller wants.
 *
 * The controller needs three numbers: the served concurrency, the prefill rate
 * and the aggregate decode rate. Two shapes reach the router:
 *
 *   flat    { c_served, prefill_tps, aggregate_tps }        (the documented contract)
 *   probe   { derived: { c_served }, throughput: { ... } }  (satchida-capacity-probe output)
 *
 * Only the flat shape used to be understood, so handing the router a real probe
 * report silently produced cServed=1, prefillTps=1, decodeTps=1. Every request
 * was then charged roughly the whole GPU-second budget for a handful of tokens
 * and the tenant was pushed into the Serious tier almost immediately. The probe
 * report is the canonical artefact, so it has to be understood.
 *
 * The probe records aggregate decode as a map keyed by concurrency, for example
 * { 1: 81.8, 2: 172.8, 4: 165.8 }. The rate that matters is the one at the
 * served concurrency: those are the tokens per second the GPU actually delivers
 * while that many sessions are in flight, which is what the GPU-second
 * accounting divides by. Falling back to the maximum keeps a usable number when
 * the exact concurrency was not swept.
 */
export function normaliseCapacity(capacity) {
  if (!capacity || typeof capacity !== 'object') return null;
  const derived = capacity.derived && typeof capacity.derived === 'object' ? capacity.derived : {};
  const throughput = capacity.throughput && typeof capacity.throughput === 'object' ? capacity.throughput : {};

  const cServedRaw = capacity.c_served ?? capacity.cServed ?? derived.c_served ?? derived.cServed;
  const cServed = Number.isInteger(cServedRaw) && cServedRaw >= 1 ? cServedRaw : 1;

  const prefillRaw = capacity.prefill_tps ?? capacity.prefillTps ?? throughput.prefill_tps;
  const prefillTps = Number(prefillRaw) > 0 ? Number(prefillRaw) : 0;

  const aggregateRaw = capacity.aggregate_tps ?? capacity.aggregateTps ?? throughput.aggregate_tps;
  let decodeTps = 0;
  if (Number(aggregateRaw) > 0) {
    decodeTps = Number(aggregateRaw);
  } else if (aggregateRaw && typeof aggregateRaw === 'object') {
    const atServed = Number(aggregateRaw[cServed]);
    if (atServed > 0) {
      decodeTps = atServed;
    } else {
      const values = Object.values(aggregateRaw).map(Number).filter((v) => v > 0);
      decodeTps = values.length ? Math.max(...values) : 0;
    }
  }

  if (!(prefillTps > 0) || !(decodeTps > 0)) return null;

  // The model the probe measured. It is carried alongside the rates because
  // the rates describe THAT model on THIS hardware.
  //
  // The probe report stores it as an object with an id, path and
  // architecture; a flattened report may carry a bare id string. Both are
  // accepted, because a report that cannot be understood is a report whose
  // rates would be applied to the wrong model.
  const modelRaw = capacity.model ?? capacity.id ?? derived.model;
  let model = null;
  if (typeof modelRaw === 'string' && modelRaw.trim()) {
    model = modelRaw.trim();
  } else if (modelRaw && typeof modelRaw === 'object' && typeof modelRaw.id === 'string' && modelRaw.id.trim()) {
    model = modelRaw.id.trim();
  }

  return { cServed, prefillTps, decodeTps, model };
}

export function issuePrivacyAssertion({
  tenantId,
  seatAlias,
  accountType,
  profileType,
  allowedModes,
  policyVersion,
  audience,
  expiresInSeconds,
  keyId = 'default',
  childSafetyReady = false,
  privateKey,
  now = Math.floor(Date.now() / 1000),
  jti = randomBytes(18).toString('base64url'),
}) {
  if (!privateKey) throw new Error('privacy assertion signing key is required');
  if (typeof tenantId !== 'string' || !tenantId.trim()) throw new Error('tenantId is required');
  if (typeof seatAlias !== 'string' || !OPAQUE_SEAT.test(seatAlias)) throw new Error('seatAlias must be an opaque identifier');
  if (!['basic', 'standard', 'family', 'pro', 'pro_family', 'enterprise', 'privacy'].includes(accountType)) throw new Error('accountType is invalid');
  if (!['adult', 'child'].includes(profileType)) throw new Error('profileType is invalid');
  if (profileType === 'child' && Array.isArray(allowedModes) && allowedModes.some((mode) => mode !== 'Privacy')) {
    throw new Error('child assertions may authorize only Privacy, not Work or other cloud modes');
  }
  if (!Array.isArray(allowedModes) || !allowedModes.includes('Privacy')) throw new Error('Privacy mode entitlement is required');
  if (!Number.isSafeInteger(policyVersion) || policyVersion < 1) throw new Error('policyVersion is invalid');
  if (typeof audience !== 'string' || !audience.trim()) throw new Error('audience is required');
  if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > MAX_ASSERTION_TTL_SECONDS) {
    throw new Error(`expiresInSeconds must be between 1 and ${MAX_ASSERTION_TTL_SECONDS}`);
  }
  if (profileType === 'child' && !childSafetyReady) throw new Error('child Privacy requires ready local safety controls');

  const payload = {
    iss: 'satchida-control',
    aud: audience,
    tid: tenantId.trim(),
    seat: seatAlias,
    account: accountType,
    profile: profileType,
    modes: ['Privacy'],
    policy: policyVersion,
    iat: now,
    nbf: now - CLOCK_SKEW_SECONDS,
    exp: now + expiresInSeconds,
    jti,
    kid: keyId,
    childSafetyReady: profileType === 'child' ? true : undefined,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = signBytes(null, Buffer.from(encoded, 'ascii'), privateKey).toString('base64url');
  return `${encoded}.${signature}`;
}

/**
 * Find the key that signed an assertion.
 *
 * The `kid` names which trusted key was used. The two sides of the Privacy
 * chain are configured independently — the tenant's LibreChat mints the
 * assertion and this router verifies it — and they do not have to agree on the
 * spelling of the key id. When the router holds exactly one trusted key there
 * is nothing to disambiguate, so the id is treated as a label rather than as a
 * selector. The signature still has to verify against that key, so this does
 * not make an unknown signer acceptable.
 *
 * With more than one key configured the id is authoritative, because that is
 * the only thing that distinguishes a current key from a rotated-out one.
 */
function resolveVerificationKey(publicKeys, kid) {
  if (!publicKeys || typeof publicKeys !== 'object') return undefined;
  if (kid && publicKeys[kid]) return publicKeys[kid];
  const ids = Object.keys(publicKeys);
  if (ids.length === 1) return publicKeys[ids[0]];
  return undefined;
}

export function verifyPrivacyAssertion(token, {
  publicKeys,
  audience,
  tenantId,
  seatAlias,
  now = Math.floor(Date.now() / 1000),
  usedJtis,
}) {
  if (typeof token !== 'string' || token.length > MAX_TOKEN_BYTES) throw new Error('assertion is malformed');
  const [encoded, signatureText, extra] = token.split('.');
  if (!encoded || !signatureText || extra !== undefined) throw new Error('assertion is malformed');
  let payload;
  let signature;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    signature = Buffer.from(signatureText, 'base64url');
  } catch {
    throw new Error('assertion is malformed');
  }
  const key = resolveVerificationKey(publicKeys, payload?.kid);
  if (!key) throw new Error('assertion signature is invalid');
  // A PEM string is accepted so an operator can point the router at the
  // published public key file without converting it first. A KeyObject is
  // already a usable verification key and is passed through untouched.
  const verificationKey = typeof key === 'string' ? createPublicKey(key) : key;
  if (!verifyBytes(null, Buffer.from(encoded, 'ascii'), verificationKey, signature)) throw new Error('assertion signature is invalid');
  if (payload.iss !== 'satchida-control') throw new Error('assertion issuer is invalid');
  if (payload.aud !== audience) throw new Error('assertion audience is invalid');
  if (seatAlias !== undefined && payload.seat !== seatAlias) throw new Error('assertion tenant seat binding is invalid');
  if (payload.tid !== tenantId) throw new Error('assertion tenant binding is invalid');
  if (!['adult', 'child'].includes(payload.profile) || !OPAQUE_SEAT.test(payload.seat)) throw new Error('assertion seat policy is invalid');
  if (!Number.isSafeInteger(payload.policy) || payload.policy < 1) throw new Error('assertion policy version is invalid');
  if (!Array.isArray(payload.modes) || !payload.modes.includes('Privacy') || payload.modes.some((mode) => mode !== 'Privacy')) throw new Error('assertion mode is invalid');
  if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.nbf) || !Number.isInteger(payload.exp) ||
      payload.nbf > now + CLOCK_SKEW_SECONDS || payload.iat > now + CLOCK_SKEW_SECONDS || now >= payload.exp ||
      payload.exp <= payload.iat || payload.exp - payload.iat > MAX_ASSERTION_TTL_SECONDS) {
    throw new Error('assertion is expired or outside its validity window');
  }
  if (typeof payload.jti !== 'string' || payload.jti.length < 16 || payload.jti.length > 128) throw new Error('assertion id is invalid');
  if (payload.profile === 'child' && payload.childSafetyReady !== true) throw new Error('child safety policy is unavailable');
  // Replay protection is CROSS-SEAT, not cross-request.
  //
  // LibreChat holds one assertion for the length of a conversation and presents
  // it on every turn, so refusing a second use would break the second message.
  // The property that actually matters is that one seat's assertion cannot be
  // replayed by a different seat, which is what this check enforces. A stolen
  // assertion is still bounded by the assertion's own short lifetime.
  //
  // The cache stores the seat that used the jti. The router layers an expiry
  // on top of the same entry, so the stored value is an object in both cases
  // and a plain string is never written here.
  if (usedJtis) {
    const seenBy = usedJtis.get(payload.jti);
    const seenSeat = typeof seenBy === 'object' && seenBy !== null ? seenBy.seat : seenBy;
    if (seenSeat !== undefined && seenSeat !== payload.seat) throw new Error('assertion has already been used');
    if (usedJtis instanceof Map) {
      const existing = typeof seenBy === 'object' && seenBy !== null ? seenBy : {};
      usedJtis.set(payload.jti, { ...existing, seat: payload.seat });
    } else if (seenBy === undefined) {
      usedJtis.add(payload.jti);
    }
  }
  return payload;
}

function loopbackURL(value) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('local upstream must use HTTP or HTTPS');
  const isLoopback = host === 'localhost' || host === '::1' || host.startsWith('127.') || (isIP(host) === 4 && host.startsWith('127.'));
  if (!isLoopback || url.username || url.password) throw new Error('Privacy upstream must be a loopback URL without embedded credentials');
  return url;
}

async function readLimited(req, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw Object.assign(new Error('request body is too large'), { statusCode: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function safeError(res, statusCode, code) {
  if (res.headersSent) return res.end();
  res.writeHead(statusCode, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify({ error: { code, message: 'Privacy mode is unavailable for this request.', type: 'privacy_unavailable' } }));
}

/**
 * Record what a request consumed and release its admission slot.
 *
 * Exact usage is used when the runtime reported it. A streaming response often
 * does not, so the byte count is converted to a conservative token estimate
 * rather than the request being recorded as free: under-counting would let a
 * heavy seat escape the fairness ladder entirely.
 */
function recordUsage(controller, seatAlias, usage, byteLength = 0) {
  if (!controller) return;
  let inTokens = 0;
  let cachedTokens = 0;
  let outTokens = 0;
  if (usage && typeof usage === 'object') {
    inTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0) || 0;
    outTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0) || 0;
    cachedTokens = Number(usage.prompt_tokens_details?.cached_tokens ?? usage.cached_tokens ?? 0) || 0;
  }
  if (outTokens === 0 && byteLength > 0) {
    outTokens = estimateTokensFromBytes(byteLength);
  }
  controller.release(seatAlias, { inTokens, cachedTokens, outTokens });
}

export async function createPrivacyRouter({
  publicKeys,
  audience,
  tenantId,
  upstreams,
  fetchImpl = fetch,
  childSafety,
  now = () => Math.floor(Date.now() / 1000),
  replayWindowSeconds = MAX_ASSERTION_TTL_SECONDS,
  capacity,
  fairUse,
  env = process.env,
} = {}) {
  if (!publicKeys || !audience || !tenantId || !upstreams?.Privacy) throw new Error('Privacy router configuration is incomplete');
  const privacyURL = loopbackURL(upstreams.Privacy);
  const usedJtis = new Map();

  /**
   * The local runtime's model catalogue, cached briefly.
   *
   * The router has to turn a mode label into a model the local runtime actually
   * has, and the runtime's catalogue is the only honest source. Half the entries
   * in models-preset.ini point at files that no longer exist, so a hardcoded id
   * that was correct last week returns "400 model not found" today.
   */
  const readCatalogue = createCatalogueReader({ fetchImpl });

  // Fair-use control is optional so a router can be brought up without a
  // capacity probe. When it is absent the router serves every request, which is
  // the pre-fair-use behaviour, and the operator's console shows the tenant as
  // unverified. A probe result turns it on.
  const rates = normaliseCapacity(capacity);
  const controller = rates
    ? createFairUseController({
      ...rates,
      ...(fairUse ?? {}),
    })
    : null;

  // The Privacy pack allowance, read from the operator.
  //
  // A Privacy pack is denominated in GPU-seconds and is spent on the TENANT's
  // own GPU, so the balance lives in the operator's ledger and the router is
  // the thing that spends it. The router reads it with the tenant's
  // tenant-scoped key, which can read the tenant's own allowances and spend
  // nothing.
  //
  // Without the operator configured there is no pack headroom, and the seat is
  // held to its base fair share of the machine: the pack WIDENS the allowance
  // and never narrows it.
  const allowanceReader = createAllowanceReader({
    operatorUrl: env.SATCHIDA_OPERATOR_URL,
    tenantId,
    tenantKey: env.SATCHIDA_TENANT_KEY,
    fetchImpl,
  });
  // "no report" and "a report that cannot be used" are different states for the
  // operator, and both have to fail open for availability.
  const capacityState = !capacity
    ? 'unprobed'
    : rates
      ? 'active'
      : 'unusable';

  /**
   * The model the Privacy mode is served by.
   *
   * When a capacity report exists, the rates in that report describe ONE model
   * measured on THIS hardware, and the fair-use ladder divides by those rates.
   * Serving a different model while charging against those rates would make the
   * accounting wrong in a way nothing surfaces: the queue would admit sessions
   * against a model that was never measured, and the GPU-seconds charged would
   * not be the GPU-seconds spent.
   *
   * So the measured model is authoritative, and the mode preference list is
   * only the fallback for a deployment with no report. The operator can still
   * override the preference with SATCHIDA_MODEL_PRIVACY, but that override
   * cannot silently detach the served model from the measured one.
   */
  const measuredModel = rates?.model ?? null;

  function verify(token, overrides = {}) {
    const current = overrides.now ?? now();
    // The replay cache holds { seat, expiry } so a stale entry can be evicted and
    // so a second use by the SAME seat is allowed while a different seat is not.
    // An entry with no expiry is treated as expired: it must not keep the cache
    // growing without bound.
    for (const [jti, entry] of usedJtis) {
      const expiry = typeof entry === 'object' && entry !== null ? entry.expiry : undefined;
      if (expiry === undefined || expiry <= current) usedJtis.delete(jti);
    }
    if (overrides.consume !== false && usedJtis.size >= MAX_REPLAY_ENTRIES) throw new Error('assertion replay cache is full');
    const payload = verifyPrivacyAssertion(token, {
      publicKeys,
      audience: overrides.audience ?? audience,
      tenantId: overrides.tenantId ?? tenantId,
      seatAlias: overrides.seatAlias,
      now: current,
      usedJtis: overrides.consume === false ? undefined : usedJtis,
    });
    if (overrides.consume === false) return payload;
    usedJtis.set(payload.jti, {
      seat: payload.seat,
      expiry: Math.min(payload.exp, current + replayWindowSeconds),
    });
    return payload;
  }

  async function handle(req, res) {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === '/health') {
      try {
        const response = await fetchImpl(new URL('/health', privacyURL), { redirect: 'error', signal: AbortSignal.timeout(2000) });
        if (!response.ok) return safeError(res, 503, 'local_model_unavailable');
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        return res.end('{"status":"ready","mode":"Privacy"}');
      } catch {
        return safeError(res, 503, 'local_model_unavailable');
      }
    }
    if (req.method === 'GET' && url.pathname === '/capacity') {
      // The tenant's own view of its capacity and fair-use state. It contains
      // seat aliases and counters, never prompt content.
      if (!controller) {
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        return res.end(JSON.stringify({
          verified: false,
    state: capacityState,
    reason: capacityState === 'unusable'
      ? 'the capacity report does not contain usable prefill and decode rates'
      : 'no capacity probe has been run',
    // The purchased pack allowance the router is enforcing, so the operator
    // can see that the balance is being read at all.
    pack: allowanceReader.snapshot(),
        }));
      }
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return res.end(JSON.stringify({ verified: true, state: capacityState, pack: allowanceReader.snapshot(), ...controller.snapshot() }));
    }
    if (req.method !== 'POST' || url.pathname !== '/v1/chat/completions') return safeError(res, 404, 'privacy_route_not_found');

    const auth = req.headers.authorization ?? '';
    const match = /^Bearer (.+)$/.exec(auth);
    if (!match) return safeError(res, 401, 'privacy_assertion_required');
    let payload;
    try {
      payload = verify(match[1], { consume: false });
    } catch (error) {
      // The reason is a policy verdict, not content: it says which check the
      // assertion failed. The assertion itself is never logged, but its SHAPE
      // is: "malformed" says nothing about which of the many ways a credential
      // can be wrong it is, and the length, the number of parts and the first
      // characters tell an assertion from a licence token from a bare key.
      const presented = match[1] ?? '';
      console.error(
        `[privacy-router] assertion rejected: ${error?.message} ` +
          `(length=${presented.length} parts=${presented.split('.').length} prefix=${presented.slice(0, 12)})`,
      );
      return safeError(res, 403, 'privacy_assertion_invalid');
    }
    if (payload.profile === 'child' && (!childSafety || childSafety.ready?.() !== true)) {
      return safeError(res, 503, 'child_safety_unavailable');
    }

    let rawBody;
    let body;
    try {
      rawBody = await readLimited(req, MAX_BODY_BYTES);
      body = JSON.parse(rawBody.toString('utf8'));
    } catch (error) {
      return safeError(res, error.statusCode ?? 400, 'privacy_request_invalid');
    }
    if (!body || typeof body !== 'object' || body.model !== 'Privacy' || !Array.isArray(body.messages)) {
      // Operational detail only: the model label and the shape of the request.
      // No prompt content is ever logged.
      console.error(
        '[privacy-router] refusing non-Privacy request:',
        JSON.stringify({
          model: typeof body?.model === 'string' ? body.model : typeof body?.model,
          messagesIsArray: Array.isArray(body?.messages),
          messageCount: Array.isArray(body?.messages) ? body.messages.length : null,
          bodyKeys: body && typeof body === 'object' ? Object.keys(body) : null,
        }),
      );
      return safeError(res, 403, 'privacy_mode_required');
    }
    // The mode label has to become a model the local runtime actually has. The
    // runtime's own catalogue is the only honest source, because a hardcoded id
    // that was correct last week returns "model not found" today.
    {
      const available = await readCatalogue(privacyURL);
      const resolved = resolveModel({ model: body.model, available, env });
      if (resolved.mode === null) {
        return safeError(res, 400, 'privacy_model_required');
      }
      // Prefer the model the capacity was measured for, when the runtime
      // actually has it. The preference list is the fallback.
      if (measuredModel && Array.isArray(available) && available.includes(measuredModel)) {
        body.model = measuredModel;
      } else {
        body.model = resolved.model;
      }
      // The forwarded body has to be rebuilt from the parsed body.
      //
      // The request was read as raw bytes, and those bytes still carry the
      // mode label. Setting `body.model` changed only the parsed copy, so the
      // runtime received the literal label and answered "model 'Privacy' not
      // found" for every adult seat. The label was replaced in the body that
      // was never sent.
      rawBody = Buffer.from(JSON.stringify(body), 'utf8');
    }

    // Dynamic Temporal Anchoring: guarantee model knows current real date without hardcoding
    {
      const todayStr = new Date().toISOString().split('T')[0];
      const anchorTag = `[Current Temporal Anchor: Today is ${todayStr}]`;
      const sysIdx = body.messages.findIndex((m) => m?.role === 'system');
      if (sysIdx >= 0) {
        if (!body.messages[sysIdx].content?.includes('Temporal Anchor')) {
          body.messages[sysIdx].content = `${anchorTag}\n${body.messages[sysIdx].content}`;
        }
      } else {
        body.messages.unshift({ role: 'system', content: anchorTag });
      }
      rawBody = Buffer.from(JSON.stringify(body), 'utf8');
    }

    if (payload.profile === 'child') {
      const inputAllowed = await childSafety.checkInput(body.messages);
      if (inputAllowed !== true) return safeError(res, 403, 'child_safety_denied');
      body.messages = [
        { role: 'system', content: 'MANDATORY CHILD SAFETY: This is a child account. Keep all responses age-appropriate and educational. Refuse sexual, grooming, self-harm, violent, predatory or exploitative requests. Do not ask for personal contact details or encourage secrecy from guardians.' },
        ...body.messages.filter((message) => message?.role !== 'system'),
      ];
      rawBody = Buffer.from(JSON.stringify(body), 'utf8');
    }

    try {
      verify(match[1]);
    } catch (error) {
      // The reason is logged, never returned: the caller gets a generic
      // refusal, and the operator gets the reason the assertion was refused.
      // A Privacy chain that silently refuses is indistinguishable from a
      // broken one.
      //
      // The SHAPE is logged too, because "malformed" says nothing about which
      // of the many ways a credential can be wrong it is: the length, the
      // number of parts and the first characters are enough to tell an
      // assertion from a licence token from a bare key, and none of them is
      // the credential itself.
      const presented = match[1] ?? '';
      console.error(
        `[privacy-router] the assertion was refused: ${error?.message ?? error} ` +
          `(length=${presented.length} parts=${presented.split('.').length} prefix=${presented.slice(0, 12)})`,
      );
      return safeError(res, 403, 'privacy_assertion_invalid');
    }

    // Fair-use admission.
    //
    // The gate is checked here, at admission, and never again. A request already
    // in flight is not interrupted, truncated, or refused, which is what
    // guarantees an interrupted session is not cut mid-cycle.
    let admission = null;
    if (controller) {
      // The seat's purchased pack allowance, read from the operator.
      //
      // It is read BEFORE the gate, because the gate is what it widens. A
      // balance that cannot be read leaves the seat on its base fair share:
      // the pack only ever widens the allowance, so a missing balance costs
      // the tenant its purchased headroom and nothing else.
      if (allowanceReader.enabled) {
        await allowanceReader.ensureFresh();
        controller.setPackAllowance(payload.seat, allowanceReader.allowanceFor(payload.seat));
      }
      const queuedSeats = controller.activeSlots >= controller.cServed
        ? controller.activeSlots
        : 0;
      admission = controller.admit(payload.seat, { queuedSeats });
      if (!admission.admitted) {
        const headers = {
          'content-type': 'application/json',
          'cache-control': 'no-store',
          'retry-after': String(Math.max(1, Math.ceil(admission.retryAfterMs / 1000))),
          'x-satchida-queue-position': String(admission.position),
          'x-satchida-fair-use-tier': admission.tier,
        };
        res.writeHead(429, headers);
        return res.end(JSON.stringify({
          error: {
            code: admission.reason === 'cooldown' ? 'privacy_fair_use_cooldown' : 'privacy_capacity_queue',
            message: admission.reason === 'cooldown'
              ? 'Your session is paused so other members can use the local model. You may continue when the timer expires.'
              : 'The local model is busy. You are in the queue and will be served as capacity frees.',
            type: 'privacy_fair_use',
            tier: admission.tier,
            position: admission.position,
            retryAfterMs: admission.retryAfterMs,
          },
        }));
      }
    }
    const releaseAdmission = () => {
      if (controller && admission?.admitted) controller.release(payload.seat);
    };

    const controller2 = new AbortController();
    req.on('close', () => { if (!res.writableEnded) controller2.abort(); });
    let upstream;
    try {
      upstream = await fetchImpl(new URL('/v1/chat/completions', privacyURL), {
        method: 'POST',
        headers: { 'content-type': req.headers['content-type'] ?? 'application/json', accept: req.headers.accept ?? 'application/json' },
        body: rawBody,
        redirect: 'error',
        signal: controller2.signal,
        duplex: 'half',
      });
    } catch {
      releaseAdmission();
      return safeError(res, 503, 'local_model_unavailable');
    }
    if (!upstream.ok) {
      releaseAdmission();
      // Operational detail only: the upstream status and the error message the
      // runtime reported. The request body is never logged.
      try {
        const detail = await upstream.text();
        let message = detail.slice(0, 400);
        try {
          const parsed = JSON.parse(detail);
          message = parsed?.error?.message ?? parsed?.message ?? message;
        } catch {
          /* not JSON, keep the raw prefix */
        }
        console.error(
          `[privacy-router] local model refused the request: status=${upstream.status} model=${body?.model} detail=${message}`,
        );
      } catch {
        console.error(`[privacy-router] local model refused the request: status=${upstream.status}`);
      }
      return safeError(res, 502, 'local_model_failed');
    }

    const contentType = upstream.headers.get('content-type') ?? 'application/json';
    if (payload.profile === 'child') {
      try {
        const bytes = Buffer.from(await upstream.arrayBuffer());
        const response = JSON.parse(bytes.toString('utf8'));
        const outputAllowed = await childSafety.checkOutput(response?.choices?.[0]?.message?.content ?? '');
        if (outputAllowed !== true) {
          releaseAdmission();
          return safeError(res, 403, 'child_safety_denied');
        }
        recordUsage(controller, payload.seat, response?.usage);
        res.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store', 'x-satchida-mode': 'Privacy' });
        return res.end(bytes);
      } catch {
        releaseAdmission();
        return safeError(res, 502, 'local_model_failed');
      }
    }

    // A non-streaming response carries exact usage, so the accounting is
    // measured rather than estimated.
    if (!contentType.includes('text/event-stream') && upstream.body) {
      try {
        const bytes = Buffer.from(await upstream.arrayBuffer());
        let usage;
        try {
          usage = JSON.parse(bytes.toString('utf8'))?.usage;
        } catch {
          usage = undefined;
        }
        recordUsage(controller, payload.seat, usage, bytes.length);
        res.writeHead(upstream.status, { 'content-type': contentType, 'cache-control': 'no-store', 'x-satchida-mode': 'Privacy' });
        return res.end(bytes);
      } catch {
        releaseAdmission();
        return safeError(res, 502, 'local_model_failed');
      }
    }

    // A streaming response may omit usage. The bytes are counted so the
    // accounting still reflects the work done, and the estimate errs high.
    let streamedBytes = 0;
    res.writeHead(upstream.status, { 'content-type': contentType, 'cache-control': 'no-store', 'x-satchida-mode': 'Privacy' });
    if (!upstream.body) {
      releaseAdmission();
      return res.end();
    }
    try {
      for await (const chunk of upstream.body) {
        streamedBytes += chunk.length;
        if (!res.write(Buffer.from(chunk))) await new Promise((resolve) => res.once('drain', resolve));
      }
      if (!res.writableEnded) res.end();
    } catch {
      if (!res.writableEnded) res.end();
    }
    recordUsage(controller, payload.seat, undefined, streamedBytes);
  }

  const server = createServer((req, res) => {
    handle(req, res).catch(() => safeError(res, 500, 'privacy_router_error'));
  });
  const listen = (port = 0, host = '127.0.0.1') => new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => { server.removeListener('error', reject); resolve(server.address()); });
  });
  const close = () => new Promise((resolve) => { server.close(resolve); server.closeAllConnections?.(); });
  return {
    server,
    listen,
    close,
    controller,
    verify: (token, overrides = {}) => verifyPrivacyAssertion(token, { publicKeys, audience, tenantId, ...overrides }),
  };
}
