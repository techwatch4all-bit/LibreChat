import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { issueLicence } from '../src/licence.mjs';
import { createPrivacyRouter, issuePrivacyAssertion } from '../src/privacy/router.mjs';
import { createGateway } from '../src/gateway.mjs';

const SECRET = 'sk-operator-secret-value';

function licenceFor(publicKey, privateKey, overrides = {}) {
  return issueLicence({
    clientId: 'hq-local',
    seats: 50,
    plan: 'enterprise',
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    privateKey,
    ...overrides,
  }).token;
}

test('the gateway routes Privacy to the privacy router, not to the bare local runtime', async () => {
  const pair = generateKeyPairSync('ed25519');
  const publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privateKey = pair.privateKey;

  const reached = [];
  const localUpstream = await import('node:http').then(({ createServer }) => new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      for await (const _chunk of req) { /* drain */ }
      reached.push('LOCAL-RUNTIME');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: 'local answer' } }] }));
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  }));

  const router = await createPrivacyRouter({
    publicKeys: { test: pair.publicKey },
    audience: 'tenant-privacy:test-node',
    tenantId: 'tenant-test',
    upstreams: { Privacy: `http://127.0.0.1:${localUpstream.port}` },
    fetchImpl: async () => new Response(
      JSON.stringify({ choices: [{ message: { content: 'routed answer' } }], usage: { prompt_tokens: 5, completion_tokens: 5 } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ),
  });
  const routerAddress = await router.listen(0, '127.0.0.1');

  const token = issuePrivacyAssertion({
    tenantId: 'tenant-test',
    seatAlias: 'opaque-seat-0000000000000001',
    accountType: 'family',
    profileType: 'adult',
    allowedModes: ['Privacy'],
    policyVersion: 7,
    audience: 'tenant-privacy:test-node',
    expiresInSeconds: 60,
    keyId: 'test',
    privateKey,
  });

  const gateway = createGateway({
    publicKey,
    keys: { recordFor: () => undefined, reveal: null },
    privacyRouter: {
      baseUrl: `http://127.0.0.1:${routerAddress.port}`,
      publicKeys: { test: pair.publicKey },
      audience: 'tenant-privacy:test-node',
      tenantId: 'tenant-test',
    },
    fetchImpl: fetch,
  });
  const gatewayAddress = await gateway.listen(0, '127.0.0.1');

  try {
    const response = await fetch(
      `http://127.0.0.1:${gatewayAddress.port}/v1/chat/completions?provider=privacy`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ model: 'Privacy', messages: [{ role: 'user', content: 'hello' }] }),
      },
    );
    const text = await response.text();
    assert.equal(response.status, 200, `status ${response.status} body ${text}`);
    assert.match(text, /routed answer/);
    // The bare local runtime must never have been reached: the router is the
    // only component allowed to touch it.
    assert.deepEqual(reached, [], 'the bare local runtime was reached directly');
  } finally {
    await gateway.close();
    await router.close();
    await new Promise((resolve) => { localUpstream.server.close(resolve); });
  }
});

test('the gateway refuses Privacy when no privacy router is configured', async () => {
  const pair = generateKeyPairSync('ed25519');
  const publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privateKey = pair.privateKey;

  const gateway = createGateway({
    publicKey,
    keys: { recordFor: () => undefined, reveal: null },
    fetchImpl: fetch,
  });
  const address = await gateway.listen(0, '127.0.0.1');
  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/v1/chat/completions?provider=privacy`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${licenceFor(publicKey, privateKey)}`,
        },
        body: JSON.stringify({ model: 'Privacy', messages: [{ role: 'user', content: 'hello' }] }),
      },
    );
    assert.equal(response.status, 503);
    const data = await response.json();
    assert.equal(data.error, 'privacy_unavailable');
  } finally {
    await gateway.close();
  }
});

test('the gateway passes the fair-use headers through to the client', async () => {
  const pair = generateKeyPairSync('ed25519');
  const publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privateKey = pair.privateKey;

  const router = await createPrivacyRouter({
    publicKeys: { test: pair.publicKey },
    audience: 'tenant-privacy:test-node',
    tenantId: 'tenant-test',
    upstreams: { Privacy: 'http://127.0.0.1:9999' },
    capacity: { c_served: 1, prefill_tps: 4800, aggregate_tps: 190 },
    fetchImpl: async () => new Response(
      JSON.stringify({ choices: [{ message: { content: 'busy' } }] }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ),
  });
  const routerAddress = await router.listen(0, '127.0.0.1');

  const gateway = createGateway({
    publicKey,
    keys: { recordFor: () => undefined, reveal: null },
    privacyRouter: {
      baseUrl: `http://127.0.0.1:${routerAddress.port}`,
      publicKeys: { test: pair.publicKey },
      audience: 'tenant-privacy:test-node',
      tenantId: 'tenant-test',
    },
    fetchImpl: fetch,
  });
  const gatewayAddress = await gateway.listen(0, '127.0.0.1');

  const token = issuePrivacyAssertion({
    tenantId: 'tenant-test',
    seatAlias: 'opaque-seat-0000000000000009',
    accountType: 'family',
    profileType: 'adult',
    allowedModes: ['Privacy'],
    policyVersion: 7,
    audience: 'tenant-privacy:test-node',
    expiresInSeconds: 60,
    keyId: 'test',
    privateKey,
  });

  try {
    const response = await fetch(
      `http://127.0.0.1:${gatewayAddress.port}/v1/chat/completions?provider=privacy`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ model: 'Privacy', messages: [{ role: 'user', content: 'hello' }] }),
      },
    );
    const text = await response.text();
    assert.equal(response.status, 200, `status ${response.status} body ${text}`);
    assert.equal(response.headers.get('x-satchida-mode'), 'Privacy');
  } finally {
    await gateway.close();
    await router.close();
  }
});
