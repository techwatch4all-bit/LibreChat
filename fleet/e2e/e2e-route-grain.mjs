/**
 * Verify the route policy at the right grain.
 *
 * The claim: a provider change is a ROUTE edit, a move of a whole account type
 * is ONE edit to the account type's route policy, and a seat's own list only
 * NARROWS it.
 *
 * So: set the account type's routes, check that the seats follow WITHOUT being
 * touched, and check that a seat which narrows keeps its narrow.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ONE_API = 'http://127.0.0.1:4000';
const TENANT = 'satchida-master';
const TEMP = process.env.TEMP;

const py = String.raw`
import sqlite3
con = sqlite3.connect(r"D:\LAN-AI-Infra\one-api\one-api.db")
row = con.execute("SELECT access_token FROM users WHERE role >= 100 AND status = 1 ORDER BY id LIMIT 1").fetchone()
print(row[0] if row else "")
`;
const pyFile = `${TEMP}/opencode/readadmin.py`;
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

async function seat(accountType, alias, modes, models) {
  await api(`/api/tenant/${TENANT}/seat-policy`, 'PUT', {
    alias_id: alias,
    seat_tier: accountType,
    profile_type: 'adult',
    account_type: accountType,
    allowed_modes: modes,
    allowed_models: models
  });
  const minted = await api(`/api/tenant/${TENANT}/token`, 'POST', {
    group: accountType,
    seat_alias: alias,
    models: models.join(','),
    channels: '1,2,3,4'
  });
  return minted?.data?.key;
}

async function chat(token, mode, model) {
  const res = await fetch(`${ONE_API}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Satchida-Mode': mode
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Reply with exactly: GRAIN' }],
      max_tokens: 512
    })
  });
  const body = await res.json();
  return { status: res.status, reply: body?.choices?.[0]?.message?.content ?? body?.error?.message ?? '' };
}

// 1. The account type's routes are set ONCE.
await api(`/api/tenant/${TENANT}/account-type-routes`, 'PUT', {
  account_type: 'pro',
  channels: [1, 2, 3]
});
const policy = await api(`/api/tenant/${TENANT}/account-type-routes`, 'GET');
console.log('1. the account type route policy:');
for (const row of policy.data) {
  console.log(
    `   ${row.account_type.padEnd(11)} routes=[${row.routes.join(',')}] ` +
      `${row.route_names.join(' / ')} retention=${row.retention} declared=${row.declared}`
  );
}

// 2. A seat of that type inherits them, with no route list of its own.
const inherited = await seat('pro', 'grain_inherit_e2e', ['chat'], ['Chat']);
const via = await chat(inherited, 'chat', 'Chat');
console.log('\n2. a seat with no route list of its own ->', via.status, JSON.stringify(via.reply).slice(0, 50));

// 3. A seat that NARROWS to one route WITHIN its class keeps the narrow.
//    (A narrow OUTSIDE the class is refused, which is the retention rule.)
await api(`/api/tenant/${TENANT}/seat-policy`, 'PUT', {
  alias_id: 'grain_narrow_e2e',
  seat_tier: 'pro',
  profile_type: 'adult',
  account_type: 'pro',
  allowed_modes: ['chat'],
  allowed_models: ['Chat'],
  allowed_channels: [2]
});
const narrow = await seat('pro', 'grain_narrow_e2e', ['chat'], ['Chat']);
const viaNarrow = await chat(narrow, 'chat', 'Chat');
console.log('3. a seat that narrows to one route ->', viaNarrow.status, JSON.stringify(viaNarrow.reply).slice(0, 50));

// 4. Which channel served each.
const pyLog = String.raw`
import sqlite3
con = sqlite3.connect(r"D:\LAN-AI-Infra\one-api\one-api.db")
for r in con.execute("""SELECT seat_alias, mode, channel_id, upstream_provider
                        FROM logs WHERE seat_alias LIKE 'grain_%' ORDER BY id DESC LIMIT 4"""):
    print("   seat=%-22s mode=%-8s channel=%s provider=%s" % r)
`;
const logFile = `${TEMP}/opencode/readgrain.py`;
writeFileSync(logFile, pyLog);
console.log('\n4. which channel served each:');
console.log(execFileSync('python', [logFile], { encoding: 'utf8' }).trim());
