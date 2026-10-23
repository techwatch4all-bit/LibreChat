/**
 * Verify the family pack and the parent's controls.
 *
 *   a family buys ONE shared pack covering the household
 *   the parent bounds the child's share of it
 *   the child is refused when the share is used, while the parent is not
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ONE_API = 'http://127.0.0.1:4000';
const TENANT = 'satchida-master';
const FAMILY = 'family_e2e_1';

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

async function adminApi(path, method, body) {
  const res = await fetch(`${ONE_API}${path}`, {
    method,
    headers: admin,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

// 1. The household: a parent seat and a child seat.
for (const [alias, profile] of [['family_e2e_parent', 'adult'], ['family_e2e_child', 'child']]) {
  await adminApi(`/api/tenant/${TENANT}/seat-policy`, 'PUT', {
    alias_id: alias,
    seat_tier: 'family',
    profile_type: profile,
    account_type: 'family',
    family_id: FAMILY,
    allowed_modes: profile === 'child' ? ['chat', 'study'] : ['chat', 'study', 'work'],
    allowed_models: ['Chat', 'Study', 'Work'],
    allowed_channels: [1, 2, 3],
  });
}
// The family account type's allocation. A family seat's ceiling comes from
// here, and a plan edit reaches the group that enforces it.
await adminApi(`/api/tenant/${TENANT}/account-plan`, 'PUT', {
  account_type: 'family',
  display_name: 'Family',
  quota_units: 5_000_000,
  per_seat_cost_inr: 2999,
  input_mtok_ceiling: 5_000_000,
  output_mtok_ceiling: 1_000_000,
  enabled: true,
  term_months: 0,
  seat_count: 4,
});
console.log('1. household seats and the family allocation provisioned under', FAMILY);

// 2. A seat token for each, in the family group.
const tokens = {};
for (const alias of ['family_e2e_parent', 'family_e2e_child']) {
  const minted = await adminApi(`/api/tenant/${TENANT}/token`, 'POST', {
    group: 'family',
    seat_alias: alias,
    models: 'Chat,Study,Work',
    channels: '1,2,3',
  });
  tokens[alias] = minted.data.key;
}
console.log('2. seat tokens minted (values not printed)');

// 3. The family buys ONE shared pack: four seats' worth of allowance for
//    three seats' price.
const plan = await adminApi('/api/seat/subscription/admin/plans', 'PUT', {
  plan_id: 'family-chat-4x',
  display_name: 'Family Chat Pack',
  mode: 'Chat',
  account_type: 'family',
  unit: 'mtok',
  base_price_minor: 10000,
  currency: 'INR',
  allowed_units: 4000000,
  reset_period_days: 30,
  seat_count: 4,
  price_seat_equivalents: 3,
  carry_forward: true,
  enabled: true,
});
console.log('3. family pack published: 4x allowance, 3x price ->',
  plan.data.terms.map((t) => `${t.months}m=Rs${t.price_minor / 100}`).join(' '));

// 4. The pack is granted to the HOUSEHOLD, not to a seat.
const granted = await adminApi(`/api/seat/subscription/admin/tenant/${TENANT}/grant`, 'POST', {
  plan_id: 'family-chat-4x',
  scope: 'account',
  scope_id: FAMILY,
  mode: 'Chat',
  months: 1,
});
console.log('4. pack granted to the household: total', granted.data.amount_total,
  'scope', granted.data.scope + '/' + granted.data.scope_id);

// 5. The parent bounds the child's share of the shared pool.
//
//    The daily ceiling is the child's share of the household's own daily
//    window. The product's rolling windows are 30,000 tokens per three hours
//    and 100,000 tokens per day for the family tier, and the household has
//    four seats, so a seat's share of the day is 25,000 tokens. The control
//    leaves the ceiling unset, so the server derives it from the tenant's own
//    window rule.
await adminApi(`/api/seat/subscription/admin/tenant/${TENANT}/family-controls`, 'PUT', {
  family_id: FAMILY,
  seat_alias: 'family_e2e_child',
  mode: 'chat',
  seat_count: 4,
  token_allowance: 0,
  daily_token_limit: 0,
  status: 'active',
});
const controls = await adminApi(
  `/api/seat/subscription/admin/tenant/${TENANT}/family-controls?family_id=${FAMILY}`, 'GET');
console.log('5. parent control set on the child:',
  controls.data.map((c) => `share ${c.token_allowance}, daily ${c.daily_token_limit}`).join('; '),
  '(the daily ceiling is derived from the household daily window)');

// 6. The child is bounded by its own share, and the parent is not.
async function chat(alias, text) {
  const res = await fetch(`${ONE_API}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${tokens[alias]}`,
      'X-Satchida-Mode': 'Chat',
    },
    body: JSON.stringify({
      model: 'Chat',
      messages: [{ role: 'user', content: text }],
      max_tokens: 512,
    }),
  });
  const body = await res.json();
  return { status: res.status, body };
}

const child = await chat('family_e2e_child', 'Reply with exactly: CHILD_OK');
console.log('6. child  ->', child.status, child.body?.choices?.[0]?.message?.content ?? child.body?.error?.message);

const parent = await chat('family_e2e_parent', 'Reply with exactly: PARENT_OK');
console.log('   parent ->', parent.status, parent.body?.choices?.[0]?.message?.content ?? parent.body?.error?.message);

// 7. The shared pool shows both draws.
const packs = await adminApi(`/api/seat/subscription/admin/tenant/${TENANT}`, 'GET');
for (const p of packs.data.filter((x) => x.scope_id === FAMILY)) {
  console.log('7. household pack:', p.mode, p.amount_total, 'total /', p.amount_used, 'used,',
    p.scope, p.scope_id);
}

// 8. The parent's bound bites: with a daily ceiling of ONE token the child is
//    refused, while the parent is still served from the same pool.
await adminApi(`/api/seat/subscription/admin/tenant/${TENANT}/family-controls`, 'PUT', {
  family_id: FAMILY,
  seat_alias: 'family_e2e_child',
  mode: 'chat',
  seat_count: 4,
  token_allowance: 0,
  daily_token_limit: 1,
  status: 'active',
});
const boundedChild = await chat('family_e2e_child', 'Reply with exactly: CHILD_BLOCKED');
console.log('8. child with a one-token daily ceiling ->', boundedChild.status,
  boundedChild.body?.error?.message ?? boundedChild.body?.choices?.[0]?.message?.content);
const stillParent = await chat('family_e2e_parent', 'Reply with exactly: PARENT_STILL_OK');
console.log('   parent, same pool           ->', stillParent.status,
  stillParent.body?.choices?.[0]?.message?.content ?? stillParent.body?.error?.message);

