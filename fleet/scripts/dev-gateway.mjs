#!/usr/bin/env node
/**
 * Tenant-local Privacy service runner.
 *
 * Bootstraps the Ed25519 signing pair (persisted, so assertions survive a
 * restart) and starts the Privacy router, which is the tenant-local inference
 * front door.
 *
 *   node fleet/scripts/dev-gateway.mjs
 *
 * WHY THE OLD GATEWAY IS GONE
 * ---------------------------
 * This runner used to start `fleet/src/gateway.mjs` on :4000 as well. That
 * gateway is superseded: :4000 is now One-API, which owns tenant policy,
 * seat binding and token accounting, and the cloud hop is the Node router on
 * :4001. What remains tenant-local is the Privacy path, and that is the router
 * this runner starts.
 *
 * The signing key is still created here because the Privacy router signs and
 * verifies the seat assertion with it. The licence token is still minted for
 * the same reason: it is the operator credential the tenant harness presents.
 */
import { generateKeyPairSync, createPrivateKey } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// Load LibreChat/.env so the local URL, the VK and the licence token travel with
// this process under pm2, independent of shell env.
import dotenv from 'dotenv';
const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(HERE, '..', '..', '.env');
if (existsSync(ENV_PATH)) dotenv.config({ path: ENV_PATH, quiet: true });
import { issueLicence } from '../src/licence.mjs';
import { createPrivacyRouter } from '../src/privacy/router.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const stateDir = join(here, '..', '.state');
mkdirSync(stateDir, { recursive: true });

const privPath = join(stateDir, 'signing.key.pem');
const pubPath = join(stateDir, 'signing.pub.pem');
const licPath = join(stateDir, 'licence.token');
const capacityPath = join(stateDir, 'capacity.json');
// The operator's address and the tenant's key, for the Privacy pack balance.
//
// The key is a TENANT-SCOPED credential: it can read the tenant's own seats'
// allowances and can spend nothing, because the relay refuses a shared key.
// It lives in the state directory, which is not in the repository, and it is
// handed to the tenant's deployment rather than written into the application.
const operatorPath = join(stateDir, 'operator.json');

let privateKeyPem;
let publicKeyPem;
if (existsSync(privPath) && existsSync(pubPath)) {
  privateKeyPem = readFileSync(privPath, 'utf8');
  publicKeyPem = readFileSync(pubPath, 'utf8');
  console.log('signing pair: reusing', privPath);
} else {
  const pair = generateKeyPairSync('ed25519');
  privateKeyPem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  publicKeyPem = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  writeFileSync(privPath, privateKeyPem, { mode: 0o600 });
  writeFileSync(pubPath, publicKeyPem);
  console.log('signing pair: created at', privPath);
}

const privateKey = createPrivateKey(privateKeyPem);

// A rotated operator credential must survive this boot. When the file holds a
// gateway-issued relay key (no body.signature separator, so not an Ed25519
// licence) it was minted by the issuer's own rotation tool and re-minting here
// would clobber it; only a missing or Ed25519-shaped token is refreshed.
const existingLicence = existsSync(licPath) ? readFileSync(licPath, 'utf8').trim() : '';
if (existingLicence && !existingLicence.includes('.')) {
  console.log('licence: keeping the operator-rotated relay key at', licPath, '(not printed)');
} else {
  const token = issueLicence({
    clientId: 'hq-local',
    seats: 500,
    plan: 'enterprise',
    expiresAt: Math.floor(Date.now() / 1000) + 30 * 86400,
    privateKey,
    features: { modes: ['chat', 'work', 'privacy'], imageGen: false },
  }).token;

  writeFileSync(licPath, token, { mode: 0o600 });
  console.log('licence written to', licPath, '(not printed)');
}

// The Privacy router.
//
// Privacy traffic is served here rather than forwarded to the bare local
// runtime, because the router is the only component that verifies the
// operator's signed assertion, enforces the fair-use ladder and applies the
// child safety controls.
//
// The capacity report from `satchida-capacity-probe` is what turns the fair-use
// control on. Without it the router serves every request and reports itself
// unverified, which is the correct fail-open posture for availability: the
// operator's console shows the tenant as unprobed, and the probe can be run at
// any time.
let capacity = null;
if (existsSync(capacityPath)) {
  try {
    capacity = JSON.parse(readFileSync(capacityPath, 'utf8'));
    console.log('capacity report: loaded from', capacityPath);
  } catch (err) {
    console.warn('capacity report: could not be read, running without a fair-use limit:', err.message);
  }
}

const privacyPort = Number(process.env.SATCHIDA_PRIVACY_PORT || 4099);
// The tenant's own LibreChat mints the assertion and names the key it used in
// the `kid` header. The key id is a label, not a secret, but the two sides are
// configured independently, so the same key is published under both ids the
// router and the tenant are likely to use.
const privacyKeyId = process.env.SATCHIDA_PRIVACY_KEY_ID || 'tenant-local';
// The operator, for the Privacy pack balance. The file wins over the
// environment, because the key is a secret and the environment of a shared
// shell is not the place to keep one.
if (existsSync(operatorPath)) {
  try {
    const operator = JSON.parse(readFileSync(operatorPath, 'utf8'));
    if (operator?.operator_url) process.env.SATCHIDA_OPERATOR_URL = String(operator.operator_url);
    if (operator?.tenant_key) process.env.SATCHIDA_TENANT_KEY = String(operator.tenant_key);
    // The OPERATOR's tenant id is the ledger's tenant, which is not the same
    // name as the router's own tenant claim: the claim is the tenant-local
    // label the assertion carries, and the ledger's tenant is the operator's
    // record of the same customer. They are configured apart on purpose.
    if (operator?.operator_tenant_id) {
      process.env.SATCHIDA_OPERATOR_TENANT_ID = String(operator.operator_tenant_id);
    }
    console.log('operator: pack balance reader configured');
  } catch (err) {
    console.warn('operator: the operator file could not be read:', err.message);
  }
}
const privacyRouter = await createPrivacyRouter({
  publicKeys: { default: publicKeyPem, [privacyKeyId]: publicKeyPem },
  audience: process.env.SATCHIDA_PRIVACY_AUDIENCE || 'satchida-control',
  tenantId: process.env.SATCHIDA_TENANT_ID || 'tenant-local',
  upstreams: { Privacy: process.env.SATCHIDA_LOCAL_URL || 'http://127.0.0.1:8080' },
  capacity,
  env: process.env,
});
await privacyRouter.listen(privacyPort, '127.0.0.1');
console.log(`privacy router listening on http://127.0.0.1:${privacyPort}${capacity ? ' (fair-use active)' : ' (no capacity probe: unverified)'}`);
console.log('route: Privacy -> local model on', process.env.SATCHIDA_LOCAL_URL || 'http://127.0.0.1:8080');
console.log('route: Chat / Work / Study -> One-API on :4000 (not started by this runner)');
console.log('set librechat.yaml endpoint apiKey to:', licPath);