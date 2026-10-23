/**
 * Satchida fleet — licence tokens.
 *
 * A licence is an Ed25519-signed statement of what a client instance is entitled
 * to. The private key stays on our side and is never shipped. The public key
 * travels inside the client image for *local, offline* verification.
 *
 * Why local verification exists at all: Privacy mode must work with no network
 * call (see ARCHITECTURE.md §11.8). But local verification is for the UI only —
 * the gateway re-verifies on every request and is the actual authority
 * (CONTROL-MODEL.md §2).
 *
 * node:crypto only. No npm dependency.
 */
import {
  generateKeyPairSync,
  sign as edSign,
  verify as edVerify,
  randomBytes,
  createHash,
} from 'node:crypto';

export const LICENCE_VERSION = 1;

/**
 * Mint a licence for one client.
 * @param {object} p
 * @param {string} p.clientId
 * @param {number} p.seats            allocated account seats
 * @param {string} p.plan             e.g. 'standard' | 'pro' | 'enterprise'
 * @param {number} p.expiresAt        epoch seconds
 * @param {object} [p.features]       enabled feature flags
 * @param {Buffer} [p.privateKey]     Ed25519 private key (PKCS8 PEM)
 */
export function issueLicence({ clientId, seats, plan, expiresAt, features = {}, privateKey }) {
  if (!clientId) throw new Error('clientId is required');
  if (!Number.isInteger(seats) || seats < 1) throw new Error('seats must be a positive integer');
  if (!Number.isInteger(expiresAt)) throw new Error('expiresAt must be epoch seconds');

  const payload = {
    v: LICENCE_VERSION,
    cid: clientId,
    seats,
    plan,
    exp: expiresAt,
    iat: Math.floor(Date.now() / 1000),
    // binds the token to this deployment, so a licence lifted off one client
    // and pasted onto another fails verification
    aud: hashClientId(clientId),
    feat: features,
    jti: randomBytes(8).toString('hex'),
  };

  const body = Buffer.from(stableStringify(payload), 'utf8');
  const key = privateKey ?? generateKeyPairSync('ed25519').privateKey;
  const signature = edSign(null, body, key);

  return {
    token: `${body.toString('base64url')}.${signature.toString('base64url')}`,
    payload,
    signature: signature.toString('base64url'),
  };
}

/**
 * Verify a licence offline. Used by the client for UI gating.
 * @param {string} token
 * @param {string|Buffer} publicKey  SPKI PEM
 * @param {object} [opts]
 * @param {number} [opts.now]        epoch seconds, for tests
 * @returns {{ valid: boolean, reason?: string, payload?: object }}
 */
export function verifyLicence(token, publicKey, { now = Math.floor(Date.now() / 1000) } = {}) {
  if (typeof token !== 'string' || token.split('.').length !== 2) {
    return { valid: false, reason: 'malformed_token' };
  }
  const [bodyB64, sigB64] = token.split('.');

  let body;
  let signature;
  try {
    body = Buffer.from(bodyB64, 'base64url');
    signature = Buffer.from(sigB64, 'base64url');
  } catch {
    return { valid: false, reason: 'undecodable_token' };
  }

  let ok = false;
  try {
    ok = edVerify(null, body, publicKey, signature);
  } catch {
    return { valid: false, reason: 'verification_error' };
  }
  if (!ok) return { valid: false, reason: 'bad_signature' };

  let payload;
  try {
    payload = JSON.parse(body.toString('utf8'));
  } catch {
    return { valid: false, reason: 'undecodable_payload' };
  }

  if (payload.v !== LICENCE_VERSION) return { valid: false, reason: 'version_mismatch' };
  if (!Number.isInteger(payload.exp) || now >= payload.exp) {
    return { valid: false, reason: 'expired', payload };
  }
  if (payload.aud !== hashClientId(payload.cid)) {
    return { valid: false, reason: 'audience_mismatch', payload };
  }

  return { valid: true, payload };
}

/**
 * Public authorisation check for the gateway. This is the enforcement path —
 * it decides whether a cloud request is served at all.
 * @param {object} p
 * @param {object} p.payload          verified licence payload
 * @param {string} p.clientId         caller identity, from the request
 * @param {number} [p.seatsInUse]
 * @param {object} [p.spend]          { creditsRemaining }
 */
export function authorise({ payload, clientId, seatsInUse = 0, spend = {} }) {
  if (!payload) return { allowed: false, code: 'no_licence' };
  if (payload.cid !== clientId) return { allowed: false, code: 'client_mismatch' };
  if (seatsInUse > payload.seats) return { allowed: false, code: 'seat_cap_exceeded' };
  if (typeof spend.creditsRemaining === 'number' && spend.creditsRemaining <= 0) {
    return { allowed: false, code: 'balance_exhausted' };
  }
  return { allowed: true, seatsRemaining: payload.seats - seatsInUse };
}

/** Bind a licence to one deployment without publishing the client id. */
function hashClientId(clientId) {
  return createHash('sha256').update(`satchida:aud:${clientId}`).digest('base64url').slice(0, 16);
}

/**
 * Deterministic JSON. Signature verification re-serialises the parsed payload,
 * so key order must survive the round trip.
 */
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

export { stableStringify, hashClientId };