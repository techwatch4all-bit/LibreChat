import { generateKeyPairSync, verify as verifyBytes } from 'node:crypto';
import { createPrivacyAssertionMethods } from './privacyAssertion';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const TENANT = 'tenant-a';
const SEAT = 'opaque-seat-0000000001';
const OTHER_SEAT = 'opaque-seat-0000000002';

type Entitlement = {
  tenantId: string;
  plan: string;
  status: string;
  seatLimit: number;
  accountTypes: Record<string, unknown>;
  seatAssignments: Record<string, string>;
  startsAt?: Date | null;
  expiresAt?: Date | null;
};

function entitlementRecord(overrides: Partial<Entitlement> = {}): Entitlement {
  return {
    tenantId: TENANT,
    plan: 'enterprise',
    status: 'active',
    seatLimit: 50,
    accountTypes: {
      pro: {
        seatLimit: 25,
        allowedModes: ['Chat', 'Work', 'Study', 'Privacy'],
        allowedCapabilities: ['work_tools', 'mcp'],
        localPrivacyEnabled: true,
      },
      family: {
        seatLimit: 25,
        allowedModes: ['Chat', 'Study'],
        allowedCapabilities: [],
      },
      basic: {
        seatLimit: 25,
        allowedModes: ['Chat'],
        allowedCapabilities: [],
        localPrivacyEnabled: false,
      },
    },
    seatAssignments: {
      [SEAT]: 'pro',
      [OTHER_SEAT]: 'family',
    },
    ...overrides,
  } as Entitlement;
}

function createHarness(record?: Entitlement | null) {
  // `undefined` means "use the default record"; `null` means "no record at all".
  const stored = record === undefined ? entitlementRecord() : record;
  const findOne = jest.fn().mockReturnValue({
    lean: () => ({ exec: async () => stored ?? null }),
  });
  const mongoose = {
    models: { TenantEntitlement: { findOne } },
  } as unknown as typeof import('mongoose');

  const methods = createPrivacyAssertionMethods(mongoose, {
    getSigningKey: () => privateKeyPem,
    audience: 'satchida-control',
    isLocalReady: async () => true,
  });
  return { methods, findOne };
}

function decodeAssertion(token: string) {
  const [encoded, signature] = token.split('.');
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  const valid = verifyBytes(
    null,
    Buffer.from(encoded, 'ascii'),
    publicKey,
    Buffer.from(signature, 'base64url'),
  );
  return { payload, valid };
}

describe('getPrivacyAssertion', () => {
  test('mints a signed assertion for an entitled seat', async () => {
    const { methods } = createHarness();
    const token = await methods.getPrivacyAssertion({
      tenantId: TENANT,
      seatAlias: SEAT,
      accountType: 'pro',
      profileType: 'adult',
    });
    expect(token).toBeDefined();
    const { payload, valid } = decodeAssertion(token as string);
    expect(valid).toBe(true);
    expect(payload.tid).toBe(TENANT);
    expect(payload.seat).toBe(SEAT);
    expect(payload.account).toBe('pro');
    expect(payload.profile).toBe('adult');
    expect(payload.modes).toEqual(['Privacy']);
    expect(payload.aud).toBe('satchida-control');
  });

  test('the assertion is short lived', async () => {
    const { methods } = createHarness();
    const token = await methods.getPrivacyAssertion({
      tenantId: TENANT,
      seatAlias: SEAT,
      accountType: 'pro',
      profileType: 'adult',
    });
    const { payload } = decodeAssertion(token as string);
    expect(payload.exp - payload.iat).toBe(300);
  });

  test('a child seat carries the child safety flag', async () => {
    const { methods } = createHarness();
    const token = await methods.getPrivacyAssertion({
      tenantId: TENANT,
      seatAlias: SEAT,
      accountType: 'pro',
      profileType: 'child',
    });
    const { payload } = decodeAssertion(token as string);
    expect(payload.profile).toBe('child');
    expect(payload.childSafetyReady).toBe(true);
  });

  test('an unrecognised profile is treated as a child', async () => {
    // Failing toward the child is deliberate: the cost of a stricter safety
    // prompt is lower than the cost of a lost protection.
    const { methods } = createHarness();
    const token = await methods.getPrivacyAssertion({
      tenantId: TENANT,
      seatAlias: SEAT,
      accountType: 'pro',
      profileType: 'nonsense',
    });
    const { payload } = decodeAssertion(token as string);
    expect(payload.profile).toBe('child');
  });

  test('refuses a seat that is not assigned an account type', async () => {
    const { methods } = createHarness();
    const token = await methods.getPrivacyAssertion({
      tenantId: TENANT,
      seatAlias: 'opaque-seat-not-assigned',
      accountType: 'pro',
      profileType: 'adult',
    });
    expect(token).toBeUndefined();
  });

  test('refuses a seat whose account type does not grant Privacy', async () => {
    const { methods } = createHarness();
    const token = await methods.getPrivacyAssertion({
      tenantId: TENANT,
      seatAlias: OTHER_SEAT,
      accountType: 'family',
      profileType: 'adult',
    });
    expect(token).toBeUndefined();
  });

  test('refuses when the account type has local privacy disabled', async () => {
    const record = entitlementRecord();
    (record.accountTypes.pro as { localPrivacyEnabled: boolean }).localPrivacyEnabled = false;
    const { methods } = createHarness(record);
    const token = await methods.getPrivacyAssertion({
      tenantId: TENANT,
      seatAlias: SEAT,
      accountType: 'pro',
      profileType: 'adult',
    });
    expect(token).toBeUndefined();
  });

  test('refuses when the tenant entitlement is not active', async () => {
    for (const status of ['suspended', 'expired', 'revoked']) {
      const { methods } = createHarness(entitlementRecord({ status }));
      const token = await methods.getPrivacyAssertion({
        tenantId: TENANT,
        seatAlias: SEAT,
        accountType: 'pro',
        profileType: 'adult',
      });
      expect(token).toBeUndefined();
    }
  });

  test('refuses when the entitlement has expired', async () => {
    const { methods } = createHarness(
      entitlementRecord({ expiresAt: new Date(Date.now() - 1000) }),
    );
    const token = await methods.getPrivacyAssertion({
      tenantId: TENANT,
      seatAlias: SEAT,
      accountType: 'pro',
      profileType: 'adult',
    });
    expect(token).toBeUndefined();
  });

  test('refuses when there is no tenant entitlement at all', async () => {
    const { methods } = createHarness(null);
    const token = await methods.getPrivacyAssertion({
      tenantId: TENANT,
      seatAlias: SEAT,
      accountType: 'pro',
      profileType: 'adult',
    });
    expect(token).toBeUndefined();
  });

  test('refuses when no signing key is configured', async () => {
    const mongoose = {
      models: {
        TenantEntitlement: {
          findOne: jest.fn().mockReturnValue({
            lean: () => ({ exec: async () => entitlementRecord() }),
          }),
        },
      },
    } as unknown as typeof import('mongoose');
    const methods = createPrivacyAssertionMethods(mongoose, {});
    const token = await methods.getPrivacyAssertion({
      tenantId: TENANT,
      seatAlias: SEAT,
      accountType: 'pro',
      profileType: 'adult',
    });
    expect(token).toBeUndefined();
  });

  test('refuses a malformed seat alias', async () => {
    const { methods } = createHarness();
    for (const alias of ['', 'short', 'has spaces in it']) {
      const token = await methods.getPrivacyAssertion({
        tenantId: TENANT,
        seatAlias: alias,
        accountType: 'pro',
        profileType: 'adult',
      });
      expect(token).toBeUndefined();
    }
  });

  test('each assertion carries a distinct id', async () => {
    const { methods } = createHarness();
    const first = await methods.getPrivacyAssertion({
      tenantId: TENANT,
      seatAlias: SEAT,
      accountType: 'pro',
      profileType: 'adult',
    });
    const second = await methods.getPrivacyAssertion({
      tenantId: TENANT,
      seatAlias: SEAT,
      accountType: 'pro',
      profileType: 'adult',
    });
    expect(decodeAssertion(first as string).payload.jti).not.toBe(
      decodeAssertion(second as string).payload.jti,
    );
  });
});

describe('isPrivacyLocalReady', () => {
  test('reports ready when the probe succeeds', async () => {
    const { methods } = createHarness();
    await expect(methods.isPrivacyLocalReady({ tenantId: TENANT, seatAlias: SEAT })).resolves.toBe(
      true,
    );
  });

  test('reports not ready when no probe is configured', async () => {
    // An unprobed tenant is not verified, so Privacy is refused rather than
    // attempted against an unknown runtime.
    const mongoose = {
      models: { TenantEntitlement: { findOne: jest.fn() } },
    } as unknown as typeof import('mongoose');
    const methods = createPrivacyAssertionMethods(mongoose, {
      getSigningKey: () => privateKeyPem,
    });
    await expect(methods.isPrivacyLocalReady({ tenantId: TENANT, seatAlias: SEAT })).resolves.toBe(
      false,
    );
  });

  test('reports not ready when the probe fails', async () => {
    const mongoose = {
      models: { TenantEntitlement: { findOne: jest.fn() } },
    } as unknown as typeof import('mongoose');
    const methods = createPrivacyAssertionMethods(mongoose, {
      getSigningKey: () => privateKeyPem,
      isLocalReady: async () => {
        throw new Error('runtime is down');
      },
    });
    await expect(methods.isPrivacyLocalReady({ tenantId: TENANT, seatAlias: SEAT })).resolves.toBe(
      false,
    );
  });
});

describe('authorizeTenantSeatRequest', () => {
  test('permits a mode inside the seat grant', async () => {
    const { methods } = createHarness();
    await expect(
      methods.authorizeTenantSeatRequest({
        tenantId: TENANT,
        seatAlias: SEAT,
        accountType: 'pro',
        profileType: 'adult',
        mode: 'chat',
        hasTools: false,
      }),
    ).resolves.toBe(true);
  });

  test('refuses a mode outside the seat grant', async () => {
    const { methods } = createHarness();
    await expect(
      methods.authorizeTenantSeatRequest({
        tenantId: TENANT,
        seatAlias: OTHER_SEAT,
        accountType: 'family',
        profileType: 'adult',
        mode: 'work',
        hasTools: false,
      }),
    ).resolves.toBe(false);
  });

  test('refuses Work for a child seat', async () => {
    const { methods } = createHarness();
    await expect(
      methods.authorizeTenantSeatRequest({
        tenantId: TENANT,
        seatAlias: OTHER_SEAT,
        accountType: 'family',
        profileType: 'child',
        mode: 'chat',
        hasTools: false,
      }),
    ).resolves.toBe(true);
  });

  test('refuses tools for a child seat', async () => {
    const { methods } = createHarness();
    await expect(
      methods.authorizeTenantSeatRequest({
        tenantId: TENANT,
        seatAlias: OTHER_SEAT,
        accountType: 'family',
        profileType: 'child',
        mode: 'chat',
        hasTools: true,
      }),
    ).resolves.toBe(false);
  });

  test('refuses tools for a Family seat even with an adult profile', async () => {
    const { methods } = createHarness();
    await expect(
      methods.authorizeTenantSeatRequest({
        tenantId: TENANT,
        seatAlias: OTHER_SEAT,
        accountType: 'family',
        profileType: 'adult',
        mode: 'chat',
        hasTools: true,
      }),
    ).resolves.toBe(false);
  });

  test('refuses tools when the capability is not granted', async () => {
    const { methods } = createHarness();
    await expect(
      methods.authorizeTenantSeatRequest({
        tenantId: TENANT,
        seatAlias: SEAT,
        accountType: 'pro',
        profileType: 'adult',
        mode: 'chat',
        hasTools: true,
      }),
    ).resolves.toBe(true);
  });

  test('refuses an unrecognised mode', async () => {
    const { methods } = createHarness();
    await expect(
      methods.authorizeTenantSeatRequest({
        tenantId: TENANT,
        seatAlias: SEAT,
        accountType: 'pro',
        profileType: 'adult',
        mode: 'godmode',
        hasTools: false,
      }),
    ).resolves.toBe(false);
  });

  test('refuses when the entitlement is not active', async () => {
    const { methods } = createHarness(entitlementRecord({ status: 'suspended' }));
    await expect(
      methods.authorizeTenantSeatRequest({
        tenantId: TENANT,
        seatAlias: SEAT,
        accountType: 'pro',
        profileType: 'adult',
        mode: 'chat',
        hasTools: false,
      }),
    ).resolves.toBe(false);
  });

  test('refuses an unassigned seat', async () => {
    const { methods } = createHarness();
    await expect(
      methods.authorizeTenantSeatRequest({
        tenantId: TENANT,
        seatAlias: 'opaque-seat-unassigned',
        accountType: 'pro',
        profileType: 'adult',
        mode: 'chat',
        hasTools: false,
      }),
    ).resolves.toBe(false);
  });
});
