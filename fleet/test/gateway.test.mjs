/**
 * Gateway enforcement tests — node --test test/gateway.test.mjs
 *
 * The negative cases are the point. A client may tamper with anything on its own
 * machine; what matters is that the GATEWAY refuses it, not that the client's own
 * UI or config would have.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { issueLicence } from '../src/licence.mjs';
import { createPrivacyRouter, issuePrivacyAssertion } from '../src/privacy/router.mjs';
import { createGateway } from '../src/gateway.mjs';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const NOW = Math.floor(Date.now() / 1000);
const SECRET = 'sk-or-v1-provider-secret-value';

async function harness({
  seats = 10,
  creditsRemaining = 100,
  hasKey = true,
  upstreamStatus = 200,
  upstreamBody = '{"ok":true}',
  localBaseUrl = 'http://127.0.0.1:8080',
} = {}) {
  const calls = [];
  const gateway = createGateway({
    publicKey,
    keys: {
      recordFor: (cid, provider) => (hasKey ? { provider, hint: 'sk-o...af' } : undefined),
      reveal: () => Buffer.from(SECRET),
    },
    seats: { inUseFor: () => seats },
    spend: { balanceFor: () => ({ creditsRemaining }) },
    fetchImpl: async (path, init) => {
      calls.push({
        path,
        authorization: init.headers.authorization,
        contentType: init.headers['content-type'],
        body: init.body,
      });
      return {
        status: upstreamStatus,
        ok: upstreamStatus >= 200 && upstreamStatus < 300,
        headers: { get: () => 'application/json' },
        // NOTE: do NOT use Buffer.from(str).buffer here. Buffer.from() allocates
        // from Node's shared 8KB pool, so `.buffer` returns the entire pool —
        // including stale bytes such as a just-decoded API key. That is what
        // the leak tests are there to catch. TextEncoder gives an exact buffer.
        arrayBuffer: async () => new TextEncoder().encode(upstreamBody).buffer,
      };
    },
    upstreams: {
      resolve: (provider) => {
        if (provider === 'local' || provider === 'privacy') {
          return { baseUrl: localBaseUrl, record: null };
        }
        return hasKey
          ? { baseUrl: 'https://cloud.example/v1', record: { provider } }
          : null;
      },
    },
  });
  const address = await gateway.listen(0, '127.0.0.1');
  const base = `http://127.0.0.1:${address.port}`;
  return { calls, base, close: () => gateway.close() };
}

function lic(overrides = {}) {
  return issueLicence({
    clientId: 'school-mum',
    seats: 10,
    plan: 'standard',
    expiresAt: NOW + 3600,
    privateKey,
    ...overrides,
  }).token;
}

// The default route is local (no credential). Cloud is opt-in per request AND
// requires a sealed key, so cloud-specific cases must ask for it explicitly.
const post = (base, token, query = '') =>
  fetch(`${base}/v1/chat/completions${query}`, {
    method: 'POST',
    headers: token ? { 'x-satchida-licence': token, 'content-type': 'application/json' } : {},
    body: JSON.stringify({ model: 'x', messages: [] }),
  });

const transcribe = (base, token, form) => {
  const headers = token ? { authorization: `Bearer ${token}` } : {};
  return fetch(`${base}/v1/audio/transcriptions`, {
    method: 'POST',
    headers,
    body: form,
  });
};

test('refuses a request with no licence', async () => {
  const h = await harness();
  // see: every test must await h.close()
  const r = await post(h.base, null);
  assert.equal(r.status, 401);
  assert.match(await r.text(), /no_licence/);
  await h.close();
});

test('refuses a licence signed by a foreign key', async () => {
  const h = await harness();
  const foreign = issueLicence({
    clientId: 'school-mum', seats: 10, plan: 'standard', expiresAt: NOW + 3600,
  }).token;
  const r = await post(h.base, foreign);
  assert.equal(r.status, 401);
  await h.close();
});

test('refuses an expired licence', async () => {
  const h = await harness();
  const r = await post(h.base, lic({ expiresAt: NOW - 10 }));
  assert.equal(r.status, 401);
  assert.match(await r.text(), /expired/);
  await h.close();
});

test('refuses when the seat cap is exceeded', async () => {
  const h = await harness({ seats: 11 }); // licence grants 10
  const r = await post(h.base, lic(), '?provider=openrouter');
  assert.equal(r.status, 402);
  assert.match(await r.text(), /seat_cap_exceeded/);
  assert.equal(h.calls.length, 0, 'must not reach the provider');
  await h.close();
});

test('refuses when the balance is exhausted', async () => {
  const h = await harness({ creditsRemaining: 0 });
  const r = await post(h.base, lic(), '?provider=openrouter');
  assert.equal(r.status, 402);
  assert.match(await r.text(), /balance_exhausted/);
  assert.equal(h.calls.length, 0);
  await h.close();
});

test('forwards an authorised cloud request with the provider key', async () => {
  const h = await harness();
  const r = await post(h.base, lic(), '?provider=openrouter');
  assert.equal(r.status, 200);
  assert.equal(h.calls.length, 1);
  assert.match(h.calls[0].authorization, /^Bearer sk-or-v1-/);
  await h.close();
});

test('forwards multipart audio transcription through the licensed local route', async () => {
  const h = await harness({ upstreamBody: '{"text":"test transcript"}' });
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array([82, 73, 70, 70])], { type: 'audio/wav' }), 'speech.wav');
  form.append('model', 'whisper-1');

  const response = await transcribe(h.base, lic(), form);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { text: 'test transcript' });
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].path, 'http://127.0.0.1:8080/v1/audio/transcriptions');
  assert.match(h.calls[0].contentType, /^multipart\/form-data; boundary=/);
  assert.ok(Buffer.from(h.calls[0].body).includes(Buffer.from('name="model"')));
  assert.ok(Buffer.from(h.calls[0].body).includes(Buffer.from('whisper-1')));
  await h.close();
});

test('rejects an unlicensed audio transcription before forwarding', async () => {
  const h = await harness();
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array([1])]), 'speech.wav');

  const response = await transcribe(h.base, null, form);

  assert.equal(response.status, 401);
  assert.match(await response.text(), /no_licence/);
  assert.equal(h.calls.length, 0);
  await h.close();
});

test('maps transcription upstream failures to a safe error response', async () => {
  const h = await harness({ upstreamStatus: 500, upstreamBody: 'sensitive upstream details' });
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array([1])]), 'speech.wav');

  const response = await transcribe(h.base, lic(), form);

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: 'STT upstream error',
    code: 'stt_upstream_error',
  });
  await h.close();
});

test('never reaches a cloud provider when no key is sealed', async () => {
  const h = await harness({ hasKey: false });
  const r = await post(h.base, lic(), '?provider=openrouter');
  assert.equal(r.status, 503);
  assert.equal(h.calls.length, 0);
  await h.close();
});

test('the provider key never leaks into a response body', async () => {
  const h = await harness();
  const r = await post(h.base, lic());
  assert.equal((await r.text()).includes(SECRET), false);
  await h.close();
});

test('an upstream 5xx does not leak the key', async () => {
  const h = await harness({ upstreamStatus: 500 });
  const r = await post(h.base, lic());
  assert.equal(r.status, 500);
  assert.equal((await r.text()).includes(SECRET), false);
  await h.close();
});

test('privacy assertion rejects wrong audience and expired token', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const token = issuePrivacyAssertion({
    tenantId: 'tenant-test', seatAlias: 'opaque-seat-00000001', accountType: 'family',
    profileType: 'child', allowedModes: ['Privacy'], policyVersion: 7,
    audience: 'tenant-privacy:test-node', expiresInSeconds: 60, childSafetyReady: true, keyId: 'test', privateKey,
  });
  const app = await createPrivacyRouter({
    publicKeys: { test: publicKey }, audience: 'tenant-privacy:test-node',
    tenantId: 'tenant-test', upstreams: { Privacy: 'http://127.0.0.1:9999/v1' },
  });
  assert.throws(() => app.verify(token, { now: Math.floor(Date.now() / 1000) + 61 }), /expired/);
  assert.throws(() => app.verify(token, { audience: 'tenant-privacy:other' }), /audience/);
  await app.close();
});

test('privacy router accepts a valid assertion and sends inference only to local upstream', async () => {
  const pair = generateKeyPairSync('ed25519');
  const calls = [];
  const upstream = await import('node:http').then(({ createServer }) => new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      calls.push({ url: req.url, body: Buffer.concat(chunks).toString('utf8') });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"choices":[{"message":{"role":"assistant","content":"local answer"}}]}');
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  }));
  const token = issuePrivacyAssertion({
    tenantId: 'tenant-test', seatAlias: 'opaque-seat-0000000000000001', accountType: 'family',
    profileType: 'adult', allowedModes: ['Privacy'], policyVersion: 7,
    audience: 'tenant-privacy:test-node', expiresInSeconds: 60, keyId: 'test', privateKey: pair.privateKey,
  });
  const app = await createPrivacyRouter({
    publicKeys: { test: pair.publicKey }, audience: 'tenant-privacy:test-node',
    tenantId: 'tenant-test', upstreams: { Privacy: `http://127.0.0.1:${upstream.port}/v1` },
  });
  const address = await app.listen(0, '127.0.0.1');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/v1/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'x-satchida-seat': 'opaque-seat-00000001', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'Privacy', messages: [{ role: 'user', content: 'local-only sentinel' }] }),
    });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /local answer/);
    // The router reads the runtime's catalogue before choosing a model, so
    // the upstream sees a catalogue read as well as the inference. Only the
    // inference must carry the prompt, and it must carry a real model id
    // rather than the mode label.
    const inferenceCalls = calls.filter((call) => /chat\/completions/.test(call.url));
    assert.equal(inferenceCalls.length, 1);
    assert.match(inferenceCalls[0].body, /local-only sentinel/);
    const forwarded = JSON.parse(inferenceCalls[0].body);
    assert.notEqual(forwarded.model, 'Privacy');
  } finally {
    await app.close();
    await new Promise((resolve) => upstream.server.close(resolve));
  }
});

test('privacy router denies wrong tenant, replayed assertions, and unconfigured modes before local dispatch', async () => {
  const pair = generateKeyPairSync('ed25519');
  let calls = 0;
  const token = issuePrivacyAssertion({
    tenantId: 'tenant-other', seatAlias: 'opaque-seat-0000000000000002', accountType: 'family',
    profileType: 'adult', allowedModes: ['Privacy'], policyVersion: 7,
    audience: 'tenant-privacy:test-node', expiresInSeconds: 60, keyId: 'test', privateKey: pair.privateKey,
  });
  const app = await createPrivacyRouter({
    publicKeys: { test: pair.publicKey }, audience: 'tenant-privacy:test-node',
    tenantId: 'tenant-test', upstreams: { Privacy: 'http://127.0.0.1:9999/v1' },
    fetchImpl: async () => { calls += 1; return new Response('{}'); },
  });
  const address = await app.listen(0, '127.0.0.1');
  try {
    const request = () => fetch(`http://127.0.0.1:${address.port}/v1/chat/completions`, {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'x-satchida-seat': 'opaque-seat-00000002', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'Privacy', messages: [] }),
    });
    const first = await request();
    assert.equal(first.status, 403);
    const second = await request();
    assert.equal(second.status, 403);
    assert.equal(calls, 0);
  } finally {
    await app.close();
  }
});

test('privacy assertion refuses child capabilities and disabled mode claims', () => {
  const pair = generateKeyPairSync('ed25519');
  assert.throws(() => issuePrivacyAssertion({
    tenantId: 'tenant-test', seatAlias: 'opaque-seat-00000001', accountType: 'family',
    profileType: 'child', allowedModes: ['Privacy', 'Work'], policyVersion: 1,
    audience: 'tenant-privacy:test-node', expiresInSeconds: 60, privateKey: pair.privateKey,
  }), /child/);
});

test('child Privacy requires local moderation and injects the mandatory child policy', async () => {
  const pair = generateKeyPairSync('ed25519');
  const calls = [];
  const token = issuePrivacyAssertion({
    tenantId: 'tenant-test', seatAlias: 'opaque-seat-0000000000000001', accountType: 'family',
    profileType: 'child', allowedModes: ['Privacy'], policyVersion: 7,
    audience: 'tenant-privacy:test-node', expiresInSeconds: 60, childSafetyReady: true, keyId: 'test', privateKey: pair.privateKey,
  });
  const app = await createPrivacyRouter({
    publicKeys: { test: pair.publicKey }, audience: 'tenant-privacy:test-node', tenantId: 'tenant-test',
    upstreams: { Privacy: 'http://127.0.0.1:9999/v1' },
    childSafety: { ready: () => true, checkInput: async () => true, checkOutput: async () => true },
    fetchImpl: async (_url, options) => {
      calls.push(JSON.parse(options.body.toString('utf8')));
      return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'safe answer' } }] }), { status: 200 });
    },
  });
  const address = await app.listen(0, '127.0.0.1');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/v1/chat/completions`, {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'Privacy', messages: [{ role: 'system', content: 'client system' }, { role: 'user', content: 'help me study' }] }),
    });
    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.match(calls[0].messages[0].content, /MANDATORY CHILD SAFETY/);
    assert.equal(calls[0].messages.some((message) => message.content === 'client system'), false);
  } finally {
    await app.close();
  }
});
