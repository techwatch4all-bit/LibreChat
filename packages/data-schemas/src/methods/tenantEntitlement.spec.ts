import { createTenantEntitlementMethods } from './tenantEntitlement';

const familyEntitlement = (assignments: Record<string, 'family' | 'pro'> = {}) => ({
  _id: { toString: () => 'entitlement-1' },
  tenantId: 'tenant-a',
  plan: 'family' as const,
  status: 'active' as const,
  seatLimit: 4,
  accountTypes: {
    family: { seatLimit: 4, allowedModes: ['Chat'] as const },
  },
  seatAssignments: assignments,
});

function makeModel() {
  const findOneAndUpdate = jest.fn();
  const updateOne = jest.fn();
  const findOne = jest.fn();
  const find = jest.fn();
  return {
    findOneAndUpdate,
    updateOne,
    findOne,
    find,
    model: () => ({ findOneAndUpdate, updateOne, findOne, find }),
  };
}

const queryResult = <T>(value: T) => ({ lean: () => ({ exec: async () => value }) });

describe('tenant entitlement methods', () => {
  it('reserves an opaque tenant-local subject and returns only a safe summary', async () => {
    const mocks = makeModel();
    const subjectKey = 'opaque-subject-0001';
    mocks.findOne.mockReturnValue(queryResult(familyEntitlement()));
    mocks.findOneAndUpdate.mockReturnValue(
      queryResult(familyEntitlement({ [subjectKey]: 'family' })),
    );
    const methods = createTenantEntitlementMethods({
      models: { TenantEntitlement: mocks.model() },
    } as never);

    const result = await methods.reserveTenantSeat('tenant-a', subjectKey, 'family');

    expect(result).toEqual({
      ok: true,
      summary: expect.objectContaining({
        tenantId: 'tenant-a',
        activeSeats: 1,
        accountTypes: expect.objectContaining({
          family: expect.objectContaining({ activeSeats: 1 }),
        }),
      }),
    });
    expect(JSON.stringify(result)).not.toContain(subjectKey);
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        seatLimit: 4,
        'seatAssignments.opaque-subject-0001': { $exists: false },
        $expr: expect.any(Object),
      }),
      { $set: { 'seatAssignments.opaque-subject-0001': 'family' } },
      { new: true, runValidators: true },
    );
  });

  it('is idempotent for an existing subject and hides every assignment key', async () => {
    const mocks = makeModel();
    const ownKey = 'opaque-subject-0001';
    const otherKey = 'opaque-subject-0002';
    mocks.findOne.mockReturnValue(
      queryResult(familyEntitlement({ [ownKey]: 'family', [otherKey]: 'family' })),
    );
    const methods = createTenantEntitlementMethods({
      models: { TenantEntitlement: mocks.model() },
    } as never);

    const result = await methods.reserveTenantSeat('tenant-a', ownKey, 'family');

    expect(result).toEqual({ ok: true, summary: expect.objectContaining({ activeSeats: 2 }) });
    expect(JSON.stringify(result)).not.toContain(ownKey);
    expect(JSON.stringify(result)).not.toContain(otherKey);
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('is idempotent when a concurrent reservation assigns the same subject', async () => {
    const mocks = makeModel();
    const subjectKey = 'opaque-subject-0001';
    mocks.findOne
      .mockReturnValueOnce(queryResult(familyEntitlement()))
      .mockReturnValueOnce(queryResult(familyEntitlement({ [subjectKey]: 'family' })));
    mocks.findOneAndUpdate.mockReturnValue(queryResult(null));
    const methods = createTenantEntitlementMethods({
      models: { TenantEntitlement: mocks.model() },
    } as never);

    const result = await methods.reserveTenantSeat('tenant-a', subjectKey, 'family');

    expect(result).toEqual({ ok: true, summary: expect.objectContaining({ activeSeats: 1 }) });
    expect(JSON.stringify(result)).not.toContain(subjectKey);
    expect(mocks.findOne).toHaveBeenCalledTimes(2);
  });

  it('rejects changing account type on an existing subject assignment', async () => {
    const mocks = makeModel();
    mocks.findOne.mockReturnValue(
      queryResult(familyEntitlement({ 'opaque-subject-0001': 'family' })),
    );
    const methods = createTenantEntitlementMethods({
      models: { TenantEntitlement: mocks.model() },
    } as never);

    await expect(
      methods.reserveTenantSeat('tenant-a', 'opaque-subject-0001', 'pro'),
    ).resolves.toEqual({
      ok: false,
      code: 'ACCOUNT_TYPE_NOT_ALLOCATED',
    });
  });

  it('releases one opaque subject assignment exactly once', async () => {
    const mocks = makeModel();
    mocks.updateOne.mockReturnValue({ exec: async () => ({ modifiedCount: 1 }) });
    const methods = createTenantEntitlementMethods({
      models: { TenantEntitlement: mocks.model() },
    } as never);

    await expect(methods.releaseTenantSeat('tenant-a', 'opaque-subject-0001')).resolves.toBe(true);
    expect(mocks.updateOne).toHaveBeenCalledWith(
      { tenantId: 'tenant-a', 'seatAssignments.opaque-subject-0001': { $exists: true } },
      { $unset: { 'seatAssignments.opaque-subject-0001': '' } },
    );
  });

  it('does not release a subject that has no allocation', async () => {
    const mocks = makeModel();
    mocks.updateOne.mockReturnValue({ exec: async () => ({ modifiedCount: 0 }) });
    const methods = createTenantEntitlementMethods({
      models: { TenantEntitlement: mocks.model() },
    } as never);

    await expect(methods.releaseTenantSeat('tenant-a', 'opaque-subject-0001')).resolves.toBe(false);
  });

  it('fails closed when an account type has no allocation', async () => {
    const mocks = makeModel();
    mocks.findOne.mockReturnValue(queryResult({ ...familyEntitlement(), accountTypes: {} }));
    const methods = createTenantEntitlementMethods({
      models: { TenantEntitlement: mocks.model() },
    } as never);

    await expect(
      methods.reserveTenantSeat('tenant-a', 'opaque-subject-0001', 'family'),
    ).resolves.toEqual({
      ok: false,
      code: 'ACCOUNT_TYPE_NOT_ALLOCATED',
    });
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
