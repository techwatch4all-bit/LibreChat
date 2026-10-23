/**
 * Keystore tests — run: node --test test/keystore.test.mjs
 *
 * The assertions that matter are the negative ones: a wrong master key must not
 * yield a secret, and nothing may be logged in the clear.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  sealSecret,
  openSecret,
  encryptDirect,
  decryptDirect,
  loadMasterKey,
  masterKeyPath,
  generateMasterKey,
  redact,
  safeEquals,
  REDACTED,
} from '../src/keystore.mjs';

const require = createRequire(import.meta.url);

const master = randomBytes(32);
const otherMaster = randomBytes(32);
const SECRET = 'sk-or-v1-abcdef0123456789abcdef0123456789';

test('round-trips a provider key', () => {
  const rec = sealSecret({ provider: 'openrouter', secret: SECRET, masterKey: master });
  const out = openSecret(rec, master).toString('utf8');
  assert.equal(out, SECRET);
});

test('record never contains the plaintext secret', () => {
  const rec = sealSecret({ provider: 'openrouter', secret: SECRET, masterKey: master });
  const serialised = JSON.stringify(rec);
  assert.equal(serialised.includes(SECRET), false, 'plaintext secret must not be persistable');
});

test('hint is identifiable but unusable', () => {
  const rec = sealSecret({ provider: 'openrouter', secret: SECRET, masterKey: master });
  assert.ok(rec.hint.includes('sk-o'));
  assert.ok(rec.hint.length < 12);
  assert.equal(rec.hint.includes(SECRET), false);
});

test('wrong master key cannot recover the secret', () => {
  const rec = sealSecret({ provider: 'openrouter', secret: SECRET, masterKey: master });
  assert.throws(() => openSecret(rec, otherMaster), /wrong master key/);
});

test('a DEK cannot be replayed against another provider slot', () => {
  const rec = sealSecret({ provider: 'openrouter', secret: SECRET, masterKey: master });
  const swapped = { ...rec, provider: 'anthropic' };
  assert.throws(() => openSecret(swapped, master), /wrong master key/);
});

test('tampered ciphertext is rejected by the AEAD tag', () => {
  const rec = sealSecret({ provider: 'openrouter', secret: SECRET, masterKey: master });
  const bytes = Buffer.from(rec.secretCt, 'base64');
  bytes[0] ^= 0xff; // flip one bit
  const tampered = { ...rec, secretCt: bytes.toString('base64') };
  assert.throws(() => openSecret(tampered, master));
});

test('two seals of the same secret differ (fresh DEK and IV each time)', () => {
  const a = sealSecret({ provider: 'openrouter', secret: SECRET, masterKey: master });
  const b = sealSecret({ provider: 'openrouter', secret: SECRET, masterKey: master });
  assert.notEqual(a.wrappedDek, b.wrappedDek);
  assert.notEqual(a.secretIv, b.secretIv);
});

test('loadMasterKey refuses a missing, short, zero or template file', () => {
  const os = require('node:os');
  const fs = require('node:fs');
  const path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'keyring-'));

  // missing file -> actionable error naming the file, never a value
  assert.throws(() => loadMasterKey(path.join(dir, 'absent.key')), /master key file not found/);

  const write = (name, content) => {
    const p = path.join(dir, name);
    fs.writeFileSync(p, content);
    return p;
  };

  assert.throws(() => loadMasterKey(write('short.key', randomBytes(8).toString('base64'))),
    /must decode to 32 bytes/);
  assert.throws(() => loadMasterKey(write('zero.key', Buffer.alloc(32).toString('base64'))),
    /all zeroes/);
  assert.throws(() => loadMasterKey(write('template.key', '# copy your key here\n\nnext line')),
    /looks like a template/);
  assert.throws(() => loadMasterKey(write('huge.key', 'A'.repeat(4096))), /implausibly large/);

  // and the happy path
  const good = write('good.key', randomBytes(32).toString('base64'));
  assert.equal(loadMasterKey(good).length, 32);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('masterKeyPath never resolves to a repository or .env location', () => {
  const p = masterKeyPath();
  assert.equal(/\.env/i.test(p), false);
  assert.equal(/node_modules/i.test(p), false);
});

test('generateMasterKey produces a valid 32-byte key', () => {
  assert.equal(Buffer.from(generateMasterKey(), 'base64').length, 32);
  assert.notEqual(generateMasterKey(), generateMasterKey());
});

test('direct encrypt/decrypt round-trips', () => {
  const rec = encryptDirect('hello', master, 'aad');
  assert.equal(decryptDirect(rec, master, 'aad').toString('utf8'), 'hello');
});

test('direct decrypt refuses the wrong AAD', () => {
  const rec = encryptDirect('hello', master, 'aad-one');
  assert.throws(() => decryptDirect(rec, master, 'aad-two'));
});

test('redact strips provider key shapes from logs', () => {
  const line = `calling https://api/x with sk-or-v1-abcdef0123456789 and AIzaSyABCDEFGHIJKLMNOPQRSTUVWX and Authorization: Bearer abcdefghijklmnopqrstuvwx`;
  const out = redact(line);
  assert.equal(out.includes('sk-or-v1-abcdef0123456789'), false);
  assert.equal(out.includes('AIzaSyABCDEFGHIJKLMNOPQRSTUVWX'), false);
  assert.equal(out.includes('Bearer abcdefghijklmnopqrstuvwx'), false);
  assert.ok(out.includes(REDACTED));
});

test('redact handles objects and cycles', () => {
  const cyclic = { apiKey: 'sk-or-v1-abcdef0123456789' };
  cyclic.self = cyclic;
  const out = redact(cyclic);
  assert.equal(out.includes('sk-or-v1-abcdef0123456789'), false);
});

test('safeEquals is constant-time and length-safe', () => {
  assert.equal(safeEquals('abc', 'abc'), true);
  assert.equal(safeEquals('abc', 'abd'), false);
  assert.equal(safeEquals('abc', 'abcd'), false); // different length, no throw
});