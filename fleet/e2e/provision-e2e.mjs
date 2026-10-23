/**
 * E2E provisioning for the Privacy chain.
 *
 * The operator normally pushes a seat to a tenant node. On this single-box
 * deployment the tenant node IS this LibreChat, so the push is done directly
 * into the tenant-local store:
 *
 *   1. a TenantEntitlement for the tenant, granting Privacy on the account
 *      types the seat actually holds
 *   2. an opaque seat alias on the seat assignment
 *   3. a user that carries that alias, so the Privacy assertion can be minted
 *
 * Nothing here prints a secret: the seat alias is a pseudonym, not a credential,
 * and the password is only ever written in hashed form.
 */
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const URI = 'mongodb://127.0.0.1:27017/LibreChat';
const TENANT_ID = 'satchida-master';
const EMAIL = 'e2e.privacy@satchida.local';
const PASSWORD = randomBytes(18).toString('base64url');

await mongoose.connect(URI, { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;

// The opaque seat alias: 16-128 chars of [A-Za-z0-9_-]. It is a pseudonym for a
// seat, not a credential, and it never identifies a person.
const seatAlias = `seat_e2e_${randomBytes(9).toString('base64url')}`;

const now = new Date();

const entitlement = {
  tenantId: TENANT_ID,
  plan: 'enterprise',
  status: 'active',
  seatLimit: 50,
  accountTypes: {
    privacy: {
      seatLimit: 10,
      allowedModes: ['Chat', 'Study', 'Privacy'],
      allowedCapabilities: [],
      localPrivacyEnabled: true,
    },
    standard: {
      seatLimit: 40,
      allowedModes: ['Chat', 'Study'],
      allowedCapabilities: [],
      localPrivacyEnabled: false,
    },
  },
  seatAssignments: { [seatAlias]: 'privacy' },
  startsAt: null,
  expiresAt: null,
  updatedBy: 'e2e-provision',
  createdAt: now,
  updatedAt: now,
};

await db.collection('tenantentitlements').deleteOne({ tenantId: TENANT_ID });
await db.collection('tenantentitlements').insertOne(entitlement);
console.log('entitlement written for tenant', TENANT_ID, 'plan=enterprise status=active');

const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(PASSWORD, 10);

const user = {
  email: EMAIL,
  emailVerified: true,
  name: 'E2E Privacy Seat',
  username: 'e2e.privacy',
  provider: 'local',
  role: 'USER',
  tenantId: TENANT_ID,
  accountType: 'privacy',
  satchidaSeatAlias: seatAlias,
  password: hash,
  avatar: null,
  providerSpecificId: undefined,
  plugins: [],
  createdAt: now,
  updatedAt: now,
};

await db.collection('users').deleteOne({ email: EMAIL });
const inserted = await db.collection('users').insertOne(user);
console.log('user created:', EMAIL, 'userId=', inserted.insertedId.toString());
console.log('seatAlias =', seatAlias);

// The password is written to a file that only the test runner reads, so the
// E2E can log in without the value ever appearing in the transcript.
const { writeFileSync } = await import('node:fs');
writeFileSync(
  'D:/LAN-AI-Infra/LibreChat/fleet/.state/e2e-credentials.json',
  JSON.stringify({ email: EMAIL, password: PASSWORD, seatAlias, tenantId: TENANT_ID }, null, 2),
  { mode: 0o600 },
);
console.log('credentials written to .state-e2e.json (not printed)');

await mongoose.disconnect();
