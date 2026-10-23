/**
 * Milestone 1 contract test — proves the wire contract and the auth boundary
 * without any dependency, model download, or LibreChat instance.
 *
 * Run: npm test   (from rag-service/)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyRagToken, namespaceFor } from '../src/auth.mjs';

const SECRET = 'test-secret-not-a-real-one';
const OTHER = 'attacker-secret';

/** Mint a token exactly the way packages/api/src/crypto/jwt.ts does. */
function mint(userId, secret = SECRET, { expiresIn = '5m', alg = 'HS256' } = {}) {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const header = enc({ alg, typ: 'JWT' });
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + Number(String(expiresIn).replace(/[smh]/g, (m) => ({ s: 1, m: 60, h: 3600 }[m])));
  const payload = enc({ id: userId, iat, exp });
  const sig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

test('accepts a correctly minted LibreChat token', () => {
  const r = verifyRagToken(mint('user-abc'), SECRET);
  assert.equal(r.ok, true);
  assert.equal(r.payload.id, 'user-abc');
});

test('rejects a token signed with a different secret', () => {
  const r = verifyRagToken(mint('user-abc', OTHER), SECRET);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'signature_mismatch');
});

test('rejects a tampered payload', () => {
  const t = mint('user-abc');
  const [h, , s] = t.split('.');
  const forged = Buffer.from(JSON.stringify({ id: 'admin', iat: 1, exp: 9e9 })).toString('base64url');
  const r = verifyRagToken(`${h}.${forged}.${s}`, SECRET);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'signature_mismatch');
});

test('rejects alg:none — the classic JWT bypass', () => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ id: 'admin', exp: 9e9 })).toString('base64url');
  const r = verifyRagToken(`${header}.${payload}.`, SECRET);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unexpected_algorithm');
});

test('rejects an expired token', () => {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const h = enc({ alg: 'HS256', typ: 'JWT' });
  const p = enc({ id: 'user-abc', exp: Math.floor(Date.now() / 1000) - 10 });
  const s = createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url');
  const r = verifyRagToken(`${h}.${p}.${s}`, SECRET);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'expired');
});

test('rejects a token with no subject', () => {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const h = enc({ alg: 'HS256', typ: 'JWT' });
  const p = enc({ exp: Math.floor(Date.now() / 1000) + 300 });
  const s = createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url');
  const r = verifyRagToken(`${h}.${p}.${s}`, SECRET);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'missing_subject');
});

test('rejects malformed input without throwing', () => {
  for (const bad of ['', 'a.b', 'a.b.c.d', 'not-a-token', '....']) {
    assert.equal(verifyRagToken(bad, SECRET).ok, false, `should reject: ${bad}`);
  }
});

test('namespaces are derived from the verified subject only', () => {
  // The namespace is built from a verified userId, never from request input.
  // This is the entire basis of per-account isolation.
  assert.equal(namespaceFor('user-abc'), 'u:user-abc');
  assert.notEqual(namespaceFor('user-abc'), namespaceFor('user-xyz'));
});

test('two users can never share a namespace', () => {
  const seen = new Set();
  for (let i = 0; i < 5000; i += 1) seen.add(namespaceFor(`u${i}`));
  assert.equal(seen.size, 5000);
});