/**
 * The price-change workflow.
 *
 * The claim: when a provider's price moves, the operator changes the ROUTE -
 * its model mapping and its provider declaration - and every seat on that route
 * follows, with no seat touched and no subscription touched.
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
      messages: [{ role: 'user', content: 'Reply with exactly: SWITCHED' }],
      max_tokens: 512
    })
  });
  const body = await res.json();
  return { status: res.status, reply: body?.choices?.[0]?.message?.content ?? body?.error?.message ?? '' };
}

// A seat of the pro type, with NO route list of its own.
await api(`/api/tenant/${TENANT}/seat-policy`, 'PUT', {
  alias_id: 'switch_e2e',
  seat_tier: 'pro',
  profile_type: 'adult',
  account_type: 'pro',
  allowed_modes: ['chat'],
  allowed_models: ['Chat']
});
const minted = await api(`/api/tenant/${TENANT}/token`, 'POST', {
  group: 'pro',
  seat_alias: 'switch_e2e',
  models: 'Chat',
  channels: '1,2,3,4'
});
const token = minted?.data?.key;

// 1. The route as it is now.
const before = await api('/api/channel/1', 'GET');
console.log('1. the route now maps Chat ->', JSON.parse(before.data.model_mapping).Chat);
const served = await chat(token, 'chat', 'Chat');
console.log('   the seat is served:', served.status, JSON.stringify(served.reply).slice(0, 40));

// 2. The operator changes the PROVIDER AND THE MODEL on the route, because
//    the price moved. One edit, on the route.
const mapping = JSON.parse(before.data.model_mapping);
mapping.Chat = 'openrouter/deepseek/deepseek-v4-flash';
await api('/api/channel/', 'PUT', {
  id: 1,
  name: before.data.name,
  type: before.data.type,
  key: before.data.key,
  base_url: before.data.base_url,
  models: before.data.models,
  group: before.data.group,
  model_mapping: JSON.stringify(mapping),
  priority: before.data.priority,
  weight: before.data.weight,
  status: 1,
  retention: 'retaining'
});
console.log('\n2. the operator changed the route to Chat ->', mapping.Chat);

// 3. The route's provider declaration follows, so the pool's key allows the
//    new model.
const declared = await api('/api/channel/1/providers', 'GET');
const providers = declared.data.providers.map((p) =>
  p.mode === 'chat' || p.model.includes('north-mini') ? { ...p, model: 'deepseek/deepseek-v4-flash' } : p
);
await api('/api/channel/1/providers', 'PUT', { providers });
console.log('   the provider declaration was updated to match');

// 4. The SAME seat, with no edit of any kind, now reaches the new model.
const after = await chat(token, 'chat', 'Chat');
console.log('\n3. the same seat, untouched, is now served:', after.status, JSON.stringify(after.reply).slice(0, 40));

// 5. Which model actually served it.
const pyLog = String.raw`
import sqlite3
con = sqlite3.connect(r"D:\LAN-AI-Infra\one-api\one-api.db")
for r in con.execute("""SELECT seat_alias, model_name, channel_id, upstream_provider
                        FROM logs WHERE seat_alias='switch_e2e' ORDER BY id DESC LIMIT 2"""):
    print("   seat=%s model=%s channel=%s provider=%s" % r)
`;
const logFile = `${TEMP}/opencode/readswitch.py`;
writeFileSync(logFile, pyLog);
console.log('\\n4. what actually served it:');
// Restore the cheaper mapping for the running deployment.
const restore = JSON.parse(before.data.model_mapping);
await api('/api/channel/', 'PUT', {
  id: 1, name: before.data.name, type: before.data.type, key: before.data.key,
  base_url: before.data.base_url, models: before.data.models, group: before.data.group,
  model_mapping: JSON.stringify(restore), priority: before.data.priority,
  weight: before.data.weight, status: 1, retention: 'retaining'
});
const declaredRestore = await api('/api/channel/1/providers', 'GET');
await api('/api/channel/1/providers', 'PUT', {
  providers: declaredRestore.data.providers.map((p) =>
    p.model.includes('deepseek/deepseek-v4-flash') ? { ...p, model: 'cohere/north-mini-code:free' } : p
  )
});
console.log('   the cheaper mapping is restored');
console.log(execFileSync('python', [logFile], { encoding: 'utf8' }).trim());
