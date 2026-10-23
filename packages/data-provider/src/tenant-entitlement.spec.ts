import type { TenantEntitlement } from './tenant-entitlement';
import {
  INITIAL_FAMILY_SEAT_LIMIT,
  PRIVACY_ELIGIBLE_ACCOUNT_TYPES,
  TENANT_ACCOUNT_TYPES,
  resolveEntitledModes,
  tenantSeatCanUseCapability,
  authorizeSeatMode,
  normalizeSemanticMode,
  tenantEntitlementSchema,
} from './tenant-entitlement';

const entitlement = (overrides: Partial<TenantEntitlement> = {}): TenantEntitlement => ({
  tenantId: 'school-1',
  plan: 'pro',
  status: 'active',
  seatLimit: 10,
  seatAssignments: { 'opaque-subject-0001': 'pro' },
  accountTypes: {
    pro: {
      seatLimit: 10,
      allowedModes: ['Chat', 'Work', 'Privacy'],
    },
  },
  ...overrides,
});

describe('tenant entitlement schema', () => {
  it('accepts explicitly allocated seat/mode policy', () => {
    expect(tenantEntitlementSchema.safeParse(entitlement()).success).toBe(true);
  });

  it('rejects tenant seat assignments above tenant capacity', () => {
    const result = tenantEntitlementSchema.safeParse(
      entitlement({ seatLimit: 0, seatAssignments: { 'opaque-subject-0001': 'pro' } }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects account allocation above the tenant seat cap', () => {
    const result = tenantEntitlementSchema.safeParse(
      entitlement({
        seatLimit: 4,
        accountTypes: {
          family: { seatLimit: 5, allowedModes: ['Chat'] },
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  it('keeps Family seat count editable with an initial four-seat default', () => {
    expect(INITIAL_FAMILY_SEAT_LIMIT).toBe(4);
    expect(
      tenantEntitlementSchema.safeParse(
        entitlement({
          plan: 'family',
          seatLimit: INITIAL_FAMILY_SEAT_LIMIT,
          seatAssignments: {},
          accountTypes: {
            family: {
              seatLimit: INITIAL_FAMILY_SEAT_LIMIT,
              allowedModes: ['Chat', 'Work'],
            },
          },
        }),
      ).success,
    ).toBe(true);
  });

  it('rejects unknown and Family-disallowed tool capability grants', () => {
    expect(
      tenantEntitlementSchema.safeParse(
        entitlement({
          accountTypes: {
            family: { seatLimit: 4, allowedModes: ['Chat', 'Study'], allowedCapabilities: ['mcp'] },
          },
        }),
      ).success,
    ).toBe(false);
    expect(
      tenantEntitlementSchema.safeParse(
        entitlement({
          accountTypes: {
            pro: { seatLimit: 4, allowedModes: ['Chat'], allowedCapabilities: ['shell'] as never },
          },
        }),
      ).success,
    ).toBe(false);
  });
});

describe('resolveEntitledModes', () => {
  const now = new Date('2026-10-06T00:00:00.000Z');

  it.each(PRIVACY_ELIGIBLE_ACCOUNT_TYPES)(
    'retains Privacy for eligible %s accounts only when the local model is healthy',
    (accountType) => {
      const value = entitlement({
        // The plan and the account type are different axes: a tenant's plan is
        // the contract, the account type is what a seat holds within it.
        plan: 'enterprise',
        seatAssignments: { 'opaque-subject-0001': accountType },
        accountTypes: {
          [accountType]: {
            seatLimit: 2,
            allowedModes: ['Chat', 'Privacy'],
            localPrivacyEnabled: true,
          },
        },
      });
      expect(
        resolveEntitledModes(value, accountType, {
          now,
          localModelHealthy: true,
          childAccount: false,
          childSafetyReady: false,
        }),
      ).toEqual({ allowed: true, modes: ['Chat', 'Privacy'], capabilities: [] });
      expect(
        resolveEntitledModes(value, accountType, {
          now,
          localModelHealthy: false,
          childAccount: false,
          childSafetyReady: false,
        }),
      ).toEqual({ allowed: true, modes: ['Chat'], capabilities: [] });
    },
  );

  it.each(['basic', 'standard', 'family'] as const)(
    'never makes Privacy available to %s accounts',
    (accountType) => {
      const value = entitlement({
        plan: accountType,
        seatAssignments: { 'opaque-subject-0001': accountType },
        accountTypes: {
          [accountType]: { seatLimit: 2, allowedModes: ['Chat', 'Privacy'] },
        },
      });
      expect(
        resolveEntitledModes(value, accountType, {
          now,
          localModelHealthy: true,
          childAccount: false,
          childSafetyReady: false,
        }),
      ).toEqual({ allowed: true, modes: ['Chat'], capabilities: [] });
    },
  );

  it('requires an explicit Family Privacy add-on even when the local model is healthy', () => {
    const value = entitlement({
      plan: 'family',
      seatAssignments: { 'opaque-subject-0001': 'family' },
      accountTypes: { family: { seatLimit: 4, allowedModes: ['Chat', 'Study', 'Privacy'] } },
    });
    expect(
      resolveEntitledModes(value, 'family', {
        now,
        localModelHealthy: true,
        childAccount: false,
        childSafetyReady: false,
      }),
    ).toEqual({ allowed: true, modes: ['Chat', 'Study'], capabilities: [] });
  });

  it('fails closed when account type is not allocated', () => {
    expect(
      resolveEntitledModes(entitlement(), 'standard', {
        now,
        localModelHealthy: true,
        childAccount: false,
        childSafetyReady: false,
      }),
    ).toEqual({
      allowed: false,
      code: 'ACCOUNT_TYPE_NOT_ALLOCATED',
    });
  });

  it.each(['suspended', 'expired', 'revoked'] as const)(
    'fails closed for %s entitlements',
    (status) => {
      expect(
        resolveEntitledModes(entitlement({ status }), 'pro', {
          now,
          localModelHealthy: true,
          childAccount: false,
          childSafetyReady: false,
        }),
      ).toEqual({
        allowed: false,
        code: 'ENTITLEMENT_INACTIVE',
      });
    },
  );

  it('fails closed when entitlement has expired', () => {
    expect(
      resolveEntitledModes(
        entitlement({ expiresAt: new Date('2026-10-05T23:59:59.000Z') }),
        'pro',
        { now, localModelHealthy: true, childAccount: false, childSafetyReady: false },
      ),
    ).toEqual({ allowed: false, code: 'ENTITLEMENT_INACTIVE' });
  });

  it('fails closed for child accounts until safety enforcement is ready', () => {
    expect(
      resolveEntitledModes(entitlement(), 'pro', {
        now,
        localModelHealthy: true,
        childAccount: true,
        childSafetyReady: false,
      }),
    ).toEqual({ allowed: false, code: 'CHILD_SAFETY_UNAVAILABLE' });
  });

  it('keeps child mode access explicit after safety enforcement is ready', () => {
    const childEntitlement = entitlement({
      accountTypes: {
        pro: {
          seatLimit: 10,
          allowedModes: ['Chat', 'Study', 'Privacy'],
          localPrivacyEnabled: true,
        },
      },
    });
    expect(
      resolveEntitledModes(childEntitlement, 'pro', {
        now,
        localModelHealthy: true,
        childAccount: true,
        childSafetyReady: true,
      }),
    ).toEqual({ allowed: true, modes: ['Chat', 'Study', 'Privacy'], capabilities: [] });
  });

  it('denies a Family seat policy if the Family allocation includes Work', () => {
    const family = entitlement({
      plan: 'family',
      seatAssignments: { 'opaque-subject-0001': 'family' },
      accountTypes: {
        family: {
          seatLimit: 4,
          allowedModes: ['Chat', 'Study', 'Work', 'Privacy'],
          localPrivacyEnabled: true,
        },
      },
    });
    expect(
      resolveEntitledModes(family, 'family', {
        now,
        localModelHealthy: true,
        childAccount: true,
        childSafetyReady: true,
      }),
    ).toEqual({ allowed: true, modes: ['Chat', 'Study', 'Privacy'], capabilities: [] });
  });

  describe('dedicated privacy account type', () => {
    it('is a recognised account type', () => {
      expect(TENANT_ACCOUNT_TYPES).toContain('privacy');
    });

    it('holds Privacy as its primary entitlement', () => {
      const value = entitlement({
        plan: 'enterprise',
        seatAssignments: { 'opaque-subject-0001': 'privacy' },
        accountTypes: {
          privacy: { seatLimit: 25, allowedModes: ['Chat', 'Privacy'], localPrivacyEnabled: true },
        },
      });
      expect(
        resolveEntitledModes(value, 'privacy', {
          now,
          localModelHealthy: true,
          childAccount: false,
          childSafetyReady: true,
        }),
      ).toEqual({ allowed: true, modes: ['Chat', 'Privacy'], capabilities: [] });
    });

    it('reaches the cloud when the operator allocates it', () => {
      // The account type is the product, not a capability. A Privacy seat that
      // the operator also granted cloud modes must be able to use them.
      const value = entitlement({
        plan: 'enterprise',
        seatAssignments: { 'opaque-subject-0001': 'privacy' },
        accountTypes: {
          privacy: {
            seatLimit: 25,
            allowedModes: ['Chat', 'Work', 'Privacy'],
            allowedCapabilities: ['work_tools'],
            localPrivacyEnabled: true,
          },
        },
      });
      expect(
        resolveEntitledModes(value, 'privacy', {
          now,
          localModelHealthy: true,
          childAccount: false,
          childSafetyReady: true,
        }),
      ).toEqual({
        allowed: true,
        modes: ['Chat', 'Work', 'Privacy'],
        capabilities: ['work_tools'],
      });
    });

    it('does not hold cloud tooling by virtue of its type alone', () => {
      // The type is a local product. Cloud tooling must be granted explicitly,
      // so a Privacy seat cannot acquire it from the type alone.
      expect(tenantSeatCanUseCapability('privacy', 'adult', 'work_tools')).toBe(false);
    });

    it('never holds Privacy without the explicit local add-on', () => {
      const value = entitlement({
        plan: 'enterprise',
        seatAssignments: { 'opaque-subject-0001': 'privacy' },
        accountTypes: {
          privacy: { seatLimit: 25, allowedModes: ['Chat', 'Privacy'] },
        },
      });
      const decision = resolveEntitledModes(value, 'privacy', {
        now,
        localModelHealthy: true,
        childAccount: false,
        childSafetyReady: true,
      });
      expect(decision.allowed).toBe(true);
      expect(decision.allowed && decision.modes).toEqual(['Chat']);
    });
  });

  it('allows a Family child seat Chat and Study when the server allocation excludes Work', () => {
    const family = entitlement({
      plan: 'family',
      seatAssignments: { 'opaque-subject-0001': 'family' },
      accountTypes: { family: { seatLimit: 4, allowedModes: ['Chat', 'Study'] } },
    });
    expect(
      resolveEntitledModes(family, 'family', {
        now,
        localModelHealthy: false,
        childAccount: true,
        childSafetyReady: true,
      }),
    ).toEqual({ allowed: true, modes: ['Chat', 'Study'], capabilities: [] });
  });

  it('keeps Family adult Work but removes Privacy unless an explicit local add-on is enabled', () => {
    const family = entitlement({
      plan: 'family',
      seatAssignments: { 'opaque-subject-0001': 'family' },
      accountTypes: {
        family: { seatLimit: 4, allowedModes: ['Chat', 'Study', 'Work', 'Privacy'] },
      },
    });
    expect(
      resolveEntitledModes(family, 'family', {
        now,
        localModelHealthy: true,
        childAccount: false,
        childSafetyReady: false,
      }),
    ).toEqual({ allowed: true, modes: ['Chat', 'Study', 'Work'], capabilities: [] });
  });

  it('requires the explicit local Privacy entitlement as well as a healthy local model', () => {
    const value = entitlement({
      accountTypes: { pro: { seatLimit: 2, allowedModes: ['Chat', 'Privacy'] } },
    });
    expect(
      resolveEntitledModes(value, 'pro', {
        now,
        localModelHealthy: true,
        childAccount: false,
        childSafetyReady: false,
      }),
    ).toEqual({ allowed: true, modes: ['Chat'], capabilities: [] });
  });
});

describe('tenant-seat capability floor', () => {
  it('allows Pro adults but denies Family adults and every child profile all Work tools', () => {
    expect(tenantSeatCanUseCapability('pro', 'adult', 'mcp')).toBe(true);
    expect(tenantSeatCanUseCapability('pro', 'adult', 'code_execution')).toBe(true);
    expect(tenantSeatCanUseCapability('family', 'adult', 'work_tools')).toBe(false);
    expect(tenantSeatCanUseCapability('pro', 'minor', 'mcp')).toBe(false);
    expect(tenantSeatCanUseCapability('enterprise', 'child', 'agents')).toBe(false);
  });

  it('denies unauthorized modes, Family tool bundles, child Work, unsafe child turns and unhealthy local Privacy', () => {
    const base = {
      allowedModes: ['Chat', 'Study', 'Work'] as const,
      localModelHealthy: true,
      childSafetyReady: true,
    };
    expect(
      authorizeSeatMode({ ...base, mode: 'Work', accountType: 'family', familyRole: 'adult' }),
    ).toEqual({ allowed: true, mode: 'Work' });
    expect(
      authorizeSeatMode({
        ...base,
        mode: 'Work',
        accountType: 'family',
        familyRole: 'adult',
        requestsWorkTools: true,
        allowedCapabilities: ['mcp'],
      }),
    ).toEqual({ allowed: false, code: 'WORK_TOOL_CAPABILITY_REQUIRED' });
    expect(
      authorizeSeatMode({
        ...base,
        mode: 'Work',
        accountType: 'family',
        familyRole: 'adult',
        requestsWorkTools: true,
        allowedCapabilities: ['mcp'],
      }),
    ).toEqual({ allowed: false, code: 'WORK_TOOL_CAPABILITY_REQUIRED' });
    expect(
      authorizeSeatMode({ ...base, mode: 'Work', accountType: 'family', familyRole: 'minor' }),
    ).toEqual({ allowed: false, code: 'MODE_NOT_ENTITLED' });
    expect(
      authorizeSeatMode({
        ...base,
        mode: 'Study',
        accountType: 'family',
        familyRole: 'minor',
        childSafetyReady: false,
      }),
    ).toEqual({ allowed: false, code: 'CHILD_SAFETY_UNAVAILABLE' });
    expect(
      authorizeSeatMode({
        ...base,
        mode: 'Privacy',
        accountType: 'pro',
        familyRole: 'adult',
        allowedModes: ['Chat', 'Privacy'],
        localModelHealthy: false,
      }),
    ).toEqual({ allowed: false, code: 'LOCAL_PRIVACY_UNAVAILABLE' });
  });

  it('normalizes UI and protocol aliases to semantic modes', () => {
    expect(normalizeSemanticMode('Study')).toBe('Study');
    expect(normalizeSemanticMode('vibe_coding')).toBe('Work');
    expect(normalizeSemanticMode('VibeCoder')).toBe('Work');
    expect(normalizeSemanticMode('provider/model-name')).toBeUndefined();
  });
});
