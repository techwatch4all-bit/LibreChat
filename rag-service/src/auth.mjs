/**
 * HS256 JWT verification for the Satchida RAG service.
 *
 * Contract source: packages/api/src/crypto/jwt.ts in the LibreChat tree.
 *   jwt.sign({ id: userId }, process.env.JWT_SECRET!, { expiresIn, algorithm: 'HS256' })
 *
 * Deliberately dependency-free: node:crypto only. The first milestone of this
 * service must be provable with nothing installed and nothing downloaded.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/** @typedef {{ id: string; scope?: string; iat?: number; exp?: number }} RagTokenPayload */

const b64urlToBuffer = (segment) => Buffer.from(segment, 'base64url');

/**
 * Verify a LibreChat-minted short-lived token.
 * @param {string} token
 * @param {string} secret - Must equal the LibreChat process JWT_SECRET.
 * @returns {{ ok: true; payload: RagTokenPayload } | { ok: false; reason: string }}
 */
export function verifyRagToken(token, secret) {
  if (!token || !secret) {
    return { ok: false, reason: 'missing_token_or_secret' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { ok: false, reason: 'malformed_token' };
  }

  const [headerSeg, payloadSeg, signatureSeg] = parts;

  let header;
  let payload;
  let signature;
  try {
    header = JSON.parse(b64urlToBuffer(headerSeg).toString('utf8'));
    payload = JSON.parse(b64urlToBuffer(payloadSeg).toString('utf8'));
    signature = b64urlToBuffer(signatureSeg);
  } catch {
    return { ok: false, reason: 'undecodable_token' };
  }

  // Pin the algorithm. Without this, "alg: none" and RS256 confusion are live.
  if (header?.alg !== 'HS256') {
    return { ok: false, reason: 'unexpected_algorithm' };
  }

  const expected = createHmac('sha256', secret).update(`${headerSeg}.${payloadSeg}`).digest();

  if (signature.length !== expected.length) {
    return { ok: false, reason: 'signature_length_mismatch' };
  }
  if (!timingSafeEqual(signature, expected)) {
    return { ok: false, reason: 'signature_mismatch' };
  }

  // Signature is valid, now check temporal validity.
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload?.exp === 'number' && now >= payload.exp) {
    return { ok: false, reason: 'expired' };
  }
  if (typeof payload?.nbf === 'number' && now < payload.nbf) {
    return { ok: false, reason: 'not_yet_valid' };
  }

  if (typeof payload?.id !== 'string' || payload.id.length === 0) {
    return { ok: false, reason: 'missing_subject' };
  }

  return { ok: true, payload };
}

/**
 * Namespace for a caller. The subject comes from a VERIFIED token, never from
 * request input — this is the whole basis of per-account isolation.
 * @param {string} userId
 * @returns {string}
 */
export function namespaceFor(userId) {
  return `u:${userId}`;
}

/**
 * Namespace for a shared space (agent knowledge base, class, committee).
 * entity_id is only ever supplied by LibreChat for agent-owned files.
 * @param {string} entityId
 * @returns {string}
 */
export function namespaceForEntity(entityId) {
  return `e:${entityId}`;
}