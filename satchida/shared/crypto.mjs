// Shared crypto helpers: Ed25519 licence tokens + HMAC request signing.
import crypto from 'node:crypto';

export function canonical(obj) {
  // deterministic JSON: sorted keys
  const sort = (v) => Array.isArray(v) ? v.map(sort) : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])])) : v;
  return JSON.stringify(sort(obj));
}

export function generateKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }),
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

export function signLicence(payload, privatePem) {
  const body = canonical(payload);
  const sig = crypto.sign(null, Buffer.from(body), crypto.createPrivateKey(privatePem)).toString('base64');
  return { payload, sig };
}

export function verifyLicence(token, publicPem) {
  try {
    if (!token?.payload || !token.sig) return false;
    return crypto.verify(null, Buffer.from(canonical(token.payload)), crypto.createPublicKey(publicPem), Buffer.from(token.sig, 'base64'));
  } catch { return false; }
}

export function hmacSig(secret, ts, method, urlPath, body) {
  return crypto.createHmac('sha256', secret).update(`${ts}\n${method}\n${urlPath}\n${body}`).digest('hex');
}

export function safeEqualHex(a, b) {
  const A = Buffer.from(String(a), 'hex'); const B = Buffer.from(String(b), 'hex');
  return A.length === B.length && A.length > 0 && crypto.timingSafeEqual(A, B);
}

export const fingerprint = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 8);
