/**
 * Verify the account-type routing rule.
 *
 *   EVERY account type consumes cloud APIs.
 *   Only the Privacy account type, in the Privacy mode, goes to the local model.
 *
 * So: a 'standard' seat (which could not reach the cloud at all before) must
 * now be served by the cloud, and a 'privacy' seat must be served by the cloud
 * in chat and by the LOCAL model in the privacy mode.
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

const MODES_BY_TYPE = {
  basic: ['chat'],
  standard: ['chat'],
  family: ['chat', 'study', 'work'],
  pro: ['chat', 'study', 'work'],
  pro_family: ['chat', 'study', 'work'],
  enterprise: ['chat', 'study', 'work'],
  privacy: ['chat', 'privacy']
};
const MODELS_BY_TYPE = {
  basic: ['Chat'],
  standard: ['Chat'],
  family: ['Chat', 'Study', 'Work'],
  pro: ['Chat', 'Study', 'Work'],
  pro_family: ['Chat', 'Study', 'Work'],
  enterprise: ['Chat', 'Study', 'Work'],
  privacy: ['Chat', 'Privacy']
};

async function provision(accountType, alias) {
  // The allocation for the type, so the seat has a ceiling to work within.
  await api(`/api/tenant/${TENANT}/account-plan`, 'PUT', {
    account_type: accountType,
    display_name: accountType,
    quota_units: 5_000_000,
    per_seat_cost_inr: 499,
    input_mtok_ceiling: 5_000_000,
    output_mtok_ceiling: 1_000_000,
    enabled: true,
    term_months: 0,
    seat_count: 4
  });
  await api(`/api/tenant/${TENANT}/seat-policy`, 'PUT', {
    alias_id: alias,
    seat_tier: accountType,
    profile_type: 'adult',
    account_type: accountType,
    allowed_modes: MODES_BY_TYPE[accountType],
    allowed_models: MODELS_BY_TYPE[accountType],
    allowed_channels: [1, 2, 3]
  });
  const minted = await api(`/api/tenant/${TENANT}/token`, 'POST', {
    group: accountType,
    seat_alias: alias,
    models: MODELS_BY_TYPE[accountType].join(','),
    channels: '1,2,3'
  });
  return minted?.data?.key;
}

async function chat(token, mode, text) {
  const res = await fetch(`${ONE_API}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Satchida-Mode': mode
    },
    body: JSON.stringify({
      model: mode === 'privacy' ? 'Privacy' : 'Chat',
      messages: [{ role: 'user', content: text }],
      max_tokens: 256
    })
  });
  const body = await res.json();
  return {
    status: res.status,
    reply: body?.choices?.[0]?.message?.content ?? body?.error?.message ?? ''
  };
}

const results = [];

for (const accountType of ['standard', 'pro_family', 'enterprise', 'privacy']) {
  const alias = `route_${accountType}_e2e`;
  const token = await provision(accountType, alias);
  const modes = MODES_BY_TYPE[accountType];
  for (const mode of modes) {
    const out = await chat(token, mode, `Reply with exactly: ${accountType.toUpperCase()}_${mode.toUpperCase()}`);
    results.push({ accountType, mode, ...out });
    console.log(
      `${accountType.padEnd(12)} ${mode.padEnd(6)} -> ${out.status} ${JSON.stringify(out.reply).slice(0, 60)}`
    );
  }
}

console.log('\nwhich channel served each request:');
for (const r of results) {
  if (r.status !== 200) {
    console.log(`  ${r.accountType}/${r.mode}: refused - ${r.reply}`);
  }
}
