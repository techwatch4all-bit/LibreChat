import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEntries } from '../src/registry.mjs';
import { SlidingLimiter, rulesFor, Gate } from '../src/limits.mjs';
import { selectCandidates, modeFromModelName, needsFromBody, parseModel } from '../src/select.mjs';
import { RouterState } from '../src/state.mjs';

const providers = {
  local: { baseURL: 'http://x', keyEnv: null, revenueSafe: true, retention: 'none', locality: 'local' },
  orr: { baseURL: 'http://o', keyEnv: 'K', revenueSafe: false, retention: 'documented' },
  tg: { baseURL: 'http://t', keyEnv: 'K2', revenueSafe: true, retention: 'documented' },
  zdr: { baseURL: 'http://z', keyEnv: 'K3', revenueSafe: true, retention: 'none' },
};
const raw = {
  providers,
  // Two pins. The openrouter one is pinned for Chat, where a free model leads.
  // The ZDR one is pinned for Work, because Work only serves zero-retention or
  // local providers: a pinned model with documented retention is excluded from
  // Work by the ZDR rule and can never be pinned into it.
  pins: [
    { idRegex: 'space.?bunny', modes: ['work', 'chat'], priority: 1 },
    { idRegex: 'zdr.?pinned', modes: ['work'], priority: 0 },
  ],
  models: [
    { id: 'local-default', provider: 'local', tier: 'local', modes: ['chat', 'work', 'privacy'], priority: 1000 },
    { id: 'paid-a', provider: 'tg', tier: 'paid', modes: ['work', 'chat'], priority: 20, capabilities: ['text', 'tools', 'streaming'] },
    { id: 'zdr-a', provider: 'zdr', tier: 'paid', modes: ['privacy'], priority: 5 },
  ],
};
const disc = [
  { id: 'foo:free', provider: 'orr', modes: ['chat', 'work'], capabilities: ['text', 'streaming'] },
  { id: 'Space-Bunny-Alpha:free', provider: 'orr', modes: ['chat'], capabilities: ['text', 'streaming'] },
  { id: 'zdr-pinned:free', provider: 'zdr', tier: 'paid', modes: ['chat'], capabilities: ['text', 'streaming'] },
];
const registry = { providers, entries: buildEntries(raw, disc), modeOrder: { chat: ['free', 'paid', 'local'], work: ['pinned', 'free', 'paid', 'local'], privacy: ['local'] } };
const base = { traffic: 'internal', needs: [], state: new RouterState(), hasKey: () => true, now: 0 };
const ids = (c) => c.map((e) => e.id);

test('chat prefers free, then paid, then local', () => {
  assert.deepEqual(ids(selectCandidates(registry, { ...base, mode: 'chat' })), ['Space-Bunny-Alpha:free', 'foo:free', 'zdr-pinned:free', 'paid-a', 'local-default']);
});
test('work puts pinned first', () => {
  assert.equal(ids(selectCandidates(registry, { ...base, mode: 'work' }))[0], 'zdr-pinned:free');
});
test('work excludes a provider with documented retention', () => {
  // Work serves only zero-retention or local providers, so the pinned openrouter
  // model and the paid one are both excluded even though they are free or cheap.
  const picked = ids(selectCandidates(registry, { ...base, mode: 'work' }));
  assert.ok(!picked.includes('Space-Bunny-Alpha:free'));
  assert.ok(!picked.includes('paid-a'));
  assert.ok(!picked.includes('foo:free'));
});
test('privacy: local only (modeOrder) and never unknown retention', () => {
  assert.deepEqual(ids(selectCandidates(registry, { ...base, mode: 'privacy' })), ['local-default']);
});
test('revenue gate only applies when switched on', () => {
  const off = ids(selectCandidates(registry, { ...base, mode: 'chat', traffic: 'revenue' }));
  assert.ok(off.includes('foo:free'));
  const r = ids(selectCandidates({ ...registry, revenueGate: 'on' }, { ...base, mode: 'chat', traffic: 'revenue' }));
  assert.ok(!r.includes('foo:free'));
  assert.ok(r.includes('paid-a'));
});
test('missing key removes provider', () => {
  const r = ids(selectCandidates(registry, { ...base, mode: 'chat', hasKey: (p) => p !== 'orr' }));
  assert.deepEqual(r, ['zdr-pinned:free', 'paid-a', 'local-default']);
});
test('cooldown removes entry; provider-wide cooldown removes all', () => {
  const s = new RouterState();
  s.cooldown('orr', 'foo:free', 1000, 0);
  assert.ok(!ids(selectCandidates(registry, { ...base, mode: 'chat', state: s })).includes('foo:free'));
  s.cooldown('orr', '*', 1000, 0);
  assert.ok(!ids(selectCandidates(registry, { ...base, mode: 'chat', state: s })).some((i) => i.includes('Bunny')));
});
test('circuit breaker opens on failure rate', () => {
  const s = new RouterState({ minSamples: 4, failThreshold: 0.5, openMs: 1000 });
  for (let i = 0; i < 4; i++) s.record('orr', 'foo:free', false, 0);
  assert.ok(s.isBlocked('orr', 'foo:free', 10));
  assert.ok(!s.isBlocked('orr', 'foo:free', 2000));
});
test('capability needs filter', () => {
  const r = ids(selectCandidates(registry, { ...base, mode: 'chat', needs: ['tools'] }));
  assert.deepEqual(r, ['paid-a']);
});
test('helpers', () => {
  assert.equal(modeFromModelName('satchida-privacy'), 'privacy');
  assert.equal(modeFromModelName('gpt'), 'chat');
  assert.equal(modeFromModelName('Study'), 'study');
  assert.equal(modeFromModelName('Privacy'), 'privacy');
  assert.deepEqual(needsFromBody({ tools: [{}], messages: [{ content: [{ type: 'image_url' }] }] }), ['tools', 'vision']);
});

test('plan/build variants parse', () => {
  assert.deepEqual(parseModel('Work - Plan'), { mode: 'work', variant: 'plan' });
  assert.deepEqual(parseModel('Privacy - Build'), { mode: 'privacy', variant: 'build' });
  assert.deepEqual(parseModel('work - build'), { mode: 'work', variant: 'build' });
  assert.deepEqual(parseModel('Study'), { mode: 'study', variant: null });
});
test('sliding limiter enforces 5h and day', () => {
  const l = new SlidingLimiter();
  const rules = rulesFor({ user: { h5: { default: 2 }, day: { default: 3 } } }, 'user', 'chat');
  assert.ok(l.check('k', rules, 0).ok);
  assert.ok(l.check('k', rules, 1000).ok);
  const r = l.check('k', rules, 2000);
  assert.equal(r.ok, false); assert.equal(r.window, '5h');
  assert.ok(l.check('k', rules, 5 * 3600_000 + 1).ok);
  assert.equal(l.check('k', rules, 5 * 3600_000 + 2).ok, false);
});
test('gate bounds concurrency and queues', async () => {
  const g = new Gate({ max: 1, maxQueue: 1, waitMs: 50 });
  const r1 = await g.acquire();
  const p2 = g.acquire();
  await assert.rejects(g.acquire(), { code: 'QUEUE_FULL' });
  r1();
  const r2 = await p2; r2();
  assert.equal(g.stats().active, 0);
});
