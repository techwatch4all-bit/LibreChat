/**
 * The Privacy chain, the way a SEAT experiences it.
 *
 * The existing e2e polls the stream with a fresh request every 1.5 seconds,
 * which is not how a client reads a generation: a client holds the SSE
 * connection open and receives the deltas as they are produced. This harness
 * does the latter, so the answer is read exactly as the browser would read
 * it.
 */
import { randomUUID } from 'node:crypto';

const BASE = process.env.LIBRECHAT_URL || 'http://127.0.0.1:3080';
const CREDENTIALS = new URL('../.state/e2e-credentials.json', import.meta.url);

const log = (...parts) => console.log(...parts);

const { email, password } = JSON.parse(
  await import('node:fs').then((fs) => fs.promises.readFile(CREDENTIALS, 'utf8')),
);

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const auth = await login.json();
const token = auth?.token;
if (!token) {
  log('the login failed:', JSON.stringify(auth).slice(0, 200));
  process.exit(1);
}
log('1. login: OK');

const ENDPOINT = process.env.ENDPOINT || 'Satchida';
const MODEL = process.env.MODEL || 'Privacy';
const EXPECT = process.env.EXPECT || 'PRIVACY_CHAIN_OK';
const messageId = randomUUID();
const conversationId = randomUUID();
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const started = await fetch(`${BASE}/api/agents/chat`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'user-agent': BROWSER_UA,
    // The client negotiates the generation protocol: the server only enables
    // the resumable stream when the header echoes the version it speaks.
    'x-librechat-generation-protocol': '2',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    conversationId,
    endpoint: ENDPOINT,
    endpointType: 'custom',
    model: MODEL,
    endpointOption: { model: MODEL },
    messageId,
    parentMessageId: '00000000-0000-0000-0000-000000000000',
    text: 'Reply with exactly: ' + EXPECT,
    stream: false,
    regenerate: false,
    files: [],
  }),
});
const startedText = await started.text();
let startedBody = null;
try { startedBody = JSON.parse(startedText); } catch { log('   the chat response was not JSON:', startedText.slice(0, 600)); }
log('2. the generation started:', started.status, startedBody?.streamId ? '(a stream id)' : JSON.stringify(startedBody).slice(0, 200));
if (!startedBody?.streamId) process.exit(1);

// The client holds the connection open and reads the deltas as they arrive.
const stream = await fetch(`${BASE}/api/agents/chat/stream/${startedBody.streamId}`, {
  headers: { 'user-agent': BROWSER_UA, Authorization: `Bearer ${token}` },
});
log('3. the stream responded:', stream.status);

const reader = stream.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
let text = '';
let done = false;
const deadline = Date.now() + 120_000;
let event = 'message';

while (!done && Date.now() < deadline) {
  const { value, done: finished } = await reader.read();
  if (finished) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() ?? '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('event:')) {
      event = trimmed.slice(6).trim();
      continue;
    }
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload) continue;
    if (event === 'error') {
      log('   the stream reported an error:', payload.slice(0, 400));
      done = true;
      break;
    }
    let parsed = null;
    try {
      parsed = JSON.parse(payload);
    } catch {
      continue;
    }
    if (parsed?.final === true || parsed?.type === 'abort' || parsed?.done === true) {
      done = true;
    }
    const chunk = parsed?.text ?? parsed?.content ?? parsed?.delta?.text ?? '';
    if (chunk) {
      text += chunk;
      log('   delta:', JSON.stringify(chunk).slice(0, 80));
    }
  }
}
log('4. the assistant output:', JSON.stringify(text).slice(0, 200));
log(text.includes(EXPECT) ? EXPECT : 'THE_CHAIN_DID_NOT_ANSWER');
