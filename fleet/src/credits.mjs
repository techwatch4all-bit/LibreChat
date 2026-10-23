/**
 * Satchida credit ledger — images and tokens, never money.
 *
 * Legal design (see LEGAL.md / CONTRACT-CLAUSES.md):
 *   - Denominated in IMAGES and TOKENS, never rupees. No cash value is displayed.
 *   - NON-TRANSFERABLE. Enforced here, not merely promised in terms. A transfer
 *     would move value between accounts and is the single property that would
 *     push this from a service credit toward a stored-value instrument.
 *   - NON-REFUNDABLE once credited.
 *   - 12-month expiry from grant, NOT perpetual. A never-expiring funded credit is
 *     an open-ended liability on the balance sheet.
 *   - Credits are bound to the owning account. They are an attribute of a user, not
 *     a bearer object: there is no "credit id" that could be held and passed on.
 *
 * Everything is integer arithmetic. Rupees are never stored alongside a balance.
 */

export const EXPIRY_DAYS = 365;

/** Credit kinds. Deliberately not an enum of value. */
export const CREDIT_KIND = Object.freeze({ IMAGES: 'images', TOKENS: 'tokens' });

/** Why a grant was issued — used for reconciliation and disputes. */
export const GRANT_REASON = Object.freeze({
  SUBSCRIPTION: 'subscription',
  TOPUP: 'topup',
  PROMOTION: 'promotion',
  REFUND_REVERSAL: 'refund_reversal',
  ADJUSTMENT: 'adjustment',
});

/** A credit grant is immutable once written. Balances are always derived. */
let seq = 0;
const nextId = () => `cr_${Date.now().toString(36)}_${(seq++).toString(36)}`;

const day = 86400;
const isInt = (n) => Number.isInteger(n) && n >= 0;

/**
 * Create a grant. Returns a frozen record; it is never mutated afterwards.
 * @param {object} p
 * @param {string} p.accountId   the owning account — credits cannot exist without one
 * @param {'images'|'tokens'} p.kind
 * @param {number} p.amount      integer, non-negative
 * @param {string} p.reason
 * @param {string} [p.note]      free text, never customer-supplied PII
 * @param {string} [p.grantedAt] epoch seconds, for tests
 * @returns {Readonly<object>}
 */
export function grant({ accountId, kind, amount, reason, note = '', grantedAt }) {
  if (!accountId || typeof accountId !== 'string') throw new Error('accountId is required');
  if (!Object.values(CREDIT_KIND).includes(kind)) throw new Error(`unknown credit kind: ${kind}`);
  if (!isInt(amount) || amount <= 0) throw new Error('amount must be a positive integer');
  if (!Object.values(GRANT_REASON).includes(reason)) throw new Error(`unknown reason: ${reason}`);

  const now = grantedAt ?? Math.floor(Date.now() / 1000);
  return Object.freeze({
    id: nextId(),
    accountId, // ownership is structural, not a transferable pointer
    kind,
    amount,
    remaining: amount,
    reason,
    note,
    grantedAt: now,
    expiresAt: now + EXPIRY_DAYS * day,
    voidedAt: null,
    voidReason: null,
  });
}

/**
 * Balance across a set of grants, expiring nothing yet.
 * @param {Readonly<object>[]} grants
 * @returns {{ images: number, tokens: number, expiring: object[] }}
 */
export function balance(grants, now = Math.floor(Date.now() / 1000)) {
  const out = { images: 0, tokens: 0, expiring: [] };
  for (const g of grants) {
    if (g.voidedAt || g.expiresAt <= now) continue;
    if (g.remaining <= 0) continue;
    out[g.kind] += g.remaining;
    out.expiring.push({ id: g.id, kind: g.kind, remaining: g.remaining, expiresAt: g.expiresAt });
  }
  out.expiring.sort((a, b) => a.expiresAt - b.expiresAt);
  return out;
}

/**
 * The user-facing balance view. Never exposes a monetary figure, and always
 * carries the expiry so the UI can show a professional countdown rather than
 * "use it or lose it".
 */
export function display(grants, now = Math.floor(Date.now() / 1000)) {
  const b = balance(grants, now);
  const soonest = b.expiring[0];
  return {
    images: b.images,
    tokens: b.tokens,
    // Countdown to the next reset, in whole days. Absent when nothing is expiring.
    resetsInDays: soonest ? Math.max(0, Math.ceil((soonest.expiresAt - now) / day)) : null,
    nextExpiryAt: soonest ? soonest.expiresAt : null,
    transferable: false,
    refundable: false,
    currency: null, // there is no rupee value to show
  };
}

/**
 * Consume credits. Consumes the grants that expire soonest first, so a user is
 * never surprised by losing value that was about to lapse.
 *
 * @returns {{ ok: boolean, code?: string, consumed?: object[] }}
 */
export function consume(grants, kind, amount, now = Math.floor(Date.now() / 1000)) {
  if (!isInt(amount) || amount <= 0) throw new Error('amount must be a positive integer');

  const eligible = grants
    .filter((g) => g.kind === kind && !g.voidedAt && g.expiresAt > now && g.remaining > 0)
    .sort((a, b) => a.expiresAt - b.expiresAt);

  const available = eligible.reduce((s, g) => s + g.remaining, 0);
  if (available < amount) {
    return { ok: false, code: 'insufficient_credits', available, requested: amount };
  }
  return { ok: true, consumed: eligible.map((g) => ({ id: g.id, remaining: g.remaining })) };
}

/**
 * Guard every path that would let value move between accounts.
 *
 * This is the control that keeps the design defensible. It is deliberately
 * fail-closed: anything not explicitly permitted is refused.
 *
 * @param {object} op
 * @param {string} [op.transferCredits] present => always refused
 * @param {string} [op.giftCredits]   present => always refused
 * @param {string} [op.cashOut]       present => always refused
 * @param {string} [op.refundToRupees] present => always refused
 * @returns {{ ok: boolean, code?: string }}
 */
export function guardTransfer({ transferCredits, giftCredits, cashOut, refundToRupees }) {
  const attempts = [
    ['transfer_credits_not_permitted', transferCredits],
    ['gifting_credits_not_permitted', giftCredits],
    ['cash_out_not_permitted', cashOut],
    ['rupee_refund_not_permitted', refundToRupees],
  ];
  const found = attempts.find(([, v]) => v !== undefined && v !== null && v !== false);
  if (found) return { ok: false, code: found[0] };
  return { ok: true };
}

/** Cooldown between top-ups — a defence against rapid-fire micro-purchases. */
export const TOPUP_COOLDOWN_DAYS = 30;