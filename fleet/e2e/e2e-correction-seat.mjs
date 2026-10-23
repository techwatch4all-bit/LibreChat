/**
 * Verify the mid-term correction on a TENANT's own price.
 *
 * A tenant negotiates mid-term. The seat's allowance moves, and the seat that
 * had already consumed against the old allowance must not be left over the new
 * one with no way to tell why.
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
  "usage": [list(r) for r in con.execute(
     "SELECT alias_id, account_type, input_tokens, output_tokens FROM seat_token_usages WHERE tenant_id=? AND account_type='pro'",
     (sys.argv[1],))],
  "plan": [list(r) for r in con.execute(
     "SELECT account_type, per_seat_cost_inr, input_mtok_ceiling, output_mtok_ceiling FROM tenant_account_plans WHERE tenant_id=? AND account_type='pro'",
     (sys.argv[1],))],
}))
`;
const pyFile = 'C:/Users/WINDIE~1/AppData/Local/Temp/opencode/readpro.py';
writeFileSync(pyFile, py);

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

function state() {
  return JSON.parse(execFileSync('python', [pyFile, TENANT], { encoding: 'utf8' }));
}

function show(label) {
  const s = state();
  console.log(`${label}`);
  for (const usage of s.usage) {
    console.log(`   seat ${usage[0]} used ${usage[2]} in / ${usage[3]} out`);
  }
  console.log(`   pro plan: Rs${s.plan[0][1]} -> ${s.plan[0][2]} in / ${s.plan[0][3]} out`);
}

show('1. before the negotiation:');

// 2. The tenant negotiates UP mid-term: the allowance rises.
await api(`/api/tenant/${TENANT}/account-plan`, 'PUT', {
  account_type: 'pro',
  display_name: 'pro',
  per_seat_cost_inr: 3000,
  quota_units: 5_000_000,
  input_mtok_ceiling: 0,
  output_mtok_ceiling: 0,
  enabled: true,
  term_months: 0,
  seat_count: 8,
});
show('\n2. after negotiating up to Rs3000 (the allowance rose):');

// 3. And back DOWN: the allowance falls below what the seat has used.
await api(`/api/tenant/${TENANT}/account-plan`, 'PUT', {
  account_type: 'pro',
  display_name: 'pro',
  per_seat_cost_inr: 600,
  quota_units: 5_000_000,
  input_mtok_ceiling: 0,
  output_mtok_ceiling: 0,
  enabled: true,
  term_months: 0,
  seat_count: 8,
});
show('\n3. after negotiating down to Rs600 (the allowance fell below the usage):');

// 4. Restore the standard price.
await api(`/api/tenant/${TENANT}/account-plan`, 'PUT', {
  account_type: 'pro',
  display_name: 'pro',
  per_seat_cost_inr: 1500,
  quota_units: 5_000_000,
  input_mtok_ceiling: 0,
  output_mtok_ceiling: 0,
  enabled: true,
  term_months: 0,
  seat_count: 8,
});
show('\n4. back at the standard Rs1500:');
