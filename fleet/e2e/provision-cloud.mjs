/**
 * Provision the cloud E2E seat.
 *
 * The operator's side (One-API):
 *   1. the tenant, with its account plans and policy groups
 *   2. the seat policy: which modes, models and channels this seat may use
 *   3. the per-seat bearer token
 *
 * The tenant's side (LibreChat):
 *   4. the user that carries the seat alias and the seat token
 *
 * Every credential is written to the tenant's own state file and is never
 * printed.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';

const ONE_API = 'http://127.0.0.1:4000';
const TENANT_ID = 'satchida-master';
// A stable alias, so re-running the provisioning does not leave a trail of
// orphaned seat policies behind.
const SEAT_ALIAS = 'seat_e2e_cloud_e2e1';
const EMAIL = 'e2e.cloud@satchida.local';

function oneApiAdminToken() {
  const py = String.raw`
import sqlite3
con = sqlite3.connect(r"D:\LAN-AI-Infra\one-api\one-api.db")
row = con.execute("SELECT access_token FROM users WHERE role >= 100 AND status = 1 ORDER BY id LIMIT 1").fetchone()
print(row[0] if row else "")
`;
  const file = 'C:/Users/WINDIE~1/AppData/Local/Temp/opencode/readadmin.py';
  writeFileSync(file, py);
  return execFileSync('python', [file], { encoding: 'utf8' }).trim();
}

const adminToken = oneApiAdminToken();
if (!adminToken) throw new Error('no operator access token was found');

async function api(path, method, body, { tolerate404 = false } = {}) {
  const res = await fetch(`${ONE_API}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      Authorization: adminToken,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text.slice(0, 300) };
  }
  if (!res.ok) {
    if (tolerate404 && res.status === 404) return parsed;
    throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(parsed).slice(0, 400)}`);
  }
  return parsed;
}

// 1. The tenant. It may already exist from a previous run.
const existing = await api(`/api/tenant/${TENANT_ID}`, 'GET', null, { tolerate404: true });
if (!existing?.success) {
  const created = await api('/api/tenant', 'POST', {
    id: TENANT_ID,
    name: 'Satchida HQ',
    plan: 'pro',
    max_seats: 8,
    subscription_model: 'allocated',
  });
  if (!created?.success) throw new Error(`tenant create failed: ${JSON.stringify(created)}`);
  console.log('tenant created:', TENANT_ID);
} else {
  console.log('tenant exists:', TENANT_ID);
}

// 2. The tenant's cloud quota.
//
//    The tenant-token path answers 402 "Tenant cloud quota is exhausted" when
//    the tenant's period quota is zero, and the quota used to be settable only
//    at tenant creation, so a tenant that ran out could never be given more.
await api('/api/tenant', 'PUT', {
  id: TENANT_ID,
  name: 'Satchida HQ',
  plan: 'pro',
  max_seats: 8,
  status: 1,
  monthly_fee_inr: 9999,
  grace_period_days: 3,
  period_quota_units: 50_000_000,
  subscription_period: 30,
  subscription_model: 'allocated',
});
console.log('tenant cloud quota written for', TENANT_ID);

// 3. The tenant's spend budget.
//
//    The tenant path is budget-enforced: a request with no budget for its
//    owner is refused with "budget not found", so a tenant needs one before
//    its seats can spend anything.
await api('/api/budget/', 'PUT', {
  owner_type: 'tenant',
  owner_id: TENANT_ID,
  period: 'monthly',
  nominal_limit_usd: 1000,
  hard_limit_usd: 1200,
  hard_stop_percent: 100,
  warn_percent: 80,
});
console.log('tenant spend budget written for', TENANT_ID);

// 4. The operator's allocation for the account type.
//
//    The seeded plans carry no quota, so a seat on them is refused with 402
//    "insufficient quota" the moment it makes a request. An allocation is the
//    operator's decision, so it is made here rather than assumed.
await api(`/api/tenant/${TENANT_ID}/account-plan`, 'PUT', {
  account_type: 'pro',
  display_name: 'Pro',
  quota_units: 5_000_000,
  per_seat_cost_inr: 999,
  input_mtok_ceiling: 5_000_000,
  output_mtok_ceiling: 1_000_000,
  enabled: true,
  term_months: 0,
  seat_count: 8,
});
console.log('pro allocation written for', TENANT_ID);

// 3. The seat policy. The seat is a cloud seat: Chat, Study and Work on the
//    cloud channel, and the local channels as well so a fallback exists.
await api(`/api/tenant/${TENANT_ID}/seat-policy`, 'PUT', {
  alias_id: SEAT_ALIAS,
  seat_tier: 'pro',
  profile_type: 'adult',
  account_type: 'pro',
  allowed_modes: ['chat', 'study', 'work'],
  allowed_models: ['Chat', 'Study', 'Work'],
  allowed_channels: [1, 2, 3],
});
console.log('seat policy written for', SEAT_ALIAS);

// 3. The per-seat bearer token.
const minted = await api(`/api/tenant/${TENANT_ID}/token`, 'POST', {
  group: 'pro',
  seat_alias: SEAT_ALIAS,
  models: 'Chat,Study,Work',
  channels: '1,2,3',
});
if (!minted?.success) throw new Error(`token mint failed: ${JSON.stringify(minted)}`);
const seatToken = minted?.data?.key;
if (!seatToken) throw new Error('the minted token carried no key');
console.log('seat token minted for', SEAT_ALIAS, '(value not printed)');

// 4. The tenant's own user record, and the tenant-local entitlement that
//    tells the tenant's LibreChat what this seat may do.
//
//    The operator's seat policy and the tenant's entitlement are two halves of
//    the same decision. The operator decides which modes, models and channels
//    the seat may use; the tenant's own store records the same entitlement so
//    the tenant can enforce it locally, and a seat that is missing from it is
//    refused locally even when the operator granted it.
await mongoose.connect('mongodb://127.0.0.1:27017/LibreChat', { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;

const entitlements = db.collection('tenantentitlements');
const priorEntitlement = await entitlements.findOne({ tenantId: TENANT_ID });
const accountTypes = priorEntitlement?.accountTypes ?? {};
const seatAssignments = priorEntitlement?.seatAssignments ?? {};
seatAssignments[SEAT_ALIAS] = 'pro';
accountTypes.pro = {
  seatLimit: 20,
  allowedModes: ['Chat', 'Study', 'Work'],
  allowedCapabilities: ['work_tools', 'mcp', 'agents', 'code_execution'],
  localPrivacyEnabled: false,
};
const now = new Date();
await entitlements.deleteOne({ tenantId: TENANT_ID });
await entitlements.insertOne({
  tenantId: TENANT_ID,
  plan: 'enterprise',
  status: 'active',
  seatLimit: 50,
  accountTypes,
  seatAssignments,
  startsAt: null,
  expiresAt: null,
  updatedBy: 'e2e-provision',
  createdAt: priorEntitlement?.createdAt ?? now,
  updatedAt: now,
});
console.log('tenant-local entitlement updated for', SEAT_ALIAS);

const bcrypt = (await import('bcryptjs')).default;
const password = randomBytes(18).toString('base64url');
await db.collection('users').deleteOne({ email: EMAIL });
await db.collection('users').insertOne({
  email: EMAIL,
  emailVerified: true,
  name: 'E2E Cloud Seat',
  username: 'e2e.cloud',
  provider: 'local',
  role: 'USER',
  tenantId: TENANT_ID,
  accountType: 'pro',
  satchidaSeatAlias: SEAT_ALIAS,
  seatToken,
  password: bcrypt.hashSync(password, 10),
  avatar: null,
  plugins: [],
  createdAt: now,
  updatedAt: now,
});
console.log('tenant-side user created:', EMAIL);

const credsPath = 'D:/LAN-AI-Infra/LibreChat/fleet/.state/e2e-cloud-credentials.json';
writeFileSync(
  credsPath,
  JSON.stringify({ email: EMAIL, password, seatAlias: SEAT_ALIAS, tenantId: TENANT_ID }, null, 2),
  { mode: 0o600 },
);
console.log('credentials written to', credsPath, '(not printed)');

await mongoose.disconnect();
