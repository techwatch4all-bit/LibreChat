/** Credit ledger tests — node --test test/credits.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { grant, balance, display, consume, guardTransfer, EXPIRY_DAYS, CREDIT_KIND, GRANT_REASON } from '../src/credits.mjs';

const NOW = 1_700_000_000;
const day = 86400;

const mk = (over = {}) =>
  grant({
    accountId: 'u1',
    kind: CREDIT_KIND.IMAGES,
    amount: 10,
    reason: GRANT_REASON.TOPUP,
    grantedAt: NOW,
    ...over,
  });

test('grant is immutable and bound to one account', () => {
  const g = mk();
  assert.throws(() => { 'use strict'; g.amount = 999; }, TypeError);
  assert.equal(g.accountId, 'u1');
  assert.equal(g.expiresAt, NOW + EXPIRY_DAYS * day);
});

test('balance sums images and tokens separately', () => {
  const b = balance([
    mk({ kind: CREDIT_KIND.IMAGES, amount: 10 }),
    mk({ kind: CREDIT_KIND.IMAGES, amount: 5 }),
    mk({ kind: CREDIT_KIND.TOKENS, amount: 1_000_000 }),
  ], NOW);
  assert.equal(b.images, 15);
  assert.equal(b.tokens, 1_000_000);
});

test('no grant means zero balance, not an error', () => {
  assert.deepEqual(balance([], NOW).images, 0);
});

test('display exposes no monetary value', () => {
  const d = display([mk()], NOW);
  assert.equal(d.currency, null);
  assert.equal(d.transferable, false);
  assert.equal(d.refundable, false);
  assert.ok(!('rupees' in d) && !('value' in d) && !('amountInr' in d));
});

test('display gives a professional countdown, not "use it or lose it"', () => {
  const d = display([mk({ grantedAt: NOW - 300 * day })], NOW);
  assert.equal(d.resetsInDays, 65);
  assert.ok(d.nextExpiryAt > NOW);
});

test('display shows no countdown when nothing is expiring', () => {
  const d = display([], NOW);
  assert.equal(d.resetsInDays, null);
  assert.equal(d.nextExpiryAt, null);
});

test('expired credits stop counting', () => {
  const g = mk({ grantedAt: NOW - (EXPIRY_DAYS + 1) * day });
  assert.equal(balance([g], NOW).images, 0);
});

test('consume refuses overdraw and reports what is available', () => {
  const r = consume([mk({ amount: 5 })], CREDIT_KIND.IMAGES, 10, NOW);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'insufficient_credits');
  assert.equal(r.available, 5);
});

test('consume refuses when the wrong kind is requested', () => {
  const r = consume([mk({ kind: CREDIT_KIND.IMAGES, amount: 99 })], CREDIT_KIND.TOKENS, 1, NOW);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'insufficient_credits');
});

test('consume exhausts the soonest expiry first', () => {
  const soon = mk({ grantedAt: NOW - 300 * day, remaining: 3, amount: 3 });
  const later = mk({ grantedAt: NOW - 10 * day, remaining: 20, amount: 20 });
  const r = consume([later, soon], CREDIT_KIND.IMAGES, 4, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.consumed[0].id, soon.id, 'the soonest-expiring grant must be consumed first');
});

test('a voided grant is invisible to balance and consume', () => {
  const g = { ...mk({ amount: 50 }), voidedAt: NOW, voidReason: 'dispute' };
  assert.equal(balance([g], NOW).images, 0);
  assert.equal(consume([g], CREDIT_KIND.IMAGES, 1, NOW).ok, false);
});

test('guard refuses every value-moving operation', () => {
  for (const [op, code] of [
    ['transferCredits', 'transfer_credits_not_permitted'],
    ['giftCredits', 'gifting_credits_not_permitted'],
    ['cashOut', 'cash_out_not_permitted'],
    ['refundToRupees', 'rupee_refund_not_permitted'],
  ]) {
    const r = guardTransfer({ [op]: 100 });
    assert.equal(r.ok, false, `${op} must be refused`);
    assert.equal(r.code, code);
  }
});

test('guard permits an ordinary operation', () => {
  assert.equal(guardTransfer({ accountId: 'u1' }).ok, true);
  assert.equal(guardTransfer({ transferCredits: false, cashOut: null }).ok, true);
});

test('grant validates its inputs', () => {
  assert.throws(() => grant({ accountId: '', kind: 'images', amount: 1, reason: 'topup' }), /accountId/);
  assert.throws(() => mk({ kind: 'gold' }), /unknown credit kind/);
  assert.throws(() => mk({ amount: 0 }), /positive integer/);
  assert.throws(() => mk({ amount: 1.5 }), /positive integer/);
  assert.throws(() => mk({ reason: 'because' }), /unknown reason/);
});

test('consume and grant reject non-integer amounts', () => {
  assert.throws(() => consume([], CREDIT_KIND.IMAGES, 1.5, NOW), /positive integer/);
  assert.throws(() => consume([], CREDIT_KIND.IMAGES, 0, NOW), /positive integer/);
});
