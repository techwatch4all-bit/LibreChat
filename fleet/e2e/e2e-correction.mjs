/**
 * Verify the MID-TERM correction push.
 *
 * A seat has consumed against one allowance. The price changes. The correction
 * has to reach the seat, or the seat is left over an allowance it never had
 * and is refused with no explanation.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ONE_API = 'http://127.0.0.1:4000';
const TENANT = 'satchida-master';

const py = String.raw`
import sqlite3, json, sys
con = sqlite3.connect(r"D:\LAN-AI-Infra\one-api\one-api.db")
tok = con.execute("SELECT access_token FROM users WHERE role >= 100 AND status = 1 ORDER BY id LIMIT 1").fetchone()[0]
print(json.dumps({
  "admin": tok,
  "usage": [list(r) for r in con.execute(
     "SELECT tenant_id, alias_id, account_type, canonical_model, input_tokens, output_tokens, period_start FROM seat_token_usages")],
  "plans": [list(r) for r in con.execute(
     "SELECT account_type, per_seat_cost_inr, input_mtok_ceiling, output_mtok_ceiling FROM tenant_account_plans WHERE tenant_id=?", (sys.argv[1] if len(sys.argv)>1 else "satchida-master",))],
  "tiers": [list(r) for r in con.execute(
     "SELECT name, monthly_price_inr, quota_units FROM license_tiers")],
}))
`;
const pyFile = 'C:/Users/WINDIE~1/AppData/Local/Temp/opencode/readstate.py';
writeFileSync(pyFile, py);

function readState() {
  const raw = execFileSync('python', [pyFile, TENANT], { encoding: 'utf8' });
  return JSON.parse(raw);
}

const adminToken = execFileSync('python', [
  'C:/Users/WINDIE~1/AppData/Local/Temp/opencode/readadmin.py',
], { encoding: 'utf8' }).trim();
const admin = { 'content-type': 'application/json', Authorization: adminToken };

async function api(path, method, body) {
  const res = await fetch(`${ONE_API}${path}`, {
    method,
    headers: admin,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

const before = readState();
console.log('1. before the correction:');
for (const usage of before.usage) {
  console.log(`   seat ${usage[1]} (${usage[2]}) used ${usage[4]} in / ${usage[5]} out`);
}
for (const plan of before.plans) {
  if (plan[0] === 'pro') console.log(`   pro plan: Rs${plan[1]} -> ${plan[2]} in / ${plan[3]} out`);
}

// 2. The standard offering is corrected: the pro seat's price rises.
await api('/api/pricing/policy', 'PUT', {
  account_type: 'pro',
  seat_cost_inr: 3000,
  budget_usd: 10,
  reference_model: 'deepseek-v4.1-flash',
});
const after = readState();
console.log('\n2. after the offering was corrected to Rs3000:');
for (const usage of after.usage) {
  console.log(`   seat ${usage[1]} (${usage[2]}) used ${usage[4]} in / ${usage[5]} out`);
}
for (const plan of after.plans) {
  if (plan[0] === 'pro') console.log(`   pro plan: Rs${plan[1]} -> ${plan[2]} in / ${plan[3]} out`);
}
for (const tier of after.tiers) {
  if (tier[0] === 'pro') console.log(`   pro licence tier: Rs${tier[1]}, ${tier[2]} quota units`);
}

// 3. Put the standard price back.
await api('/api/pricing/policy', 'PUT', {
  account_type: 'pro',
  seat_cost_inr: 1500,
  budget_usd: 10,
  reference_model: 'deepseek-v4.1-flash',
});
const restored = readState();
console.log('\n3. with the standard price back:');
for (const plan of restored.plans) {
  if (plan[0] === 'pro') console.log(`   pro plan: Rs${plan[1]} -> ${plan[2]} in / ${plan[3]} out`);
}
for (const tier of restored.tiers) {
  if (tier[0] === 'pro') console.log(`   pro licence tier: Rs${tier[1]}, ${tier[2]} quota units`);
}
