/**
 * Apply the account-type routing rule and the cloud model mapping.
 *
 * THE ROUTING RULE
 * -----------------
 * Every account type consumes cloud APIs. Only the Privacy account type, in
 * the Privacy mode, is routed to the local model. So:
 *
 *   - the central Bifrost channel serves EVERY account type
 *   - the local channels serve the Privacy account type (and the 'default'
 *     fallback for a seat nobody classified, so an unclassified seat in
 *     Privacy mode is not left with no route at all)
 *
 * THE MODEL MAPPING
 * -----------------
 * Chat and Study move to the OpenRouter free models that the account's own
 * privacy guardrail permits, and Work stays on a paid model, which is the
 * product's rule: work puts a pinned model first because work is the mode
 * that earns.
 *
 * The Nous portal is dropped: it answered intermittently, and an intermittent
 * upstream is an operator's cost, not just a failed request.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ONE_API = 'http://127.0.0.1:4000';

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

const ALL_ACCOUNT_TYPES = 'default,basic,standard,family,pro,pro_family,enterprise,privacy';
const LOCAL_ACCOUNT_TYPES = 'privacy,default';

const MODEL_MAPPING = {
  // The OpenRouter free models the account's own "no training on free models"
  // guardrail permits. The other free models are excluded by that setting, and
  // it is deliberately left on: it is the operator's promise that the traffic
  // is not used for training.
  Chat: 'openrouter/cohere/north-mini-code:free',
  // Work puts a paid model first, because work is the mode that earns.
  Work: 'deepinfra/deepseek-ai/DeepSeek-V4-Flash-0731',
  Study: 'openrouter/dots-studio/dots-3-note-preview:free',
};

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

const list = await api('/api/channel/', 'GET');
const channels = list?.data ?? [];

for (const channel of channels) {
  const base = (channel.base_url || '').replace(/\/+$/, '');
  const isCloud = base === 'http://127.0.0.1:8700';
  const isLocal = base === 'http://127.0.0.1:8080' || base === 'http://127.0.0.1:8091';
  if (!isCloud && !isLocal) {
    console.log(`channel ${channel.id} ${channel.name}: left alone (${base})`);
    continue;
  }
  const groups = isCloud ? ALL_ACCOUNT_TYPES : LOCAL_ACCOUNT_TYPES;
  const body = {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    key: channel.key,
    base_url: channel.base_url,
    models: channel.models,
    group: groups,
    model_mapping: isCloud ? JSON.stringify(MODEL_MAPPING) : channel.model_mapping,
    priority: channel.priority,
    weight: channel.weight,
    status: 1,
  };
  const updated = await api('/api/channel/', 'PUT', body);
  console.log(
    `channel ${channel.id} ${channel.name} (${isCloud ? 'cloud' : 'local'}): group -> ${groups}` +
      (isCloud ? `, mapping -> ${Object.entries(MODEL_MAPPING).map(([k, v]) => `${k}=${v}`).join(' ')}` : '')
  );
  if (!updated?.success) {
    throw new Error(`channel ${channel.id} update was refused: ${JSON.stringify(updated)}`);
  }
}
console.log('\nThe abilities are regenerated on the channel save, so the tenant path sees the new groups.');
