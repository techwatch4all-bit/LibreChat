/**
 * Isolate the Privacy assertion exchange: mint with the tenant's LibreChat
 * code path, verify with the tenant's Privacy router code path.
 */
import mongoose from 'mongoose';
import { readFileSync } from 'node:fs';
import { createMethods, createModels } from '@librechat/data-schemas';
import { verifyPrivacyAssertion } from '../src/privacy/router.mjs';

const creds = JSON.parse(readFileSync('D:/LAN-AI-Infra/LibreChat/fleet/.state/e2e-credentials.json', 'utf8'));
const publicKeyPem = readFileSync(
  'D:/LAN-AI-Infra/LibreChat/fleet/.state/signing.pub.pem',
  'utf8',
);

await mongoose.connect('mongodb://127.0.0.1:27017/LibreChat', { serverSelectionTimeoutMS: 8000 });
createModels(mongoose);

const signingKey = process.env.SATCHIDA_PRIVACY_SIGNING_KEY;
console.log('env signing key present:', typeof signingKey === 'string' && signingKey.length > 0);

const methods = createMethods(mongoose, {
  privacyAssertion: {
    getSigningKey: () => signingKey,
    audience: 'satchida-control',
    isLocalReady: async () => true,
  },
});

const entitlement = await mongoose.models.TenantEntitlement.findOne({ tenantId: creds.tenantId }).lean();
console.log('entitlement found:', Boolean(entitlement), '| status:', entitlement?.status);
console.log('seat assigned type:', entitlement?.seatAssignments?.[creds.seatAlias]);
console.log('privacy allocation:', JSON.stringify(entitlement?.accountTypes?.privacy));

const assertion = await methods.getPrivacyAssertion({
  tenantId: creds.tenantId,
  seatAlias: creds.seatAlias,
  accountType: 'privacy',
  profileType: 'adult',
});

if (!assertion) {
  console.log('MINT FAILED: getPrivacyAssertion returned undefined');
  await mongoose.disconnect();
  process.exit(1);
}

const [encoded] = assertion.split('.');
console.log('payload:', JSON.stringify(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))));

try {
  const verified = verifyPrivacyAssertion(assertion, {
    publicKeys: { default: publicKeyPem, 'tenant-local': publicKeyPem },
    audience: 'satchida-control',
    tenantId: creds.tenantId,
  });
  console.log('VERIFY OK:', JSON.stringify(verified));
} catch (error) {
  console.log('VERIFY FAILED:', error.message);
}

await mongoose.disconnect();
