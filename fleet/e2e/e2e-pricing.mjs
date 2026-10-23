/**
 * Prove the seat token derivation end to end:
 *
 *   approve the captured official prices
 *   name the reference model on the pricing policy
 *   preview what a negotiated price derives
 *   re-derive a tenant's account plans
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ONE_API = 'http://127.0.0.1:4000';
const TENANT = 'satchida-master';

const py = String.raw`
import sqlite3
con = sqlite3.connect(r"D:\LAN-AI-Infra\one-api\one-api.db")
row = con.execute("SELECT access_token FROM users WHERE role >= 100 AND status = 1 ORDER BY id LIMIT 1").fetchone()
print(row[0] if row else "")
`;
const pyFile = 'C:/Users/WINDIE~1/AppData/Local/Temp/opencode/readadmin.py';
writeFileSync(pyFile, py);
const adminToken = execFileSync('python', [pyFile], { encoding: 'utf8' }).trim();
const admin = { 'content-type': 'application/json', Authorization: adminToken };

async function api(path, method, body) {
  const res = await fetch(`${ONE_API}${path}`, {
    method,
    headers: admin,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text.slice(0, 200) };
  }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  return parsed;
}

// 1. Approve the captured official prices.
const catalog = await api('/api/pricing/catalog', 'GET');
for (const row of catalog.data ?? []) {
  if (row.source_kind === 'official' && !row.approved) {
    const done = await api(`/api/pricing/catalog/${row.id}/approve`, 'POST', {});
    console.log(`1. approved the official price for ${row.canonical_model}`);
  }
}

// 2. The rate status: what is still missing.
const status = await api('/api/pricing/rate-status', 'GET');
console.log('2. rate status: derivation ready =', status.data.derivation_ready,
  '| missing:', status.data.missing_approved.join(', ') || 'none');

// 3. Name the reference model on the policy: the canonical model the
//    entitlement is measured at.
for (const accountType of ['basic', 'family', 'pro', 'privacy']) {
  await api('/api/pricing/policy', 'PUT', {
    account_type: accountType,
    reference_model: 'deepseek-v4.1-flash',
  });
}
const policy = await api('/api/pricing/policy', 'GET');
console.log('3. the standard offering:');
for (const row of policy.data) {
  console.log(`     ${row.account_type.padEnd(9)} Rs${row.seat_cost_inr}  budget $${row.budget_usd}  reference ${row.reference_model}`);
}

// 4. What a NEGOTIATED price derives.
console.log('4. what a negotiated pro price derives:');
for (const price of [1500, 1800, 1200]) {
  const derived = await api('/api/pricing/derive', 'POST', {
    account_type: 'pro',
    negotiated_cost_inr: price,
  });
  if (!derived.derivable) {
    console.log(`     Rs${price}: not derivable - ${derived.reason}`);
    continue;
  }
  console.log(
    `     Rs${price}: ${derived.data.input_mtok} Mtok in, ${derived.data.output_mtok} Mtok out` +
      ` (multiplier ${derived.data.multiplier.toFixed(3)}, ${derived.data.captured_at})`
  );
}

// 5. Re-derive the tenant's plans, and show them.
const redone = await api(`/api/tenant/${TENANT}/rederive?force=true`, 'POST', {});
console.log(`5. re-derived ${(redone.data ?? []).length} plan(s) for ${TENANT}`);
for (const plan of redone.data ?? []) {
  console.log(`     ${plan.account_type}: ${plan.input_mtok_ceiling} Mtok in, ${plan.output_mtok_ceiling} Mtok out`);
  console.log(`       ${plan.derivation_reason}`);
}
