/**
 * Set the tenant's account plans to the STANDARD offering and re-derive the
 * token limits from the captured official price.
 *
 * The point of the derivation is that the price is the lever: a plan whose
 * price is not the commercial one gets an allowance that is not the commercial
 * one, and nothing else in the system notices.
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
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

// The standard offering: the price a seat of each type costs.
const STANDARD = {
  basic: 400,
  standard: 400,
  family: 1200,
  pro: 1500,
  pro_family: 0,
  enterprise: 0,
  privacy: 2500,
};

// Name the reference model on every policy: the model the entitlement is
// measured at.
for (const accountType of Object.keys(STANDARD)) {
  await api('/api/pricing/policy', 'PUT', {
    account_type: accountType,
    reference_model: 'deepseek-v4.1-flash',
  });
}

console.log('setting the tenant plans to the standard prices, with no explicit ceiling:');
for (const [accountType, price] of Object.entries(STANDARD)) {
  const saved = await api(`/api/tenant/${TENANT}/account-plan`, 'PUT', {
    account_type: accountType,
    display_name: accountType,
    per_seat_cost_inr: price,
    quota_units: 1_000_000,
    input_mtok_ceiling: 0,
    output_mtok_ceiling: 0,
    enabled: true,
    term_months: 0,
    seat_count: 4,
  });
  const plan = saved.data;
  console.log(
    `  ${accountType.padEnd(11)} Rs${price}  ->  ${plan.input_mtok_ceiling} Mtok in, ${plan.output_mtok_ceiling} Mtok out` +
      (plan.derivation_reason ? `\n      ${plan.derivation_reason}` : '')
  );
}

console.log('\nthe same plan with a NEGOTIATED price of Rs1500 for a basic seat (standard Rs400):');
const negotiated = await api('/api/pricing/derive', 'POST', {
  account_type: 'basic',
  negotiated_cost_inr: 1500,
});
console.log(
  `  ${negotiated.data.input_mtok} Mtok in, ${negotiated.data.output_mtok} Mtok out (multiplier ${negotiated.data.multiplier.toFixed(3)})`
);
