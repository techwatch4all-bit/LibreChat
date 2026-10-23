/**
 * Satchida fleet — API key vault.
 *
 * Design goals, in order:
 *   1. A provider API key must never exist in plaintext anywhere persistent.
 *   2. It must never be returned to a client, an end user, or logged.
 *   3. It must never enter a model context (prompt injection surface).
 *   4. Rotation must be possible without downtime.
 *
 * Envelope encryption, using only node:crypto — no npm dependency.
 *
 *   master key  (from env / OS store; NEVER written to disk or the database)
 *      └── wraps a per-provider data key (DEK)
 *             └── encrypts the API key with AES-256-GCM
 *
 * The DEK is stored wrapped. Unwrapping happens in memory for the lifetime of a
 * request and the buffer is overwritten immediately afterwards.
 */
import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
  timingSafeEqual,
} from 'node:crypto';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { constants } from 'node:fs';
import { platform } from 'node:os';

const ALGO = 'aes-256-gcm';
const DEK_BYTES = 32;
const IV_BYTES = 12;

/** Never let a secret reach a log line, even inside an error object. */
export const REDACTED = '[redacted]';

const SECRET_SHAPES = [
  /sk-[A-Za-z0-9_-]{12,}/g, // OpenAI / OpenRouter style
  /sk-ant-[A-Za-z0-9_-]{12,}/g, // Anthropic
  /AIza[A-Za-z0-9_-]{20,}/g, // Google
  /Bearer\s+[A-Za-z0-9._-]{16,}/gi,
];

/**
 * Strip anything secret-shaped from a string before it is logged.
 * Defence in depth: a caller that forgets must not leak.
 * @param {unknown} input
 * @returns {string}
 */
export function redact(input) {
  let s = typeof input === 'string' ? input : safeStringify(input);
  for (const re of SECRET_SHAPES) s = s.replace(re, REDACTED);
  return s;
}

function safeStringify(value) {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Load the master key from a FILE, never from an environment variable.
 *
 * Operator directive: no key may live in an environment variable, in code, or in a
 * .env file. A registry User-scope variable is readable by every process running
 * as that account and persists across sessions, which is the same exposure as
 * writing it to disk — just less visible. A file with a restrictive ACL is at
 * least explicit and auditable.
 *
 * Windows hardening (run once, as an administrator):
 *   icacls "C:\ProgramData\Satchida\keyring\master.key" /inheritance:r /grant "NT SERVICE\nssm:S+R"
 *   icacls "C:\ProgramData\Satchida\keyring" /inheritance:r
 *
 * Linux equivalent: chown root:satchida 0640, directory 0750.
 *
 * Never logs the key or any part of it. Only its length is reported, and only on
 * failure, to help distinguish "wrong file" from "malformed file".
 *
 * @param {string} [path]
 * @returns {Buffer}
 */
export function loadMasterKey(path = masterKeyPath()) {
  if (!existsSync(path)) {
    throw new Error(
      `master key file not found: ${path}\n` +
        `Create it with: node fleet/scripts/init-keyring.mjs\n` +
        'Do NOT place the key in an environment variable or a .env file.',
    );
  }

  const stat = statSync(path);
  if (stat.size > 1024) {
    throw new Error(`master key file is implausibly large (${stat.size} bytes) — refusing`);
  }

  const text = readFileSync(path, 'utf8').trim();
  if (text.startsWith('#') || text.includes('\n\n')) {
    throw new Error('master key file looks like a template, not a key — run init-keyring.mjs');
  }

  let key;
  try {
    key = Buffer.from(text, 'base64');
  } catch {
    throw new Error(`master key file is not valid base64 (${stat.size} bytes on disk)`);
  }

  if (key.length !== DEK_BYTES) {
    // Length only — never the value.
    throw new Error(`master key must decode to ${DEK_BYTES} bytes, got ${key.length}`);
  }
  if (key.equals(Buffer.alloc(DEK_BYTES))) {
    throw new Error('master key is all zeroes — refusing');
  }
  return key;
}

/**
 * Resolve the keyring path. Override only via a non-secret setting
 * (SATCHIDA_KEYRING_DIR), never by putting the key itself in the environment.
 * @returns {string}
 */
export function masterKeyPath() {
  const dir =
    process.env.SATCHIDA_KEYRING_DIR ||
    (platform() === 'win32'
      ? 'C:\\ProgramData\\Satchida\\keyring'
      : '/etc/satchida/keyring');
  return `${dir}${platform() === 'win32' ? '\\' : '/'}master.key`;
}

/**
 * Generate a fresh master key. Prints the key ONCE, to stdout, for the operator
 * to place in the keyring file — the process never persists it.
 * @returns {string} base64
 */
export function generateMasterKey() {
  return randomBytes(DEK_BYTES).toString('base64');
}

export { constants };

/**
 * Derive a key-encryption key for a given provider using HKDF-style separation,
 * so one wrapped DEK can never be replayed against another provider's slot.
 */
function wrapContext(provider) {
  return Buffer.from(`satchida:dek:${provider}`, 'utf8');
}

/**
 * Wrap a DEK under the master key. The master is the cipher key; the DEK is
 * the plaintext being wrapped. AAD binds the wrapping to one provider slot.
 */
function wrapAead(master, dekBytes, provider) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, master, iv);
  cipher.setAAD(wrapContext(provider));
  const wrapped = Buffer.concat([cipher.update(dekBytes), cipher.final()]);
  return { iv, wrapped, tag: cipher.getAuthTag() };
}

/**
 * Seal a provider API key under envelope encryption.
 *
 *   DEK  = randomBytes(32)                      per-provider, fresh every time
 *   ct   = AES-256-GCM(DEK,  secret)           the API key at rest
 *   wrap = AES-256-GCM(master, DEK)            so the DEK can be recovered
 *
 * Storing both lets us rotate the master key later by re-wrapping DEKs without
 * ever decrypting a single API key.
 *
 * @param {object} opts
 * @param {string} opts.provider
 * @param {string} opts.secret
 * @param {Buffer} opts.masterKey
 */
export function sealSecret({ provider, secret, masterKey }) {
  if (!provider || !secret) throw new Error('provider and secret are required');

  const dek = randomBytes(DEK_BYTES);

  // 1. encrypt the API key under the DEK
  const sIv = randomBytes(IV_BYTES);
  const sCipher = createCipheriv(ALGO, dek, sIv);
  sCipher.setAAD(Buffer.from(`satchida:secret:${provider}`, 'utf8'));
  const ct = Buffer.concat([sCipher.update(Buffer.from(secret, 'utf8')), sCipher.final()]);
  const sTag = sCipher.getAuthTag();

  // 2. wrap the DEK under the master key
  const { iv, wrapped, tag } = wrapAead(masterKey, dek, provider);

  dek.fill(0); // wipe the plaintext DEK as soon as both operations are done

  return {
    provider,
    wrappedDek: wrapped.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    secretIv: sIv.toString('base64'),
    secretTag: sTag.toString('base64'),
    secretCt: ct.toString('base64'),
    hint: `${secret.slice(0, 4)}…${secret.slice(-2)}`,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Recover a stored API key. The caller receives plaintext and must wipe it.
 * Nothing here logs or returns the value.
 * @param {object} record - a record produced by sealSecret
 * @param {Buffer} masterKey
 * @returns {Buffer} plaintext secret
 */
export function openSecret(record, masterKey) {
  const dek = Buffer.alloc(DEK_BYTES);

  // 1. unwrap the DEK under the master key
  const unwrap = createDecipheriv(ALGO, masterKey, Buffer.from(record.iv, 'base64'));
  unwrap.setAAD(wrapContext(record.provider));
  unwrap.setAuthTag(Buffer.from(record.tag, 'base64'));
  try {
    const out = Buffer.concat([unwrap.update(Buffer.from(record.wrappedDek, 'base64')), unwrap.final()]);
    out.copy(dek);
  } catch {
    dek.fill(0);
    throw new Error(
      `cannot unwrap DEK for provider=${record.provider}: wrong master key or tampered record`,
    );
  }

  // 2. decrypt the API key under the DEK
  try {
    const dec = createDecipheriv(ALGO, dek, Buffer.from(record.secretIv, 'base64'));
    dec.setAAD(Buffer.from(`satchida:secret:${record.provider}`, 'utf8'));
    dec.setAuthTag(Buffer.from(record.secretTag, 'base64'));
    return Buffer.concat([dec.update(Buffer.from(record.secretCt, 'base64')), dec.final()]);
  } finally {
    dek.fill(0); // always wipe the DEK, success or failure
  }
}

/**
 * Encrypt a secret directly under the master key. Used for the small set of
 * values that do not warrant their own DEK.
 * @returns {{ iv: string, tag: string, ct: string }}
 */
export function encryptDirect(plaintext, masterKey, aad = '') {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, masterKey, iv);
  if (aad) cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ct = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ct: ct.toString('base64') };
}

/**
 * Decrypt a value produced by encryptDirect.
 * @returns {Buffer}
 */
export function decryptDirect(record, masterKey, aad = '') {
  const dec = createDecipheriv(ALGO, masterKey, Buffer.from(record.iv, 'base64'));
  if (aad) dec.setAAD(Buffer.from(aad, 'utf8'));
  dec.setAuthTag(Buffer.from(record.tag, 'base64'));
  return Buffer.concat([dec.update(Buffer.from(record.ct, 'base64')), dec.final()]);
}

/**
 * Constant-time compare for identifiers (never for secrets of differing length).
 * @returns {boolean}
 */
export function safeEquals(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}