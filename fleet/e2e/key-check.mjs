import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';
import { createPrivateKey, createPublicKey } from 'node:crypto';

dotenv.config({ path: 'D:/LAN-AI-Infra/LibreChat/.env', quiet: true });

const filePem = readFileSync('D:/LAN-AI-Infra/LibreChat/fleet/.state/signing.key.pem', 'utf8');
const envPem = process.env.SATCHIDA_PRIVACY_SIGNING_KEY;

console.log('env present :', typeof envPem === 'string' && envPem.length > 0);
console.log('env length  :', envPem?.length);
console.log('file length :', filePem.length);
console.log('identical   :', envPem === filePem);
console.log('env has literal \\n (unescaped):', envPem?.includes('\\n'));

const norm = (s) => String(s ?? '').replace(/\r\n/g, '\n').trim();
console.log('identical after CRLF normalise:', norm(envPem) === norm(filePem));

for (const [label, pem] of [['env', envPem], ['file', filePem]]) {
  try {
    const key = createPrivateKey(pem);
    const pub = createPublicKey(key).export({ type: 'spki', format: 'pem' });
    console.log(`${label}: derived public key fingerprint =`,
      createPublicKey(pub).export({ type: 'spki', format: 'der' }).toString('base64url').slice(0, 44));
  } catch (error) {
    console.log(`${label}: unusable key ->`, error.message);
  }
}

const routerPub = readFileSync('D:/LAN-AI-Infra/LibreChat/fleet/.state/signing.pub.pem', 'utf8');
console.log('router pub fingerprint =',
  createPublicKey(routerPub).export({ type: 'spki', format: 'der' }).toString('base64url').slice(0, 44));
