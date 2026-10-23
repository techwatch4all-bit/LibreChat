/**
 * Apply the route retention rule to the gateway's channels.
 *
 * The rule: the Privacy account type's CLOUD traffic goes only to
 * zero-data-retention routes, and every other account type's goes only to
 * retaining ones.
 *
 *   channel 1  the retaining cloud route   (openrouter, together, novita, ...)
 *   channel 2  the local model              (the operator's own hardware)
 *   channel 3  the local model, larger
 *   channel 4  the zero-data-retention cloud route (deepinfra), for privacy
 *
 * The ZDR channel's key is a Bifrost virtual key restricted to the
 * zero-data-retention providers, so the restriction holds in the ROUTER and
 * not only in the gateway's channel selection.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ONE_API = 'http://127.0.0.1:4000';
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

const RETAINING_MAPPING = {
  Chat: 'openrouter/cohere/north-mini-code:free',
  Work: 'openrouter/deepseek/deepseek-v4-flash',
  Study: 'openrouter/dots-studio/dots-3-note-preview:free',
};
const ZDR_MAPPING = {
  Chat: 'deepinfra/deepseek-ai/DeepSeek-V4-Flash-0731',
  Work: 'deepinfra/deepseek-ai/DeepSeek-V4-Flash-0731',
  Study: 'deepinfra/deepseek-ai/DeepSeek-V4-Flash-0731',
};

const list = await api('/api/channel/', 'GET');
const channels = list?.data ?? [];

const cloud = channels.find((c) => (c.base_url || '').replace(/\/+$/, '') === 'http://127.0.0.1:8700');
if (!cloud) throw new Error('the cloud channel was not found');
const local = channels.filter(
  (c) => ['http://127.0.0.1:8080', 'http://127.0.0.1:8091'].includes((c.base_url || '').replace(/\/+$/, ''))
);

// 1. The retaining cloud channel: every account type except privacy.
await api('/api/channel/', 'PUT', {
  id: cloud.id,
  name: 'Cloud Retaining',
  type: cloud.type,
  key: cloud.key,
  base_url: cloud.base_url,
  models: cloud.models,
  group: 'default,basic,standard,family,pro,pro_family,enterprise',
  model_mapping: JSON.stringify(RETAINING_MAPPING),
  priority: cloud.priority,
  weight: cloud.weight,
  status: 1,
  retention: 'retaining',
});
console.log('1. the cloud channel is now the RETAINING route for every type except privacy');

// 2. The local channels are the operator's own model.
for (const channel of local) {
  await api('/api/channel/', 'PUT', {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    key: channel.key,
    base_url: channel.base_url,
    models: channel.models,
    group: channel.group,
    model_mapping: channel.model_mapping,
    priority: channel.priority,
    weight: channel.weight,
    status: 1,
    retention: 'local',
  });
}
console.log('2. the local channels are classed LOCAL (the operator\'s own model)');

// 3. The zero-data-retention cloud channel, for the privacy account type.
const zdrKey = readFileSync(`${TEMP}/opencode/zdr-vk.txt`, 'utf8').trim();
let zdr = channels.find((c) => c.name === 'Cloud ZDR');
if (!zdr) {
  const created = await api('/api/channel/', 'POST', {
    name: 'Cloud ZDR',
    type: 1,
    key: zdrKey,
    base_url: 'http://127.0.0.1:8700',
    models: 'Chat,Work,Study',
    group: 'privacy',
    model_mapping: JSON.stringify(ZDR_MAPPING),
    priority: 50,
    weight: 1,
    status: 1,
    retention: 'zdr',
  });
  zdr = created?.data ?? created;
  console.log('3. created the zero-data-retention cloud channel', zdr?.id);
} else {
  await api('/api/channel/', 'PUT', {
    id: zdr.id,
    name: 'Cloud ZDR',
    type: zdr.type,
    key: zdrKey,
    base_url: 'http://127.0.0.1:8700',
    models: 'Chat,Work,Study',
    group: 'privacy',
    model_mapping: JSON.stringify(ZDR_MAPPING),
    priority: 50,
    weight: 1,
    status: 1,
    retention: 'zdr',
  });
  console.log('3. updated the zero-data-retention cloud channel', zdr.id);
}

// 4. Report the state.
const after = await api('/api/channel/', 'GET');
console.log('\nthe channels now:');
for (const channel of after.data ?? []) {
  console.log(
    `   ${String(channel.id).padStart(2)} ${String(channel.name).padEnd(18)} ` +
      `retention=${String(channel.retention || '-').padEnd(11)} group=${channel.group}`
  );
}
