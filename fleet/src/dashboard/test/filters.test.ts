import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyFilters, INITIAL_FILTERS } from '../src/lib/filters.ts';
import { compactTokens, isHeartbeatStale, licenceCountdown, relativeTime } from '../src/lib/format.ts';
import type { TenantSummary } from '../src/api/types.ts';

const NOW = Date.parse('2026-10-05T12:00:00Z');
const DAY = 86_400_000;

function make(overrides: Partial<TenantSummary>): TenantSummary {
  return {
    id: 't',
    name: 'Tenant',
    subdomain: 't.satchida.com',
    status: 'ACTIVE',
    plan: 'pro',
    activeSeats: 1,
    allowedSeats: 10,
    licenceExpiresAt: new Date(NOW + 30 * DAY).toISOString(),
    lastHeartbeatAt: new Date(NOW - 3_600_000).toISOString(),
    nodeIp: '1.2.3.4',
    tokenSpendToday: 0,
    tokenSpendThisMonth: 0,
    ...overrides,
  };
}

const rows: TenantSummary[] = [
  make({ id: 'a', name: 'Alpha School', subdomain: 'alpha.satchida.com', status: 'ACTIVE', plan: 'pro', licenceExpiresAt: new Date(NOW + 3 * DAY).toISOString() }),
  make({ id: 'b', name: 'Beta Textiles', subdomain: 'beta.satchida.com', status: 'EXPIRED', plan: 'basic', licenceExpiresAt: new Date(NOW - 5 * DAY).toISOString() }),
  make({ id: 'c', name: 'Gamma Care', subdomain: 'gamma.satchida.com', status: 'ACTIVE', plan: 'family', licenceExpiresAt: new Date(NOW + 20 * DAY).toISOString() }),
  make({ id: 'd', name: 'Delta Labs', subdomain: 'delta.satchida.com', status: 'BLOCKED', plan: 'enterprise', licenceExpiresAt: new Date(NOW + 60 * DAY).toISOString() }),
];

test('no filters returns every tenant', () => {
  assert.equal(applyFilters(rows, INITIAL_FILTERS, NOW).length, 4);
});

test('status filter selects exactly that status', () => {
  const active = applyFilters(rows, { ...INITIAL_FILTERS, status: 'ACTIVE' }, NOW);
  assert.deepEqual(active.map((t) => t.id), ['a', 'c']);
});

test('plan filter composes with status filter', () => {
  const result = applyFilters(rows, { ...INITIAL_FILTERS, status: 'ACTIVE', plan: 'family' }, NOW);
  assert.deepEqual(result.map((t) => t.id), ['c']);
});

test('expiry window excludes already-expired licences', () => {
  /* Tenant b expired 5 days ago. A naive "remaining <= window" test would
     sweep it into "expiring in 7 days" because -5d <= 7d. */
  const result = applyFilters(rows, { ...INITIAL_FILTERS, expiry: '7' }, NOW);
  assert.deepEqual(result.map((t) => t.id), ['a']);
});

test('expired filter returns only licences past their boundary', () => {
  const result = applyFilters(rows, { ...INITIAL_FILTERS, expiry: 'expired' }, NOW);
  assert.deepEqual(result.map((t) => t.id), ['b']);
});

test('query matches name or subdomain, case-insensitively', () => {
  assert.deepEqual(applyFilters(rows, { ...INITIAL_FILTERS, query: 'gamma' }, NOW).map((t) => t.id), ['c']);
  assert.deepEqual(applyFilters(rows, { ...INITIAL_FILTERS, query: 'ALPHA' }, NOW).map((t) => t.id), ['a']);
  assert.equal(applyFilters(rows, { ...INITIAL_FILTERS, query: '   ' }, NOW).length, 4, 'blank query is not a filter');
});

test('compactTokens keeps fleet-scale numbers scannable', () => {
  assert.equal(compactTokens(0), '0');
  assert.equal(compactTokens(940), '940');
  assert.equal(compactTokens(421_700), '421.7K');
  assert.equal(compactTokens(4_182_900), '4.18M');
});

test('relativeTime reports a never-checked-in node distinctly', () => {
  assert.equal(relativeTime(null, NOW), 'Never');
  assert.equal(relativeTime(new Date(NOW - 30 * 60_000).toISOString(), NOW), '30m ago');
  assert.equal(relativeTime(new Date(NOW - 5 * 3_600_000).toISOString(), NOW), '5h ago');
});

test('licenceCountdown distinguishes live from lapsed', () => {
  const live = licenceCountdown(new Date(NOW + 5 * DAY).toISOString(), NOW);
  assert.equal(live.expired, false);
  assert.match(live.label, /remaining$/);

  const lapsed = licenceCountdown(new Date(NOW - 3 * DAY).toISOString(), NOW);
  assert.equal(lapsed.expired, true);
  assert.match(lapsed.label, /^Expired/);
});

test('heartbeat staleness flags a node past the 6h cycle, and a node that never checked in', () => {
  assert.equal(isHeartbeatStale(new Date(NOW - 3 * 3_600_000).toISOString(), NOW), false);
  assert.equal(isHeartbeatStale(new Date(NOW - 7 * 3_600_000).toISOString(), NOW), true);
  assert.equal(isHeartbeatStale(null, NOW), true);
});
