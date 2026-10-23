/** Licence tests — node --test test/licence.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createPrivateKey } from 'node:crypto';
import { issueLicence, verifyLicence, authorise, stableStringify } from '../src/licence.mjs';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const other = generateKeyPairSync('ed25519');

const base = {
  clientId: 'school-mum',
  seats: 400,
  plan: 'standard',
  expiresAt: Math.floor(Date.now() / 1000) + 86400,
};

test('issues and verifies a valid licence', () => {
  const { token } = issueLicence({ ...base, privateKey });
  const r = verifyLicence(token, publicKey);
  assert.equal(r.valid, true);
  assert.equal(r.payload.seats, 400);
  assert.equal(r.payload.cid, 'school-mum');
});

test('rejects a licence signed by a different key', () => {
  const { token } = issueLicence(base); // different keypair
  assert.equal(verifyLicence(token, publicKey).reason, 'bad_signature');
});

test('rejects a tampered payload', () => {
  const { token, payload } = issueLicence({ ...base, privateKey });
  const forged = { ...payload, seats: 99999 };
  const body = Buffer.from(stableStringify(forged), 'utf8');
  const [, sig] = token.split('.');
  assert.equal(verifyLicence(`${body.toString('base64url')}.${sig}`, publicKey).reason, 'bad_signature');
});

test('rejects an expired licence', () => {
  const { token } = issueLicence({ ...base, expiresAt: 1000, privateKey });
  const r = verifyLicence(token, publicKey);
  assert.equal(r.valid, false);
  assert.equal(r.reason, 'expired');
});

test('rejects a licence lifted onto another deployment', () => {
  const { token } = issueLicence({ ...base, privateKey });
  const r = verifyLicence(token, publicKey);
  assert.equal(r.valid, true);
  // the audience hash is derived from cid, so moving the token to a different
  // client id fails at the authorisation layer, not the signature layer
  assert.equal(authorise({ payload: r.payload, clientId: 'acme-blr' }).allowed, false);
});

test('rejects malformed tokens without throwing', () => {
  for (const bad of ['', 'x', 'a.b', 'a.b.c', null, undefined, 42]) {
    assert.equal(verifyLicence(bad, publicKey).valid, false);
  }
});

test('authorisation enforces seat cap', () => {
  const { payload } = verifyLicence(issueLicence({ ...base, privateKey }).token, publicKey);
  assert.equal(authorise({ payload, clientId: 'school-mum', seatsInUse: 399 }).allowed, true);
  const blocked = authorise({ payload, clientId: 'school-mum', seatsInUse: 401 });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.code, 'seat_cap_exceeded');
});

test('authorisation enforces remaining balance', () => {
  const { payload } = verifyLicence(issueLicence({ ...base, privateKey }).token, publicKey);
  const blocked = authorise({ payload, clientId: 'school-mum', spend: { creditsRemaining: 0 } });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.code, 'balance_exhausted');
});

test('authorisation refuses a missing licence', () => {
  assert.equal(authorise({ clientId: 'school-mum' }).code, 'no_licence');
});

test('every licence is unique (jti) even with identical inputs', () => {
  const a = issueLicence({ ...base, privateKey });
  const b = issueLicence({ ...base, privateKey });
  assert.notEqual(a.payload.jti, b.payload.jti);
});

test('stableStringify is key-order independent', () => {
  assert.equal(stableStringify({ b: 1, a: 2 }), stableStringify({ a: 2, b: 1 }));
});

test('refuses a malformed issuance request', () => {
  assert.throws(() => issueLicence({ ...base, seats: 0, privateKey }), /positive integer/);
  assert.throws(() => issueLicence({ ...base, clientId: '', privateKey }), /clientId is required/);
});