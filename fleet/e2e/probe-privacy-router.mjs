/**
 * What the Privacy router actually sends to the local model.
 *
 * The assertion is minted with the tenant's own signing key (the same key the
 * router verifies with), so this exercises the real path: the router, the
 * fair-use gate, the pack allowance and the local model.
 */
import { readFileSync } from 'node:fs';
import { createPrivateKey } from 'node:crypto';

import { issuePrivacyAssertion } from '../src/privacy/router.mjs';

const stateDir = new URL('../.state/', import.meta.url);
const privateKeyPem = readFileSync(new URL('signing.key.pem', stateDir), 'utf8');
const privateKey = createPrivateKey(privateKeyPem);

const audience = 'satchida-control';
const tenantId = 'satchida-master';
const seat = process.argv[2] || 'seat_e2e_KrAcoCbGq9I7';

for (const maxTokens of [undefined, 512, 2048]) {
  const token = issuePrivacyAssertion({
    privateKey,
    audience,
    tenantId,
    seatAlias: seat,
    profileType: 'adult',
    accountType: 'privacy',
    allowedModes: ['Privacy'],
    policyVersion: 1,
    childSafetyReady: true,
    expiresInSeconds: 120,
  });

  const body = { model: 'Privacy', messages: [{ role: 'user', content: 'Reply with exactly: PRIVACY_CHAIN_OK' }] };
  if (maxTokens !== undefined) body.max_tokens = maxTokens;

  const response = await fetch('http://127.0.0.1:4099/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  const choice = parsed?.choices?.[0];
  console.log(
    `max_tokens=${maxTokens ?? '(unset)'}: status=${response.status} ` +
      `finish=${choice?.finish_reason ?? '-'} ` +
      `content=${JSON.stringify(choice?.message?.content ?? '').slice(0, 60)} ` +
      `usage=${JSON.stringify(parsed?.usage ?? {}).slice(0, 120)}`,
  );
  if (response.status !== 200) console.log('   body:', text.slice(0, 300));
}
