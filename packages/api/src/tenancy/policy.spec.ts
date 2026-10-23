import { applyTenantSeatToUser, canUseTenantSeatCapability, loadUserSeatPolicy } from './policy';

describe('tenant seat authorization policy', () => {
  const familyChild = {
    tenantId: 'tenant-a',
    seatAlias: 'opaque-seat-00000001',
    accountType: 'family',
    profileType: 'child' as const,
    allowedModes: ['Chat', 'Study'] as ('Chat' | 'Study' | 'Work' | 'Privacy')[],
    capabilities: [],
    localPrivacyEnabled: false,
  };

  it('resolves seat policy only from authenticated user identity, not request headers', async () => {
    const readSeat = jest.fn().mockResolvedValue(familyChild);
    await expect(
      loadUserSeatPolicy(
        { tenantId: 'tenant-a', satchidaSeatAlias: 'opaque-seat-00000001' },
        readSeat,
      ),
    ).resolves.toEqual(familyChild);
    await expect(
      loadUserSeatPolicy(
        { tenantId: 'tenant-b', satchidaSeatAlias: 'opaque-seat-00000001' },
        readSeat,
      ),
    ).resolves.toBeUndefined();
    await expect(
      loadUserSeatPolicy({ tenantId: 'tenant-a', satchidaSeatAlias: 'seat-from-header' }, readSeat),
    ).resolves.toBeUndefined();
  });

  it('maps trusted child policy to minor profile and attaches credentials only to the server request user', () => {
    const user = {
      tenantId: 'tenant-a',
      accountType: 'pro',
      familyRole: 'adult',
      satchidaSeatAlias: 'opaque-seat-00000001',
    };
    const bound = applyTenantSeatToUser(user, familyChild, {
      cloudSeatToken: 'tk-cloud',
      privacyAssertion: 'signed-local-assertion',
    });
    expect(bound).toMatchObject({
      accountType: 'family',
      familyRole: 'minor',
      satchidaSeatAlias: 'opaque-seat-00000001',
      seatToken: 'tk-cloud',
      privacyAssertion: 'signed-local-assertion',
    });
  });

  it('enforces the Family and child Work-tool floor independently of the UI', () => {
    expect(canUseTenantSeatCapability(familyChild, 'mcp')).toBe(false);
    expect(canUseTenantSeatCapability({ ...familyChild, profileType: 'adult' }, 'work_tools')).toBe(
      false,
    );
    expect(
      canUseTenantSeatCapability(
        { ...familyChild, accountType: 'pro', profileType: 'adult', capabilities: ['mcp'] },
        'mcp',
      ),
    ).toBe(true);
    expect(
      canUseTenantSeatCapability(
        { ...familyChild, accountType: 'pro', profileType: 'child', capabilities: ['mcp'] },
        'mcp',
      ),
    ).toBe(false);
  });
});
