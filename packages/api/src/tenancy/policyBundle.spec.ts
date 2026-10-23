import { generateKeyPairSync, sign as signBytes } from 'node:crypto';
import {
  verifyPolicyBundle,
  verifyRevocationDelta,
  resolveSeatEntitlement,
  seatAllowsMode,
  seatAllowsCapability,
  PolicyError,
  MAX_BUNDLE_TTL_SECONDS,
} from './policyBundle';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const publicKeys = { k1: publicKey };

const now = 1_700_000_000;

function bundle(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'satchida.policy.bundle.v1',
    tenantId: 'tnt_x',
    policyVersion: 42,
    issuedAt: now,
    expiresAt: now + MAX_BUNDLE_TTL_SECONDS,
    accountTypes: {
      privacy: {
        accountType: 'privacy',
        termEndAt: 0,
        termMonths: 12,
        autoRenew: true,
        seatCount: 25,
        enabled: true,
        quotaUnits: 0,
        fairUse: {
          soft: 0.35,
          hard: 0.7,
          serious: 1.5,
          hardCooldownSeconds: 30,
          seriousCooldownSeconds: 60,
        },
      },
      family: {
        accountType: 'family',
        termEndAt: 0,
        termMonths: 1,
        autoRenew: false,
        seatCount: 10,
        enabled: true,
        quotaUnits: 0,
      },
    },
    seats: {
      usr_anon_0000000001: {
        alias: 'usr_anon_0000000001',
        accountType: 'privacy',
        profile: 'adult' as const,
        modes: ['Chat', 'Work', 'Privacy'],
        capabilities: ['work_tools'],
        disabled: false,
      },
      usr_anon_0000000002: {
        alias: 'usr_anon_0000000002',
        accountType: 'family',
        profile: 'child' as const,
        modes: ['Chat', 'Study'],
        capabilities: [] as string[],
        disabled: false,
      },
    },
    keyId: 'k1',
    ...overrides,
  };
}

function sign(doc: Record<string, unknown>) {
  const payload = Buffer.from(JSON.stringify(doc), 'utf8');
  return {
    payload: payload.toString('base64url'),
    signature: signBytes(null, payload, privateKey).toString('base64url'),
  };
}

function delta(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'satchida.policy.delta.v1',
    tenantId: 'tnt_x',
    policyVersion: 42,
    issuedAt: now,
    expiresAt: now + 3600,
    disabledSeats: [],
    keyId: 'k1',
    ...overrides,
  };
}

describe('verifyPolicyBundle', () => {
  test('accepts a valid bundle', () => {
    const { payload, signature } = sign(bundle());
    const verified = verifyPolicyBundle(payload, signature, publicKeys, { tenantId: 'tnt_x', now });
    expect(verified.policyVersion).toBe(42);
    expect(Object.keys(verified.seats)).toHaveLength(2);
    expect(verified.accountTypes.privacy.fairUse?.serious).toBe(1.5);
  });

  test('rejects a tampered payload', () => {
    const { payload, signature } = sign(bundle());
    const tampered = Buffer.from(payload, 'base64url');
    tampered[tampered.length - 10] = tampered[tampered.length - 10] ^ 0x01;
    expect(() =>
      verifyPolicyBundle(tampered.toString('base64url'), signature, publicKeys, {
        tenantId: 'tnt_x',
        now,
      }),
    ).toThrow(PolicyError);
  });

  test('rejects a signature from another key', () => {
    const other = generateKeyPairSync('ed25519');
    const doc = bundle();
    const payload = Buffer.from(JSON.stringify(doc), 'utf8');
    const signature = signBytes(null, payload, other.privateKey).toString('base64url');
    expect(() =>
      verifyPolicyBundle(payload.toString('base64url'), signature, publicKeys, {
        tenantId: 'tnt_x',
        now,
      }),
    ).toThrow(PolicyError);
  });

  test('rejects an unknown key id', () => {
    const { payload, signature } = sign(bundle({ keyId: 'k9' }));
    expect(() =>
      verifyPolicyBundle(payload, signature, publicKeys, { tenantId: 'tnt_x', now }),
    ).toThrow(PolicyError);
  });

  test('rejects the wrong tenant', () => {
    const { payload, signature } = sign(bundle());
    expect(() =>
      verifyPolicyBundle(payload, signature, publicKeys, { tenantId: 'tnt_other', now }),
    ).toThrow(/tenant mismatch/);
  });

  test('rejects an expired bundle', () => {
    const { payload, signature } = sign(bundle());
    expect(() =>
      verifyPolicyBundle(payload, signature, publicKeys, {
        tenantId: 'tnt_x',
        now: now + MAX_BUNDLE_TTL_SECONDS,
      }),
    ).toThrow(/expired/);
  });

  test('rejects a lifetime beyond the permitted maximum', () => {
    // A document claiming a longer life than the operator caps is either forged
    // or minted by a build that predates the cap. Either way it is not honoured.
    const { payload, signature } = sign(bundle({ expiresAt: now + 400 * 24 * 3600 }));
    expect(() =>
      verifyPolicyBundle(payload, signature, publicKeys, { tenantId: 'tnt_x', now }),
    ).toThrow(/exceeds the permitted maximum/);
  });

  test('rejects a document of the wrong schema', () => {
    const { payload, signature } = sign(delta());
    expect(() =>
      verifyPolicyBundle(payload, signature, publicKeys, { tenantId: 'tnt_x', now }),
    ).toThrow(/schema/);
  });
});

describe('verifyRevocationDelta', () => {
  test('accepts a valid delta', () => {
    const { payload, signature } = sign(delta({ disabledSeats: ['usr_anon_0000000002'] }));
    const verified = verifyRevocationDelta(payload, signature, publicKeys, {
      tenantId: 'tnt_x',
      now,
    });
    expect(verified.disabledSeats).toEqual(['usr_anon_0000000002']);
  });

  test('rejects an expired delta', () => {
    const { payload, signature } = sign(delta());
    expect(() =>
      verifyRevocationDelta(payload, signature, publicKeys, { tenantId: 'tnt_x', now: now + 3600 }),
    ).toThrow(/expired/);
  });

  test('a delta is not accepted as a bundle', () => {
    const { payload, signature } = sign(delta());
    expect(() =>
      verifyPolicyBundle(payload, signature, publicKeys, { tenantId: 'tnt_x', now }),
    ).toThrow(/schema/);
  });
});

describe('resolveSeatEntitlement', () => {
  test('an entitled seat resolves', () => {
    const result = resolveSeatEntitlement(bundle() as never, null, 'usr_anon_0000000001', { now });
    expect(result.allowed).toBe(true);
    expect(result.seat?.accountType).toBe('privacy');
  });

  test('an unknown seat is denied', () => {
    const result = resolveSeatEntitlement(bundle() as never, null, 'usr_anon_missing', { now });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('seat_not_in_bundle');
  });

  test('a seat disabled in the bundle is denied', () => {
    const doc = bundle();
    doc.seats.usr_anon_0000000001.disabled = true;
    const result = resolveSeatEntitlement(doc as never, null, 'usr_anon_0000000001', { now });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('seat_disabled_in_bundle');
  });

  test('a seat revoked by the delta is denied even when the bundle allows it', () => {
    // The delta is the fast kill. It must override the long-lived bundle.
    const doc = bundle();
    const rev = delta({ disabledSeats: ['usr_anon_0000000001'] });
    const result = resolveSeatEntitlement(doc as never, rev as never, 'usr_anon_0000000001', {
      now,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('seat_revoked_by_delta');
  });

  test('a disabled account type is denied', () => {
    const doc = bundle();
    doc.accountTypes.privacy.enabled = false;
    const result = resolveSeatEntitlement(doc as never, null, 'usr_anon_0000000001', { now });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('account_type_disabled');
  });

  test('an expired contract is denied', () => {
    const doc = bundle();
    doc.accountTypes.privacy.termEndAt = now - 10;
    const result = resolveSeatEntitlement(doc as never, null, 'usr_anon_0000000001', { now });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('contract_expired');
  });

  test('grace keeps an expired contract servable', () => {
    const doc = bundle();
    doc.accountTypes.privacy.termEndAt = now - 10;
    const result = resolveSeatEntitlement(doc as never, null, 'usr_anon_0000000001', {
      now,
      gracePeriodSeconds: 3600,
    });
    expect(result.allowed).toBe(true);
  });

  test('no bundle at all denies', () => {
    const result = resolveSeatEntitlement(null, null, 'usr_anon_0000000001', { now });
    expect(result.allowed).toBe(false);
  });
});

describe('seatAllowsMode', () => {
  test('permits a granted mode', () => {
    expect(seatAllowsMode(bundle() as never, null, 'usr_anon_0000000001', 'Privacy', { now })).toBe(
      true,
    );
  });

  test('refuses a mode outside the grant', () => {
    expect(seatAllowsMode(bundle() as never, null, 'usr_anon_0000000001', 'Study', { now })).toBe(
      false,
    );
  });

  test('refuses Work for a child seat', () => {
    expect(seatAllowsMode(bundle() as never, null, 'usr_anon_0000000002', 'Work', { now })).toBe(
      false,
    );
  });

  test('permits Study for a child seat', () => {
    expect(seatAllowsMode(bundle() as never, null, 'usr_anon_0000000002', 'Study', { now })).toBe(
      true,
    );
  });

  test('refuses everything for a revoked seat', () => {
    const rev = delta({ disabledSeats: ['usr_anon_0000000001'] });
    expect(
      seatAllowsMode(bundle() as never, rev as never, 'usr_anon_0000000001', 'Chat', { now }),
    ).toBe(false);
  });

  test('matching is case insensitive', () => {
    expect(seatAllowsMode(bundle() as never, null, 'usr_anon_0000000001', 'privacy', { now })).toBe(
      true,
    );
  });
});

describe('seatAllowsCapability', () => {
  test('permits a capability for a Pro seat', () => {
    expect(
      seatAllowsCapability(bundle() as never, null, 'usr_anon_0000000001', 'work_tools', { now }),
    ).toBe(true);
  });

  test('refuses a capability for a child seat', () => {
    const doc = bundle();
    doc.seats.usr_anon_0000000002.capabilities = ['work_tools'];
    expect(
      seatAllowsCapability(doc as never, null, 'usr_anon_0000000002', 'work_tools', { now }),
    ).toBe(false);
  });

  test('refuses a capability for a Family seat', () => {
    const doc = bundle();
    doc.seats.usr_anon_0000000001.accountType = 'family';
    expect(
      seatAllowsCapability(doc as never, null, 'usr_anon_0000000001', 'work_tools', { now }),
    ).toBe(false);
  });

  test('refuses a capability that was not granted', () => {
    expect(
      seatAllowsCapability(bundle() as never, null, 'usr_anon_0000000001', 'mcp', { now }),
    ).toBe(false);
  });
});
