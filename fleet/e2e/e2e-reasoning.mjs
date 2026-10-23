/**
 * Verify the reasoning policy and the account-type entitlements.
 *
 * The reasoning policy is the money-relevant part: a reasoning model in the
 * chat mode spends billed output tokens thinking before it answers.
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

const MODES = {
  basic: ['chat'],
  standard: ['chat'],
  family: ['chat', 'study'],
  pro: ['chat', 'study', 'work'],
  pro_family: ['chat', 'study', 'work'],
  enterprise: ['chat', 'study', 'work', 'privacy'],
  privacy: ['chat', 'study', 'work', 'privacy'],
};
const MODELS = {
  basic: ['Chat'],
  standard: ['Chat'],
  family: ['Chat', 'Study'],
  pro: ['Chat', 'Study', 'Work'],
  pro_family: ['Chat', 'Study', 'Work'],
  enterprise: ['Chat', 'Study', 'Work', 'Privacy'],
  privacy: ['Chat', 'Study', 'Work', 'Privacy'],
};

async function provision(accountType, alias) {
  await api(`/api/tenant/${TENANT}/account-plan`, 'PUT', {
    account_type: accountType,
    display_name: accountType,
    quota_units: 5_000_000,
    per_seat_cost_inr: 499,
    input_mtok_ceiling: 5_000_000,
    output_mtok_ceiling: 1_000_000,
    enabled: true,
    term_months: 0,
    seat_count: 4,
  });
  await api(`/api/tenant/${TENANT}/seat-policy`, 'PUT', {
    alias_id: alias,
    seat_tier: accountType,
    profile_type: 'adult',
    account_type: accountType,
    allowed_modes: MODES[accountType],
    allowed_models: MODELS[accountType],
    allowed_channels: [1, 2, 3],
  });
  const minted = await api(`/api/tenant/${TENANT}/token`, 'POST', {
    group: accountType,
    seat_alias: alias,
    models: MODELS[accountType].join(','),
    channels: '1,2,3',
  });
  return minted?.data?.key;
}

async function chat(token, mode, text, maxTokens = 256) {
  const res = await fetch(`${ONE_API}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Satchida-Mode': mode,
    },
    body: JSON.stringify({
      model: mode === 'privacy' ? 'Privacy' : mode === 'work' ? 'Work' : mode === 'study' ? 'Study' : 'Chat',
      messages: [{ role: 'user', content: text }],
      max_tokens: maxTokens,
    }),
  });
  const body = await res.json();
  return {
    status: res.status,
    usage: body?.usage,
    reply: body?.choices?.[0]?.message?.content ?? body?.error?.message ?? '',
    reasoning: body?.choices?.[0]?.message?.reasoning_content ?? '',
  };
}

console.log('=== THE REASONING POLICY: chat must not think ===');
for (const accountType of ['basic', 'pro', 'privacy']) {
  const alias = `reason_${accountType}_e2e`;
  const token = await provision(accountType, alias);
  const out = await chat(token, 'chat', 'Reply with exactly: OK');
  const thinking = (out.reasoning || '').length;
  console.log(
    `  ${accountType.padEnd(9)} chat   -> ${out.status}  reply=${JSON.stringify(String(out.reply).slice(0, 18))}  usage=${JSON.stringify(out.usage)}  thinking_chars=${thinking}`
  );
}

console.log('\n=== THE DEEP MODES: work may think ===');
for (const accountType of ['basic', 'pro']) {
  const alias = `reason_${accountType}_e2e`;
  const token = await provision(accountType, alias);
  const out = await chat(token, 'work', 'Reply with exactly: OK');
  console.log(
    `  ${accountType.padEnd(9)} work   -> ${out.status}  reply=${JSON.stringify(String(out.reply).slice(0, 18))}  thinking_chars=${(out.reasoning || '').length}`
  );
}

console.log('\n=== THE ACCOUNT-TYPE MODES ===');
for (const accountType of ['basic', 'family', 'pro', 'enterprise', 'privacy']) {
  const alias = `reason_${accountType}_e2e`;
  const token = await provision(accountType, alias);
  const results = [];
  for (const mode of ['chat', 'study', 'work', 'privacy']) {
    if (mode === 'privacy') continue; // the cloud gateway refuses it by design
    const out = await chat(token, mode, 'Reply with exactly: OK');
    results.push(`${mode}:${out.status}`);
  }
  console.log(`  ${accountType.padEnd(11)} ${results.join('  ')}`);
}
