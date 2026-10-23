/**
 * End-to-end test of the Satchida Privacy chain.
 *
 *   LibreChat (:3080) -> Privacy router (:4099) -> llama.cpp (:8080)
 *
 * Nothing secret is printed: the seat token and the password stay in memory and
 * in .state-e2e.json.
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const BASE = 'http://127.0.0.1:3080';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const creds = JSON.parse(readFileSync('D:/LAN-AI-Infra/LibreChat/fleet/.state/e2e-credentials.json', 'utf8'));

const log = (...args) => console.log(...args);
const authHeaders = (token) => ({
  authorization: 'Bearer ' + token,
  'user-agent': UA,
  'content-type': 'application/json',
});

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': UA },
    body: JSON.stringify({ email: creds.email, password: creds.password }),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 300) };
  }
  if (!res.ok) throw new Error(`login failed ${res.status}: ${JSON.stringify(body).slice(0, 400)}`);
  return body;
}

const auth = await login();
log('1. login: OK, token present =', Boolean(auth.token));
const token = auth.token;

const cfgRes = await fetch(`${BASE}/api/config`, { headers: authHeaders(token) });
const cfg = await cfgRes.json();
const custom = cfg?.endpoints?.custom ?? [];
log(
  '2. custom endpoints:',
  custom.map((e) => `${e.name} -> ${e.baseURL} [${(e.models?.default ?? []).join(',')}]`).join(' | ') ||
    '(none)',
);

const messageId = randomUUID();
const conversationId = randomUUID();
const text = 'Reply with exactly: PRIVACY_CHAIN_OK';
// The agents chat route takes the user message FLAT on the body: messageId,
// parentMessageId and text.
const payload = {
  conversationId,
  endpoint: 'Satchida',
  endpointType: 'custom',
  model: 'Privacy',
  endpointOption: { model: 'Privacy' },
  messageId,
  parentMessageId: '00000000-0000-0000-0000-000000000000',
  text,
  stream: false,
  regenerate: false,
  files: [],
};

log('3. POST /api/agents/chat (endpoint=Satchida, model=Privacy)');
const chatRes = await fetch(`${BASE}/api/agents/chat`, {
  method: 'POST',
  headers: authHeaders(token),
  body: JSON.stringify(payload),
});
const chatText = await chatRes.text();
log('   status =', chatRes.status);
log('   body   =', chatText.slice(0, 2000));

let started;
try {
  started = JSON.parse(chatText);
} catch {
  started = {};
}
if (!started.streamId) {
  process.exit(1);
}

// The generation runs asynchronously; poll until the turn settles.
const streamId = started.streamId;
let finalText = '';
for (let attempt = 0; attempt < 40; attempt += 1) {
  await new Promise((r) => setTimeout(r, 1500));
  const res = await fetch(`${BASE}/api/agents/chat/stream/${streamId}`, {
    headers: authHeaders(token),
  });
  const body = await res.text();
  if (!res.ok) {
    log(`   poll ${attempt}: status ${res.status} ${body.slice(0, 200)}`);
    continue;
  }
  // The stream body is SSE: collect the text deltas.
  const deltas = [...body.matchAll(/data: (.+)/g)].map((m) => {
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  });
  const chunk = deltas
    .map((d) => d?.text ?? d?.content ?? d?.delta?.text ?? '')
    .filter(Boolean)
    .join('');
  finalText += chunk;
  const done = deltas.some((d) => d?.final === true || d?.type === 'abort' || d?.done === true);
  if (done || finalText.length > 0) {
    log(`   poll ${attempt}: ${finalText.length} chars`);
  }
  if (done) break;
}
log('4. assistant output =', JSON.stringify(finalText.slice(0, 800)));

