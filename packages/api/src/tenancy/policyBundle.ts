/**
 * Verification of the operator's Policy Bundle and Revocation Delta.
 *
 * The operator signs these documents with an Ed25519 private key that never
 * leaves the operator host. The tenant holds only the public key and verifies
 * every document before acting on it.
 *
 * The two documents are split by lifetime. A contract can run twelve months, but
 * a seat must be killable in hours, so a long-lived Bundle carries the contract
 * state and a short-lived Delta carries revocations. The Bundle's lifetime is
 * capped at thirty days whatever the contract says, so revocation lag is bounded
 * by the Delta cadence rather than by a year-long contract.
 */
import { createPublicKey, verify as verifyBytes } from 'node:crypto';

/** The Bundle document format. */
export const POLICY_BUNDLE_SCHEMA = 'satchida.policy.bundle.v1';

/** The Delta document format. */
export const POLICY_DELTA_SCHEMA = 'satchida.policy.delta.v1';

/** The hard ceiling on a Bundle's lifetime, matching the operator. */
export const MAX_BUNDLE_TTL_SECONDS = 30 * 24 * 3600;

/** The default lifetime of a Revocation Delta. */
export const DEFAULT_DELTA_TTL_SECONDS = 6 * 3600;

export class PolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PolicyError';
  }
}

/** One commercial account type's configuration. */
export type PolicyAccountType = {
  accountType: string;
  displayName?: string;
  termEndAt: number;
  termMonths: number;
  autoRenew: boolean;
  seatCount: number;
  enabled: boolean;
  quotaUnits: number;
  fairUse?: {
    soft: number;
    hard: number;
    serious: number;
    hardCooldownSeconds: number;
    seriousCooldownSeconds: number;
    seriousGpuSeconds?: number;
  };
};

/** One seat's entitlement. */
export type PolicySeat = {
  alias: string;
  accountType: string;
  profile: 'adult' | 'child';
  modes: string[];
  capabilities: string[];
  disabled?: boolean;
};

/** The constants the tenant's hardware probe produced. */
export type PolicyCapacity = {
  cCompute: number;
  cMemory: number;
  cServed: number;
  bindingLimit: string;
  verified: boolean;
  targetPerSeatTps?: number;
  prefillTps?: number;
  aggregateTps?: number;
};

/** The signed document handed to a tenant. */
export type PolicyBundle = {
  schema: string;
  tenantId: string;
  policyVersion: number;
  issuedAt: number;
  expiresAt: number;
  accountTypes: Record<string, PolicyAccountType>;
  seats: Record<string, PolicySeat>;
  capacity?: PolicyCapacity;
  keyId: string;
};

/** The short-lived document that disables seats quickly. */
export type RevocationDelta = {
  schema: string;
  tenantId: string;
  policyVersion: number;
  issuedAt: number;
  expiresAt: number;
  disabledSeats: string[];
  keyId: string;
};

function decodeSegment(segment: string, label: string): Buffer {
  try {
    return Buffer.from(segment, 'base64url');
  } catch {
    throw new PolicyError(`${label} is not valid base64url`);
  }
}

/**
 * Verify a signed document and return its parsed body.
 *
 * The signature is checked before anything in the body is trusted, and the
 * schema is checked before the signature, so a document of the wrong kind can
 * never be read as the other kind.
 */
function verifyDocument(
  payloadB64: string,
  signatureB64: string,
  publicKeys: Record<string, string | import('node:crypto').KeyObject>,
  expectedSchema: string,
  label: string,
): Record<string, unknown> {
  if (typeof payloadB64 !== 'string' || !payloadB64) {
    throw new PolicyError(`${label} payload is missing`);
  }
  if (typeof signatureB64 !== 'string' || !signatureB64) {
    throw new PolicyError(`${label} signature is missing`);
  }
  const payload = decodeSegment(payloadB64, `${label} payload`);
  const signature = decodeSegment(signatureB64, `${label} signature`);

  let probe;
  try {
    probe = JSON.parse(payload.toString('utf8'));
  } catch {
    throw new PolicyError(`${label} payload is not valid JSON`);
  }
  if (probe.schema !== expectedSchema) {
    throw new PolicyError(`unexpected document schema ${JSON.stringify(probe.schema)}`);
  }
  const key = publicKeys?.[probe.keyId];
  if (!key) {
    throw new PolicyError(
      `no verification key registered for key id ${JSON.stringify(probe.keyId)}`,
    );
  }
  const publicKey = typeof key === 'string' ? createPublicKey(key) : key;
  if (!verifyBytes(null, payload, publicKey, signature)) {
    throw new PolicyError(`${label} signature is invalid`);
  }
  return probe;
}

/** Options accepted when verifying an operator document. */
export type VerifyOptions = {
  /** The tenant the document is expected to belong to. */
  tenantId?: string;
  /** The current time, injectable for tests. */
  now?: number;
};

/**
 * Verify a Policy Bundle.
 *
 * Signature first, then tenant, then expiry. A forged or stale document is
 * rejected before it can widen access.
 */
export function verifyPolicyBundle(
  payloadB64: string,
  signatureB64: string,
  publicKeys: Record<string, string | import('node:crypto').KeyObject>,
  { tenantId, now = Math.floor(Date.now() / 1000) }: VerifyOptions = {},
): PolicyBundle {
  const bundle = verifyDocument(
    payloadB64,
    signatureB64,
    publicKeys,
    POLICY_BUNDLE_SCHEMA,
    'policy bundle',
  ) as PolicyBundle;

  if (tenantId && bundle.tenantId !== tenantId) {
    throw new PolicyError('policy bundle tenant mismatch');
  }
  if (bundle.expiresAt > 0 && now >= bundle.expiresAt) {
    throw new PolicyError('policy bundle is expired');
  }
  // The operator caps the lifetime at thirty days. A document claiming longer
  // than that is either forged or minted by an operator build that predates the
  // cap, and either way it should not be honoured silently.
  if (bundle.expiresAt - bundle.issuedAt > MAX_BUNDLE_TTL_SECONDS) {
    throw new PolicyError('policy bundle lifetime exceeds the permitted maximum');
  }
  return bundle;
}

/**
 * Verify a Revocation Delta.
 */
export function verifyRevocationDelta(
  payloadB64: string,
  signatureB64: string,
  publicKeys: Record<string, string | import('node:crypto').KeyObject>,
  { tenantId, now = Math.floor(Date.now() / 1000) }: VerifyOptions = {},
): RevocationDelta {
  const delta = verifyDocument(
    payloadB64,
    signatureB64,
    publicKeys,
    POLICY_DELTA_SCHEMA,
    'revocation delta',
  ) as RevocationDelta;

  if (tenantId && delta.tenantId !== tenantId) {
    throw new PolicyError('revocation delta tenant mismatch');
  }
  if (delta.expiresAt > 0 && now >= delta.expiresAt) {
    throw new PolicyError('revocation delta is expired');
  }
  return delta;
}

/**
 * Resolve what a seat may do under a bundle and a delta.
 *
 * A revoked seat, a seat absent from the bundle, a disabled account type, or an
 * expired contract all deny. Deny is the default in every ambiguous case.
 */
export function resolveSeatEntitlement(
  bundle: PolicyBundle | null | undefined,
  delta: RevocationDelta | null | undefined,
  alias: string,
  {
    now = Math.floor(Date.now() / 1000),
    gracePeriodSeconds = 0,
  }: { now?: number; gracePeriodSeconds?: number } = {},
): {
  allowed: boolean;
  reason?: string;
  seat?: PolicySeat;
  accountType?: PolicyAccountType;
} {
  if (!bundle) return { allowed: false, reason: 'no_policy_bundle' };
  const seat = bundle.seats?.[alias];
  if (!seat) return { allowed: false, reason: 'seat_not_in_bundle' };
  if (seat.disabled) return { allowed: false, reason: 'seat_disabled_in_bundle' };

  // A delta revocation overrides the bundle, which is the whole point of
  // splitting the two documents by lifetime.
  if (delta && Array.isArray(delta.disabledSeats) && delta.disabledSeats.includes(alias)) {
    return { allowed: false, reason: 'seat_revoked_by_delta' };
  }

  const accountType = bundle.accountTypes?.[seat.accountType];
  if (!accountType) return { allowed: false, reason: 'account_type_not_in_bundle' };
  if (!accountType.enabled) return { allowed: false, reason: 'account_type_disabled' };

  if (accountType.termEndAt > 0 && now >= accountType.termEndAt + gracePeriodSeconds) {
    return { allowed: false, reason: 'contract_expired' };
  }

  return { allowed: true, seat, accountType };
}

/**
 * Report whether a seat may use a mode.
 */
export function seatAllowsMode(
  bundle: PolicyBundle | null | undefined,
  delta: RevocationDelta | null | undefined,
  alias: string,
  mode: string,
  options: { now?: number; gracePeriodSeconds?: number } = {},
): boolean {
  const entitlement = resolveSeatEntitlement(bundle, delta, alias, options);
  if (!entitlement.allowed || !entitlement.seat) return false;
  const modes = entitlement.seat.modes ?? [];
  return modes.some((candidate) => String(candidate).toLowerCase() === String(mode).toLowerCase());
}

/**
 * Report whether a seat may use a capability such as work_tools or mcp.
 *
 * A child seat never holds capabilities, and a Family seat never holds them
 * either, which is the rule the approved routing document sets out.
 */
export function seatAllowsCapability(
  bundle: PolicyBundle | null | undefined,
  delta: RevocationDelta | null | undefined,
  alias: string,
  capability: string,
  options: { now?: number; gracePeriodSeconds?: number } = {},
): boolean {
  const entitlement = resolveSeatEntitlement(bundle, delta, alias, options);
  if (!entitlement.allowed || !entitlement.seat || !entitlement.accountType) return false;
  const { seat, accountType } = entitlement;
  if (seat.profile === 'child') return false;
  if (accountType.accountType === 'family') return false;
  return (seat.capabilities ?? []).includes(capability);
}
