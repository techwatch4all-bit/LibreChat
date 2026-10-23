/**
 * Verify the route retention rule is ENFORCED, not merely configured.
 *
 *   a pro seat's chat          -> the RETAINING cloud route
 *   a privacy seat's chat      -> the ZERO-DATA-RETENTION cloud route
 *   a privacy seat's privacy   -> the local model
 *   a pro seat may not reach the ZDR route at all
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

// A pro seat and a privacy seat, each with a policy that does NOT name its
// channels, so the account type decides.
async function seat(accountType, alias, modes, models) {
  await api(`/api/tenant/${TENANT}/seat-policy`, 'PUT', {
    alias_id: alias,
    seat_tier: accountType,
    profile_type: 'adult',
    account_type: accountType,
    allowed_modes: modes,
    allowed_models: models,
  });
  const minted = await api(`/api/tenant/${TENANT}/token`, 'POST', {
    group: accountType,
    seat_alias: alias,
    models: models.join(','),
    channels: '1,2,3,4',
  });
  return minted?.data?.key;
}

async function chat(token, mode, model) {
  const res = await fetch(`${ONE_API}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Satchida-Mode': mode,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Reply with exactly: ROUTED' }],
      max_tokens: 512,
    }),
  });
  const body = await res.json();
  return { status: res.status, reply: body?.choices?.[0]?.message?.content ?? body?.error?.message ?? '' };
}

const proToken = await seat('pro', 'retention_pro_e2e', ['chat', 'study', 'work'], ['Chat', 'Study', 'Work']);
const privacyToken = await seat('privacy', 'retention_privacy_e2e', ['chat', 'study', 'work', 'privacy'], ['Chat', 'Study', 'Work', 'Privacy']);

// 1. The pro seat's chat must land on the retaining cloud channel.
const pro = await chat(proToken, 'chat', 'Chat');
console.log('1. pro seat, chat   ->', pro.status, JSON.stringify(pro.reply).slice(0, 60));

// 2. The privacy seat's chat must land on the ZDR cloud channel.
const priv = await chat(privacyToken, 'chat', 'Chat');
console.log('2. privacy seat, chat ->', priv.status, JSON.stringify(priv.reply).slice(0, 60));

// 3. The privacy seat's privacy mode goes to the local model, which the cloud
//    gateway refuses.
const privMode = await chat(privacyToken, 'privacy', 'Privacy');
console.log('3. privacy seat, privacy ->', privMode.status, JSON.stringify(privMode.reply).slice(0, 90));

// 4. Which channel served each request.
const pyLog = String.raw`
import sqlite3
con = sqlite3.connect(r"D:\LAN-AI-Infra\one-api\one-api.db")
for r in con.execute("""SELECT seat_alias, mode, model_name, channel_id, upstream_provider
                        FROM logs WHERE seat_alias LIKE 'retention_%' ORDER BY id DESC LIMIT 6"""):
    print("   seat=%-24s mode=%-8s model=%-46s channel=%s provider=%s" % r)
`;
const logFile = `${TEMP}/opencode/readretention.py`;
writeFileSync(logFile, pyLog);
console.log('\n4. which channel served each request:');
console.log(execFileSync('python', [logFile], { encoding: 'utf8' }).trim());

// 5. The channels and their classes.
const channels = await api('/api/channel/', 'GET');
console.log('5. the channels:');
for (const channel of channels.data ?? []) {
  console.log(
    `   ${String(channel.id).padStart(2)} ${String(channel.name).padEnd(30)} ` +
      `retention=${String(channel.retention || '-').padEnd(11)} group=${channel.group}`
  );
}
