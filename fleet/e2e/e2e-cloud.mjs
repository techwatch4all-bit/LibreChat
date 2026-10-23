/**
 * End-to-end test of the Satchida cloud chain.
 *
 *   LibreChat (:3080) -> One-API (:4000) -> Node Satchida router (:4001)
 *
 * The seat presents its own per-seat bearer token, so the request is
 * authenticated as the seat and not as the operator.
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const BASE = 'http://127.0.0.1:3080';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const creds = JSON.parse(
  readFileSync('D:/LAN-AI-Infra/LibreChat/fleet/.state/e2e-cloud-credentials.json', 'utf8'),
);

const log = (...args) => console.log(...args);
const authHeaders = (token) => ({
  authorization: 'Bearer ' + token,
  'user-agent': UA,
  'content-type': 'application/json',
});

const res = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'user-agent': UA },
  body: JSON.stringify({ email: creds.email, password: creds.password }),
});
const body = await res.json();
if (!res.ok) throw new Error(`login failed ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
log('1. login: OK');
const token = body.token;

const messageId = randomUUID();
const conversationId = randomUUID();
const text = 'Reply with exactly: CLOUD_CHAIN_OK';
// The agents chat route takes the user message FLAT on the body: messageId,
// parentMessageId and text. A nested `message` object is ignored, and the turn
// then runs with the system prompt alone, which looks like a model that
// answered the wrong question.
const payload = {
  conversationId,
  endpoint: 'Satchida-Gateway',
  endpointType: 'custom',
  model: 'Chat',
  endpointOption: { model: 'Chat' },
  messageId,
  parentMessageId: '00000000-0000-0000-0000-000000000000',
  text,
  stream: false,
  regenerate: false,
  files: [],
};

log('2. POST /api/agents/chat (endpoint=Satchida-Gateway, model=Chat)');
const chatRes = await fetch(`${BASE}/api/agents/chat`, {
  method: 'POST',
  headers: authHeaders(token),
  body: JSON.stringify(payload),
});
const chatText = await chatRes.text();
log('   status =', chatRes.status);
log('   body   =', chatText.slice(0, 1200));
