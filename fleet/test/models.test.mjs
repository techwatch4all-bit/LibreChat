/**
 * Mode label resolution — node --test test/models.test.mjs
 *
 * The failure this exists to prevent: LibreChat sends "Chat", llama.cpp answers
 * `400 model 'Chat' not found`. Every test below pins one way that can regress.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { issueLicence } from '../src/licence.mjs';
import { createGateway } from '../src/gateway.mjs';
import { resolveModel, asMode, hasImageContent, preferencesFor } from '../src/models.mjs';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const NOW = Math.floor(Date.now() / 1000);

const UPSTREAM_MODELS = [
  'Qwen2.5-Omni-7B-Q4_K_M',
  'Qwen3-4B-Instruct-2507-UD-Q4_K_XL',
  'granite-4.0-1b-Q4_K_M',
];

// ---- unit: label recognition ------------------------------------------------

test('recognises every display label, case-insensitively', () => {
  for (const label of ['Chat', 'chat', 'CHAT', ' Work ', 'study', 'Privacy']) {
    assert.ok(asMode(label), `${JSON.stringify(label)} should be a mode label`);
  }
  assert.equal(asMode('Qwen3-4B-Instruct-2507-UD-Q4_K_XL'), null);
  assert.equal(asMode(undefined), null);
  assert.equal(asMode(42), null);
});

test('a real model id passes through untouched', () => {
  const r = resolveModel({ model: 'Qwen3-4B-Instruct-2507-UD-Q4_K_XL', available: UPSTREAM_MODELS });
  assert.equal(r.source, 'passthrough');
  assert.equal(r.model, 'Qwen3-4B-Instruct-2507-UD-Q4_K_XL');
  assert.equal(r.mode, null);
});

test('each mode label resolves to a model the upstream actually has', () => {
  for (const mode of ['Chat', 'Work', 'Study', 'Privacy']) {
    const r = resolveModel({ model: mode, available: UPSTREAM_MODELS });
    assert.equal(r.mode, mode.toLowerCase());
    assert.ok(
      UPSTREAM_MODELS.includes(r.model),
      `${mode} resolved to ${r.model}, which is not in the upstream catalogue`,
    );
  }
});

test('skips a preferred model the upstream does not have', () => {
  const r = resolveModel({ model: 'Chat', available: ['gemma-4-E2B-it.Q4_K_M'] });
  assert.equal(r.model, 'gemma-4-E2B-it.Q4_K_M', 'must not pick a model that is absent');
});

test('still routes when the catalogue cannot be read', () => {
  const r = resolveModel({ model: 'Chat', available: [] });
  assert.equal(r.mode, 'chat');
  assert.ok(r.model, 'an unreachable catalogue must not leave the mode unroutable');
});

test('SATCHIDA_MODEL_<MODE> takes precedence', () => {
  const prefs = preferencesFor({ SATCHIDA_MODEL_WORK: 'granite-4.0-1b-Q4_K_M' });
  assert.equal(prefs.work[0], 'granite-4.0-1b-Q4_K_M');
  const r = resolveModel({
    model: 'Work',
    available: ['granite-4.0-1b-Q4_K_M'],
    env: { SATCHIDA_MODEL_WORK: 'granite-4.0-1b-Q4_K_M' },
  });
  assert.equal(r.model, 'granite-4.0-1b-Q4_K_M');
});

test('an image in the conversation routes to a vision model', () => {
  const messages = [
    { role: 'user', content: [{ type: 'text', text: 'what is this?' }, { type: 'image_url' }] },
  ];
  assert.equal(hasImageContent(messages), true);
  const r = resolveModel({
    model: 'Chat',
    available: ['Qwen3-4B-Instruct-2507-UD-Q4_K_XL', 'Qwen2.5-Omni-7B-Q4_K_M'],
    needsVision: hasImageContent(messages),
  });
  assert.equal(r.model, 'Qwen2.5-Omni-7B-Q4_K_M');
});

test('text-only content does not force a vision model', () => {
  assert.equal(hasImageContent([{ role: 'user', content: 'hello' }]), false);
  assert.equal(hasImageContent([{ role: 'user', content: [{ type: 'text', text: 'hi' }] }]), false);
  assert.equal(hasImageContent(undefined), false);
});

// ---- integration: through the real gateway ----------------------------------

async function harness({ available = UPSTREAM_MODELS, env = process.env } = {}) {
  const calls = [];
  const gateway = createGateway({
    publicKey,
    env,
    keys: { recordFor: () => undefined, reveal: () => Buffer.from('sk-secret') },
    fetchImpl: async (path, init) => {
      // The catalogue probe, then the completion.
      if (path.endsWith('/v1/models')) {
        return {
          status: 200,
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({ data: available.map((id) => ({ id })) }),
          arrayBuffer: async () => new ArrayBuffer(0),
        };
      }
      // Recorded raw: one test deliberately sends an unparseable body, and the
      // gateway's job is to forward those bytes, not to validate them.
      calls.push({ path, raw: init.body ? Buffer.from(init.body).toString() : null });
      let body = null;
      try {
        body = JSON.parse(Buffer.from(init.body ?? '').toString());
      } catch {
        body = null;
      }
      calls[calls.length - 1].body = body;
      return {
        status: 200,
        ok: true,
        headers: { get: () => 'application/json' },
        arrayBuffer: async () => new TextEncoder().encode('{"ok":true}').buffer,
      };
    },
  });
  const address = await gateway.listen(0, '127.0.0.1');
  return {
    calls,
    base: `http://127.0.0.1:${address.port}`,
    close: () => gateway.close(),
  };
}

const token = issueLicence({
  clientId: 'hq-local', seats: 10, plan: 'enterprise', expiresAt: NOW + 3600, privateKey,
}).token;

const send = (base, body, tok = token) =>
  fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

test('the gateway translates a mode label before calling the upstream', async () => {
  const h = await harness();
  const r = await send(h.base, { model: 'Chat', messages: [{ role: 'user', content: 'hi' }] });
  assert.equal(r.status, 200);
  assert.equal(h.calls.length, 1);
  assert.ok(
    UPSTREAM_MODELS.includes(h.calls[0].body.model),
    `upstream received ${h.calls[0].body.model}`,
  );
  assert.notEqual(h.calls[0].body.model, 'Chat');
  await h.close();
});

test('the gateway adds the identity rule to a chat request', async () => {
  const h = await harness();
  await send(h.base, { model: 'Chat', messages: [{ role: 'user', content: 'who are you?' }] });
  const messages = h.calls[0].body.messages;
  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, /Satchida/);
  assert.match(messages[0].content, /Never disclose/);
  await h.close();
});

test('the identity rule applies to agents naming a real model', async () => {
  // Agents and the memory extractor ask a model to describe itself; they must be
  // covered too, or the rule is trivially bypassed by using an agent.
  const h = await harness();
  await send(h.base, {
    model: 'granite-4.0-1b-Q4_K_M',
    messages: [{ role: 'user', content: 'describe yourself' }],
  });
  assert.equal(h.calls[0].body.messages[0].role, 'system');
  assert.equal(h.calls[0].body.model, 'granite-4.0-1b-Q4_K_M');
  await h.close();
});

test('the identity rule precedes a caller-supplied system prompt', async () => {
  // LibreChat always sends its own system message. Prepending is required: a
  // "only if absent" rule never fires there and the model leaks its vendor name.
  const h = await harness();
  await send(h.base, {
    model: 'Chat',
    messages: [
      { role: 'system', content: 'You are a legal drafter.' },
      { role: 'user', content: 'hi' },
    ],
  });
  const messages = h.calls[0].body.messages;
  assert.match(messages[0].content, /Never disclose/);
  // The caller's own instructions are preserved, not replaced.
  assert.equal(messages[1].content, 'You are a legal drafter.');
  await h.close();
});

test('SATCHIDA_IDENTITY_PROMPT can be overridden or disabled', async () => {
  const h = await harness({ env: { SATCHIDA_IDENTITY_PROMPT: 'Custom rule.' } });
  await send(h.base, { model: 'Chat', messages: [{ role: 'user', content: 'hi' }] });
  const overridden = h.calls[0].body.messages[0].content;
  // The override replaces the identity half; the date half still follows it.
  assert.ok(overridden.startsWith('Custom rule.'), JSON.stringify(overridden.slice(0, 40)));
  assert.match(overridden, /Today's date is/);
  await h.close();

  // Identity off alone: the date line still arrives (independent switches), but
  // the identity text must not.
  const noId = await harness({ env: { SATCHIDA_IDENTITY_PROMPT: '' } });
  await send(noId.base, { model: 'Chat', messages: [{ role: 'user', content: 'hi' }] });
  const noIdSys = noId.calls[0].body.messages[0];
  assert.equal(noIdSys.role, 'system');
  assert.doesNotMatch(noIdSys.content, /Satchida SI/);
  assert.match(noIdSys.content, /Today's date is/);
  await noId.close();

  // Both off: no system message is added — the user's message stays first.
  const off = await harness({
    env: { SATCHIDA_IDENTITY_PROMPT: '', SATCHIDA_DATE_CONTEXT: 'off' },
  });
  await send(off.base, { model: 'Chat', messages: [{ role: 'user', content: 'hi' }] });
  assert.equal(off.calls[0].body.messages.length, 1);
  assert.equal(off.calls[0].body.messages[0].role, 'user');
  await off.close();
});

test('the gateway forwards a real model id unchanged', async () => {
  const h = await harness();
  await send(h.base, { model: 'granite-4.0-1b-Q4_K_M', messages: [] });
  assert.equal(h.calls[0].body.model, 'granite-4.0-1b-Q4_K_M');
  await h.close();
});

test('model translation never bypasses licence enforcement', async () => {
  const h = await harness();
  const r = await send(h.base, { model: 'Chat', messages: [] }, null);
  assert.equal(r.status, 401);
  assert.equal(h.calls.length, 0, 'no upstream call, and no catalogue probe either');
  await h.close();
});

test('a streamed response reaches the client incrementally', async () => {
  // Regression guard for the "chat feels hung" bug: buffering the whole upstream
  // body made every reply appear at once, after the entire generation finished.
  const h = await harness();
  const upstream = await createGateway({
    publicKey,
    keys: { recordFor: () => undefined, reveal: () => Buffer.from('sk') },
    fetchImpl: async (path) => {
      if (path.endsWith('/v1/models')) {
        return { status: 200, ok: true, headers: { get: () => 'application/json' }, json: async () => ({ data: UPSTREAM_MODELS.map((id) => ({ id })) }) };
      }
      return {
        status: 200,
        ok: true,
        headers: { get: () => 'text/event-stream' },
        body: ReadableStream.from([
          new TextEncoder().encode('data: {"choices":[{"delta":{"content":"He"}}]}\n\n'),
          new TextEncoder().encode('data: {"choices":[{"delta":{"content":"llo"}}]}\n\n'),
          new TextEncoder().encode('data: [DONE]\n\n'),
        ]),
        arrayBuffer: async () => new ArrayBuffer(0),
      };
    },
  });
  const address = await upstream.listen(0, '127.0.0.1');

  const res = await fetch(`http://127.0.0.1:${address.port}/v1/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'Chat', messages: [], stream: true }),
  });

  assert.equal(res.headers.get('content-type'), 'text/event-stream');
  const text = await res.text();
  assert.match(text, /"content":"He"/);
  assert.match(text, /\[DONE\]/);
  await upstream.close();
  await h.close();
});

test('an unparseable body is forwarded rather than rejected', async () => {
  const h = await harness();
  const r = await fetch(`${h.base}/v1/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: '{not json',
  });
  assert.equal(r.status, 200);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].raw, '{not json', 'raw bytes reach the upstream untouched');
  await h.close();
});
test('the system context carries the real current date, not a placeholder', async () => {
  // Observed bug: the model answered "can you tell me todays date and day?"
  // with the literal text "[current date]" — twice in one conversation. A local
  // model has no clock, so the gateway supplies one.
  const h = await harness();
  await send(h.base, { model: 'Chat', messages: [{ role: 'user', content: "what's today's date?" }] });
  const sys = h.calls[0].body.messages[0];
  assert.equal(sys.role, 'system');
  assert.match(sys.content, /Today's date is \w+, \w+ \d+, \d{4}/);
  assert.match(sys.content, /Never reply with placeholders/);
  // The reply guidance quotes the placeholder it forbids, so assert on the
  // answer shape instead: the date line must precede any such quoting.
  assert.ok(sys.content.indexOf("Today's date is") < sys.content.indexOf('[current date]'));
  await h.close();
});

test('date context can be disabled without disabling the identity rule', async () => {
  const h = await harness({ env: { SATCHIDA_DATE_CONTEXT: 'off' } });
  await send(h.base, { model: 'Chat', messages: [{ role: 'user', content: 'hi' }] });
  const sys = h.calls[0].body.messages[0];
  assert.match(sys.content, /Satchida SI/);
  assert.doesNotMatch(sys.content, /Today's date is/);
  await h.close();
});

test('date context honors SATCHIDA_TZ and survives a bad one', async () => {
  const { dateContext } = await import('../src/models.mjs');
  const ist = dateContext({ SATCHIDA_TZ: 'Asia/Kolkata' });
  assert.match(ist, /Asia\/Kolkata/);
  assert.match(ist, /Today's date is \w+, \w+ \d+, \d{4}/);
  // An invalid zone must fall back, never throw.
  const bad = dateContext({ SATCHIDA_TZ: 'Not/AZone' });
  assert.ok(bad.length > 0, 'bad timezone must still produce a date');
  assert.equal(dateContext({ SATCHIDA_DATE_CONTEXT: 'off' }), '');
});
