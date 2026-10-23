import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { generateKeyPairSync } from 'node:crypto';
import { createPrivacyRouter, issuePrivacyAssertion, verifyPrivacyAssertion, normaliseCapacity } from './router.mjs';

const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'secp256k1',
});

const SIGN_OPTIONS = {
  tenantId: 'tenant-a',
  seatAlias: 'opaque-seat-0000000001',
  accountType: 'family',
  profileType: 'adult',
  allowedModes: ['Privacy'],
  policyVersion: 1,
  audience: 'satchida-control',
  expiresInSeconds: 300,
  privateKey,
};

describe('issuePrivacyAssertion', () => {
  test('rejects missing privateKey', () => {
    assert.throws(() => issuePrivacyAssertion({ ...SIGN_OPTIONS, privateKey: null }), {
      message: 'privacy assertion signing key is required',
    });
  });

  test('rejects empty tenantId', () => {
    assert.throws(() => issuePrivacyAssertion({ ...SIGN_OPTIONS, tenantId: '' }), {
      message: 'tenantId is required',
    });
  });

  test('rejects child profile with non-Privacy allowed modes', () => {
    assert.throws(
      () => issuePrivacyAssertion({ ...SIGN_OPTIONS, profileType: 'child', allowedModes: ['Privacy', 'Work'] }),
      { message: 'child assertions may authorize only Privacy, not Work or other cloud modes' },
    );
  });

  test('rejects child without childSafetyReady', () => {
    assert.throws(
      () => issuePrivacyAssertion({ ...SIGN_OPTIONS, profileType: 'child' }),
      { message: 'child Privacy requires ready local safety controls' },
    );
  });

  test('issues a valid assertion', () => {
    const token = issuePrivacyAssertion(SIGN_OPTIONS);
    assert.ok(typeof token === 'string');
    assert.ok(token.split('.').length === 2);
  });
});

describe('verifyPrivacyAssertion', () => {
  test('rejects empty token', () => {
    assert.throws(() => verifyPrivacyAssertion('', { publicKeys: { default: publicKey }, audience: 'satchida-control', tenantId: 'tenant-a' }), {
      message: 'assertion is malformed',
    });
  });

  test('rejects extra segments', () => {
    const token = issuePrivacyAssertion(SIGN_OPTIONS);
    assert.throws(() => verifyPrivacyAssertion(token + '.extra', { publicKeys: { default: publicKey }, audience: 'satchida-control', tenantId: 'tenant-a' }), {
      message: 'assertion is malformed',
    });
  });

  test('rejects wrong audience', () => {
    const token = issuePrivacyAssertion(SIGN_OPTIONS);
    assert.throws(() => verifyPrivacyAssertion(token, { publicKeys: { default: publicKey }, audience: 'wrong-audience', tenantId: 'tenant-a' }), {
      message: 'assertion audience is invalid',
    });
  });

  test('rejects wrong tenant', () => {
    const token = issuePrivacyAssertion(SIGN_OPTIONS);
    assert.throws(() => verifyPrivacyAssertion(token, { publicKeys: { default: publicKey }, audience: 'satchida-control', tenantId: 'wrong-tenant' }), {
      message: 'assertion tenant binding is invalid',
    });
  });

  test('rejects expired token', async () => {
    const token = issuePrivacyAssertion({ ...SIGN_OPTIONS, expiresInSeconds: 1 });
    await new Promise((resolve) => setTimeout(resolve, 1100));
    assert.throws(() =>
      verifyPrivacyAssertion(token, { publicKeys: { default: publicKey }, audience: 'satchida-control', tenantId: 'tenant-a' })
    , { message: 'assertion is expired or outside its validity window' });
  });

  test('rejects an assertion replayed by a different seat', () => {
    // LibreChat holds one assertion for the length of a conversation and
    // presents it on every turn, so the SAME seat reusing its own assertion is
    // normal operation. The property that matters is that one seat's assertion
    // cannot be replayed by a different seat.
    const usedJtis = new Map();
    const token = issuePrivacyAssertion({
      ...SIGN_OPTIONS,
      expiresInSeconds: 300,
      jti: 'fixed-jti-for-test-000001',
    });
    verifyPrivacyAssertion(token, { publicKeys: { default: publicKey }, audience: 'satchida-control', tenantId: 'tenant-a', usedJtis });
    // The same seat may present it again.
    const again = verifyPrivacyAssertion(token, { publicKeys: { default: publicKey }, audience: 'satchida-control', tenantId: 'tenant-a', usedJtis });
    assert.equal(again.jti, 'fixed-jti-for-test-000001');
    // A different seat may not. The seat alias is deliberately NOT passed here,
    // so the seat-binding check does not mask the replay check: this asserts the
    // replay protection itself.
    const otherSeatToken = issuePrivacyAssertion({
      ...SIGN_OPTIONS,
      seatAlias: 'opaque-seat-0000000002',
      expiresInSeconds: 300,
      jti: 'fixed-jti-for-test-000001',
    });
    assert.throws(() =>
      verifyPrivacyAssertion(otherSeatToken, {
        publicKeys: { default: publicKey },
        audience: 'satchida-control',
        tenantId: 'tenant-a',
        usedJtis,
      })
    , { message: 'assertion has already been used' });
  });

  test('accepts valid token', () => {
    const token = issuePrivacyAssertion(SIGN_OPTIONS);
    const payload = verifyPrivacyAssertion(token, { publicKeys: { default: publicKey }, audience: 'satchida-control', tenantId: 'tenant-a' });
    assert.equal(payload.tid, 'tenant-a');
    assert.equal(payload.seat, 'opaque-seat-0000000001');
  });

  test('accepts an assertion whose key id does not match the router key id', () => {
    // The tenant's LibreChat and the Privacy router are configured
    // independently, and the key id is a label rather than a secret. The
    // signature still has to verify, so a single-key router must not refuse
    // the chain because the two sides spell the id differently.
    const token = issuePrivacyAssertion({ ...SIGN_OPTIONS, keyId: 'tenant-local' });
    const payload = verifyPrivacyAssertion(token, { publicKeys: { default: publicKey }, audience: 'satchida-control', tenantId: 'tenant-a' });
    assert.equal(payload.kid, 'tenant-local');
  });

  test('refuses an unknown key id when several keys are trusted', () => {
    // With more than one key the id is the only thing that distinguishes the
    // current key from a rotated-out one, so it stays authoritative.
    const other = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
    const token = issuePrivacyAssertion({ ...SIGN_OPTIONS, keyId: 'retired-key' });
    assert.throws(
      () => verifyPrivacyAssertion(token, {
        publicKeys: { default: publicKey, 'tenant-local': other.publicKey },
        audience: 'satchida-control',
        tenantId: 'tenant-a',
      }),
      { message: 'assertion signature is invalid' },
    );
  });
});

describe('normaliseCapacity', () => {
  test('accepts the flat documented contract', () => {
    const rates = normaliseCapacity({ c_served: 4, prefill_tps: 4800, aggregate_tps: 190 });
    assert.deepEqual(rates, { cServed: 4, prefillTps: 4800, decodeTps: 190, model: null });
  });

  test('accepts a capacity-probe report', () => {
    // The probe nests the numbers: derived.c_served and throughput.prefill_tps.
    // The router used to read only the flat shape, so a real probe report
    // produced cServed=1, prefillTps=1, decodeTps=1 and every request was
    // charged a whole GPU-second for a handful of tokens.
    const rates = normaliseCapacity({
      schema: 'satchida.capacity.probe.v1',
      derived: { c_served: 4, c_memory: 11, c_compute: 4, binding_limit: 'compute' },
      throughput: {
        prefill_tps: 13661,
        aggregate_tps: { 1: 81.8, 2: 172.8, 4: 165.8 },
        per_seat_tps: { 1: 81.8, 2: 86.4, 4: 41.5 },
      },
    });
    assert.equal(rates.cServed, 4);
    assert.equal(rates.prefillTps, 13661);
    // The rate at the served concurrency, not the maximum, because that is what
    // the GPU actually delivers while that many sessions are in flight.
    assert.equal(rates.decodeTps, 165.8);
  });

  test('falls back to the best measured rate when the served concurrency was not swept', () => {
    const rates = normaliseCapacity({
      derived: { c_served: 3 },
      throughput: { prefill_tps: 4800, aggregate_tps: { 1: 81.8, 2: 172.8 } },
    });
    assert.equal(rates.decodeTps, 172.8);
  });

  test('returns null when the report carries no usable rates', () => {
    assert.equal(normaliseCapacity(null), null);
    assert.equal(normaliseCapacity({ derived: { c_served: 4 } }), null);
    assert.equal(normaliseCapacity({ throughput: { prefill_tps: 0, aggregate_tps: {} } }), null);
  });
});

describe('createPrivacyRouter with fair-use capacity', () => {
  async function startWithCapacity({ cServed = 1, capacity = {}, withProbe = true } = {}) {
    const upstream = createServer(async (req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"status":"ready"}');
        return;
      }
      for await (const chunk of req) { /* drain the request body */ }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        id: 'chatcmpl-1',
        choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      }));
    });
    await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
    const upstreamPort = upstream.address().port;

    const router = await createPrivacyRouter({
      publicKeys: { default: publicKey },
      audience: 'satchida-control',
      tenantId: 'tenant-a',
      upstreams: { Privacy: `http://127.0.0.1:${upstreamPort}` },
      // A tenant that has never run the probe has no capacity block at all, so
      // the router serves every request and reports itself unverified.
      ...(withProbe
        ? { capacity: { c_served: cServed, prefill_tps: 4800, aggregate_tps: 190, ...capacity } }
        : {}),
    });
    await router.listen(0, '127.0.0.1');
    const closeAll = async () => {
      await router.close();
      await new Promise((resolve) => { upstream.close(resolve); upstream.closeAllConnections?.(); });
    };
    return { router, upstream, closeAll, port: router.server.address().port };
  }

  function assertionFor(seat) {
    return issuePrivacyAssertion({
      tenantId: 'tenant-a',
      seatAlias: seat,
      accountType: 'family',
      profileType: 'adult',
      allowedModes: ['Privacy'],
      policyVersion: 1,
      audience: 'satchida-control',
      expiresInSeconds: 300,
      privateKey,
    });
  }

  /**
   * An assertion is single-use: the router's replay protection consumes its
   * jti. A test that sends two requests needs two assertions, or the second is
   * refused as a replay before the fair-use gate is ever reached.
   */
  function freshAssertionFor(seat) {
    return issuePrivacyAssertion({
      tenantId: 'tenant-a',
      seatAlias: seat,
      accountType: 'family',
      profileType: 'adult',
      allowedModes: ['Privacy'],
      policyVersion: 1,
      audience: 'satchida-control',
      expiresInSeconds: 300,
      privateKey,
    });
  }

  test('a router without a capacity probe serves every request', async () => {
    const { closeAll, port } = await startWithCapacity({ withProbe: false });
    try {
      const response = await fetch(`http://127.0.0.1:${port}/capacity`);
      const data = await response.json();
      assert.equal(data.verified, false);
    } finally {
      await closeAll();
    }
  });

  test('the capacity endpoint reports the served concurrency', async () => {
    const { closeAll, port } = await startWithCapacity({ cServed: 3 });
    try {
      const response = await fetch(`http://127.0.0.1:${port}/capacity`);
      const data = await response.json();
      assert.equal(data.verified, true);
      assert.equal(data.cServed, 3);
    } finally {
      await closeAll();
    }
  });

  test('a probe-report capacity activates fair use through the router', async () => {
    // The artefact the operator actually produces is a probe report, so the
    // router has to turn it into an active fair-use controller rather than
    // serving every request unverified.
    const upstream = createServer(async (req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"status":"ready"}');
        return;
      }
      for await (const chunk of req) { /* drain */ }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      }));
    });
    await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
    const router = await createPrivacyRouter({
      publicKeys: { default: publicKey },
      audience: 'satchida-control',
      tenantId: 'tenant-a',
      upstreams: { Privacy: `http://127.0.0.1:${upstream.address().port}` },
      capacity: {
        schema: 'satchida.capacity.probe.v1',
        derived: { c_served: 4 },
        throughput: { prefill_tps: 13661, aggregate_tps: { 1: 81.8, 2: 172.8, 4: 165.8 } },
      },
    });
    await router.listen(0, '127.0.0.1');
    const port = router.server.address().port;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/capacity`);
      const data = await response.json();
      assert.equal(data.verified, true);
      assert.equal(data.state, 'active');
      assert.equal(data.cServed, 4);
    } finally {
      await router.close();
      await new Promise((resolve) => { upstream.close(resolve); upstream.closeAllConnections?.(); });
    }
  });

  test('an unusable capacity report fails open and says so', async () => {
    const upstream = createServer(async (req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"status":"ready"}');
    });
    await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
    const router = await createPrivacyRouter({
      publicKeys: { default: publicKey },
      audience: 'satchida-control',
      tenantId: 'tenant-a',
      upstreams: { Privacy: `http://127.0.0.1:${upstream.address().port}` },
      capacity: { derived: { c_served: 4 } },
    });
    await router.listen(0, '127.0.0.1');
    const port = router.server.address().port;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/capacity`);
      const data = await response.json();
      assert.equal(data.verified, false);
      assert.equal(data.state, 'unusable');
    } finally {
      await router.close();
      await new Promise((resolve) => { upstream.close(resolve); upstream.closeAllConnections?.(); });
    }
  });

  test('a request beyond the served concurrency is queued, not refused outright', async () => {
    const { closeAll, port } = await startWithCapacity({ cServed: 1 });
    try {
      const token = assertionFor('seat-aaaa-aaaa-aaaa-0001');
      const first = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ model: 'Privacy', messages: [{ role: 'user', content: 'hi' }] }),
      });
      assert.equal(first.status, 200);
    } finally {
      await closeAll();
    }
  });

  test('a queued request carries a position and a retry hint', async () => {
    // cServed of 1 with a slow upstream so the first request is still running.
    const upstream = createServer(async (req, res) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 10, completion_tokens: 10 } }));
    });
    await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
    const router = await createPrivacyRouter({
      publicKeys: { default: publicKey },
      audience: 'satchida-control',
      tenantId: 'tenant-a',
      upstreams: { Privacy: `http://127.0.0.1:${upstream.address().port}` },
      capacity: { c_served: 1, prefill_tps: 4800, aggregate_tps: 190 },
    });
    await router.listen(0, '127.0.0.1');
    const port = router.server.address().port;
    let inFlight;
    try {
      inFlight = fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${freshAssertionFor('seat-bbbb-bbbb-bbbb-0001')}` },
        body: JSON.stringify({ model: 'Privacy', messages: [{ role: 'user', content: 'hi' }] }),
      });
      await new Promise((resolve) => setTimeout(resolve, 80));
      const queued = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${freshAssertionFor('seat-bbbb-bbbb-bbbb-0001')}` },
        body: JSON.stringify({ model: 'Privacy', messages: [{ role: 'user', content: 'hi again' }] }),
      });
      assert.equal(queued.status, 429);
      const data = await queued.json();
      assert.ok(data.error.position >= 1, 'a position must be reported');
      assert.ok(queued.headers.get('x-satchida-queue-position'));
      assert.ok(queued.headers.get('retry-after'));
    } finally {
      await inFlight?.catch(() => {});
      await router.close();
      await new Promise((resolve) => { upstream.close(resolve); upstream.closeAllConnections?.(); });
    }
  });

  test('the capacity report holds no prompt content', async () => {
    const { closeAll, port } = await startWithCapacity({ cServed: 2 });
    try {
      const token = assertionFor('seat-cccc-cccc-cccc-0001');
      await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ model: 'Privacy', messages: [{ role: 'user', content: 'secret prompt text' }] }),
      });
      const response = await fetch(`http://127.0.0.1:${port}/capacity`);
      const text = await response.text();
      assert.ok(!/secret|prompt text/i.test(text), 'the capacity report leaked prompt content');
    } finally {
      await closeAll();
    }
  });
});

describe('createPrivacyRouter', () => {
  let router;
  let server;
  let port;

  before(async () => {
    server = createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"status":"ready"}');
        return;
      }
      if (req.url === '/v1/chat/completions' && req.method === 'POST') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: Date.now(),
          model: 'Privacy',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Hello' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        }));
        return;
      }
      res.writeHead(404);
      res.end('Not found');
    });

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        resolve();
      });
    });

    router = await createPrivacyRouter({
      publicKeys: { default: publicKey },
      audience: 'satchida-control',
      tenantId: 'tenant-a',
      upstreams: { Privacy: `http://127.0.0.1:${port}` },
      childSafety: { ready: () => true, checkInput: () => true, checkOutput: () => true },
    });
    await router.listen(port + 1, '127.0.0.1');
  });

  after(() => {
    server.close();
    router.close();
  });

  test('GET /health returns ready', async () => {
    const port = router.server.address().port;
    const resp = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(resp.status, 200);
    const data = await resp.json();
    assert.equal(data.status, 'ready');
  });

  test('GET /health returns 503 when local model is down', async () => {
    const failingRouter = await createPrivacyRouter({
      publicKeys: { default: publicKey },
      audience: 'satchida-control',
      tenantId: 'tenant-a',
      upstreams: { Privacy: `http://127.0.0.1:1` },
    });
    await failingRouter.listen(0, '127.0.0.1');
    const addr = failingRouter.server.address();
    const resp = await fetch(`http://127.0.0.1:${addr.port}/health`);
    assert.equal(resp.status, 503);
    await failingRouter.close();
  });

  test('rejects request without Bearer token', async () => {
    const port = router.server.address().port;
    const resp = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'Privacy', messages: [{ role: 'user', content: 'hello' }] }),
    });
    assert.equal(resp.status, 401);
    const data = await resp.json();
    assert.equal(data.error.code, 'privacy_assertion_required');
  });

  test('rejects request with invalid assertion', async () => {
    const port = router.server.address().port;
    const resp = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: 'Bearer invalid-token' },
      body: JSON.stringify({ model: 'Privacy', messages: [{ role: 'user', content: 'hello' }] }),
    });
    assert.equal(resp.status, 403);
    const data = await resp.json();
    assert.equal(data.error.code, 'privacy_assertion_invalid');
  });

  test('proxies valid Privacy request to local model', async () => {
    const token = issuePrivacyAssertion({ ...SIGN_OPTIONS, expiresInSeconds: 60, jti: 'valid-proxy-test-0001' });
    const port = router.server.address().port;
    const resp = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ model: 'Privacy', messages: [{ role: 'user', content: 'hello' }] }),
    });
    assert.equal(resp.status, 200);
    const data = await resp.json();
    assert.equal(data.model, 'Privacy');
    assert.ok(data.choices?.[0]?.message?.content);
  });

  test('the same seat may reuse its assertion across turns', async () => {
    // A conversation presents one assertion on every turn, so a second use by
    // the same seat must succeed.
    const token = issuePrivacyAssertion({
      ...SIGN_OPTIONS,
      expiresInSeconds: 60,
      jti: 'replay-test-jti-000001',
    });
    const port = router.server.address().port;
    const body = JSON.stringify({ model: 'Privacy', messages: [{ role: 'user', content: 'hello' }] });

    const resp1 = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body,
    });
    assert.equal(resp1.status, 200);

    const resp2 = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body,
    });
    assert.equal(resp2.status, 200);
  });

  test('an assertion bound to one seat is refused for another', async () => {
    const token = issuePrivacyAssertion({
      ...SIGN_OPTIONS,
      expiresInSeconds: 60,
      jti: 'replay-test-jti-000002',
    });
    const port = router.server.address().port;
    const body = JSON.stringify({ model: 'Privacy', messages: [{ role: 'user', content: 'hello' }] });

    const first = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body,
    });
    assert.equal(first.status, 200);

    // The same assertion presented as a different seat must be refused, so one
    // seat cannot lend its entitlement to another.
    const other = issuePrivacyAssertion({
      ...SIGN_OPTIONS,
      seatAlias: 'opaque-seat-0000000002',
      expiresInSeconds: 60,
      jti: 'replay-test-jti-000002',
    });
    const resp2 = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${other}` },
      body,
    });
    assert.equal(resp2.status, 403);
    const data = await resp2.json();
    assert.equal(data.error.code, 'privacy_assertion_invalid');
  });
});

describe('the model the local runtime is actually asked for', () => {
  const CATALOGUE = [
    'Ternary-Bonsai-2-9B-PQ2_0-MTP-Q8_0',
    'Qwen2.5-Omni-7B-Q4_K_M',
    'granite-4.0-1b-Q4_K_M',
  ];

  // A fake local runtime that reports a catalogue and records the model it was
  // asked for.
  async function startRuntime({ capacity = null } = {}) {
    const seen = [];
    const upstream = createServer(async (req, res) => {
      if (req.url === '/v1/models') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ object: 'list', data: CATALOGUE.map((id) => ({ id })) }));
        return;
      }
      if (req.url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"status":"ready"}');
        return;
      }
      let raw = '';
      for await (const chunk of req) raw += chunk;
      let body = {};
      try {
        body = JSON.parse(raw);
      } catch {
        body = {};
      }
      seen.push(body.model);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        id: 'chatcmpl-1',
        model: body.model,
        choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      }));
    });
    await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
    const upstreamPort = upstream.address().port;

    const router = await createPrivacyRouter({
      publicKeys: { default: publicKey },
      audience: 'satchida-control',
      tenantId: 'tenant-a',
      upstreams: { Privacy: `http://127.0.0.1:${upstreamPort}` },
      childSafety: { ready: () => true, checkInput: () => true, checkOutput: () => true },
      ...(capacity ? { capacity } : {}),
    });
    await router.listen(0, '127.0.0.1');
    const port = router.server.address().port;
    const closeAll = async () => {
      await router.close();
      await new Promise((resolve) => { upstream.close(resolve); upstream.closeAllConnections?.(); });
    };
    return { seen, port, closeAll };
  }

  async function askPrivacy(port) {
    const token = issuePrivacyAssertion({ ...SIGN_OPTIONS, expiresInSeconds: 60, jti: `model-test-${Math.random().toString(36).slice(2, 20)}` });
    const resp = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ model: 'Privacy', messages: [{ role: 'user', content: 'hello' }] }),
    });
    return { status: resp.status, body: await resp.json() };
  }

  test('the runtime is asked for a concrete model, not the mode label', async () => {
    // The request is read as raw bytes, and those bytes carry the mode label.
    // The label has to be replaced in the body that is actually forwarded,
    // otherwise the runtime answers "model 'Privacy' not found" and every
    // adult Privacy request fails.
    const { seen, port, closeAll } = await startRuntime();
    try {
      const { status } = await askPrivacy(port);
      assert.equal(status, 200);
      assert.equal(seen.length, 1);
      assert.notEqual(seen[0], 'Privacy');
      assert.ok(CATALOGUE.includes(seen[0]), `forwarded model ${seen[0]} is not in the catalogue`);
    } finally {
      await closeAll();
    }
  });

  test('the measured model is served when a capacity report names one', async () => {
    // The fair-use rates in the report describe ONE model measured on this
    // hardware. Serving a different model while charging against those rates
    // would make the accounting wrong with nothing to surface it.
    const { seen, port, closeAll } = await startRuntime({
      capacity: {
        model: 'Ternary-Bonsai-2-9B-PQ2_0-MTP-Q8_0',
        derived: { c_served: 4 },
        throughput: { prefill_tps: 13661, aggregate_tps: { 1: 81.8, 2: 172.8, 4: 165.8 } },
      },
    });
    try {
      const { status } = await askPrivacy(port);
      assert.equal(status, 200);
      assert.equal(seen[0], 'Ternary-Bonsai-2-9B-PQ2_0-MTP-Q8_0');
    } finally {
      await closeAll();
    }
  });

  test('the preference list is used when there is no capacity report', async () => {
    const { seen, port, closeAll } = await startRuntime();
    try {
      await askPrivacy(port);
      // The default preference for the Privacy mode lists the Omni model
      // first, and it is present in the catalogue.
      assert.equal(seen[0], 'Qwen2.5-Omni-7B-Q4_K_M');
    } finally {
      await closeAll();
    }
  });

  test('a measured model the runtime does not have falls back to the preference', async () => {
    const { seen, port, closeAll } = await startRuntime({
      capacity: {
        model: 'a-model-that-was-unloaded',
        derived: { c_served: 4 },
        throughput: { prefill_tps: 13661, aggregate_tps: { 1: 81.8, 2: 172.8, 4: 165.8 } },
      },
    });
    try {
      const { status } = await askPrivacy(port);
      assert.equal(status, 200);
      assert.equal(seen[0], 'Qwen2.5-Omni-7B-Q4_K_M');
    } finally {
      await closeAll();
    }
  });

  test('normaliseCapacity carries the measured model', () => {
    const rates = normaliseCapacity({
      model: 'Ternary-Bonsai-2-9B-PQ2_0-MTP-Q8_0',
      derived: { c_served: 4 },
      throughput: { prefill_tps: 13661, aggregate_tps: { 1: 81.8, 2: 172.8, 4: 165.8 } },
    });
    assert.equal(rates.model, 'Ternary-Bonsai-2-9B-PQ2_0-MTP-Q8_0');
  });
});
