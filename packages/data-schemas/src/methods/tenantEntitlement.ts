import type { Model } from 'mongoose';
import type {
  ITenantEntitlement,
  LocalEntitlementView,
  TenantAccountType,
  TenantEntitlementSummary,
  TenantEntitlementUpdate,
} from '~/types';
import {
  isSemanticMode,
  isTenantAccountType,
  isTenantPlanType,
  summarizeTenantEntitlement,
} from '~/types/entitlement';

const OPAQUE_SUBJECT_KEY = /^[A-Za-z0-9_-]{16,128}$/;
const VALID_STATUSES = new Set(['active', 'suspended', 'expired', 'revoked']);

export type EntitlementSeatReservation =
  | { ok: true; summary: TenantEntitlementSummary }
  | {
      ok: false;
      code:
        | 'ENTITLEMENT_MISSING'
        | 'ENTITLEMENT_INACTIVE'
        | 'ACCOUNT_TYPE_NOT_ALLOCATED'
        | 'SEAT_CAP_REACHED';
    };

export type TenantEntitlementMethods = {
  getTenantEntitlement: (tenantId: string) => Promise<TenantEntitlementSummary | undefined>;
  getTenantEntitlementForLocalUser: (
    tenantId: string,
    subjectKey: string,
  ) => Promise<LocalEntitlementView | undefined>;
  getAssignedAccountType: (
    tenantId: string,
    subjectKey: string,
  ) => Promise<TenantAccountType | undefined>;
  setTenantEntitlement: (
    tenantId: string,
    update: TenantEntitlementUpdate,
    updatedBy?: string,
  ) => Promise<TenantEntitlementSummary>;
  reserveTenantSeat: (
    tenantId: string,
    subjectKey: string,
    accountType: TenantAccountType,
  ) => Promise<EntitlementSeatReservation>;
  releaseTenantSeat: (tenantId: string, subjectKey: string) => Promise<boolean>;
  listTenantEntitlements: () => Promise<TenantEntitlementSummary[]>;
};

function validateStoredEntitlement(value: ITenantEntitlement): void {
  if (
    typeof value.tenantId !== 'string' ||
    !value.tenantId.trim() ||
    !isTenantPlanType(value.plan) ||
    !VALID_STATUSES.has(value.status) ||
    !Number.isSafeInteger(value.seatLimit) ||
    value.seatLimit < 0 ||
    value.accountTypes == null ||
    typeof value.accountTypes !== 'object' ||
    value.seatAssignments == null ||
    typeof value.seatAssignments !== 'object'
  )
    throw new Error('Stored tenant entitlement is invalid');

  let allocatedSeats = 0;
  const assignedCounts: Partial<Record<TenantAccountType, number>> = {};
  for (const [accountType, allocation] of Object.entries(value.accountTypes)) {
    if (
      !isTenantAccountType(accountType) ||
      allocation == null ||
      !Number.isSafeInteger(allocation.seatLimit) ||
      allocation.seatLimit < 0 ||
      !Array.isArray(allocation.allowedModes) ||
      !allocation.allowedModes.every(isSemanticMode) ||
      (allocation.allowedCapabilities != null &&
        (!Array.isArray(allocation.allowedCapabilities) ||
          !allocation.allowedCapabilities.every((capability) =>
            ['work_tools', 'mcp', 'agents', 'code_execution'].includes(capability),
          ))) ||
      (allocation.localPrivacyEnabled != null &&
        typeof allocation.localPrivacyEnabled !== 'boolean')
    )
      throw new Error('Stored tenant entitlement is invalid');
    if (
      accountType === 'family' &&
      (allocation.allowedModes.includes('Work') || allocation.allowedCapabilities?.length)
    ) {
      throw new Error('Stored Family entitlement must not include Work or Work tool capabilities');
    }
    allocatedSeats += allocation.seatLimit;
  }
  for (const [subjectKey, accountType] of Object.entries(value.seatAssignments)) {
    if (!OPAQUE_SUBJECT_KEY.test(subjectKey) || !isTenantAccountType(accountType)) {
      throw new Error('Stored tenant entitlement is invalid');
    }
    assignedCounts[accountType] = (assignedCounts[accountType] ?? 0) + 1;
  }
  if (
    allocatedSeats > value.seatLimit ||
    Object.keys(value.seatAssignments).length > value.seatLimit
  ) {
    throw new Error('Stored tenant entitlement is invalid');
  }
  for (const [accountType, count] of Object.entries(assignedCounts)) {
    const allocation = value.accountTypes[accountType];
    if (allocation == null || count > allocation.seatLimit)
      throw new Error('Stored tenant entitlement is invalid');
  }
  if (value.startsAt && value.expiresAt && value.expiresAt <= value.startsAt) {
    throw new Error('Stored tenant entitlement is invalid');
  }
}

/** Tenant-scoped persistence. Subject assignments never leave tenant-local methods. */
export function createTenantEntitlementMethods(
  mongoose: typeof import('mongoose'),
): TenantEntitlementMethods {
  const model = () => mongoose.models.TenantEntitlement as Model<ITenantEntitlement>;

  async function getInternal(tenantId: string): Promise<ITenantEntitlement | undefined> {
    if (!tenantId) return undefined;
    const record = await model().findOne({ tenantId }).lean<ITenantEntitlement | null>().exec();
    if (record == null) return undefined;
    validateStoredEntitlement(record);
    return record;
  }

  async function getTenantEntitlement(
    tenantId: string,
  ): Promise<TenantEntitlementSummary | undefined> {
    const record = await getInternal(tenantId);
    return record == null ? undefined : summarizeTenantEntitlement(record);
  }

  async function getTenantEntitlementForLocalUser(
    tenantId: string,
    subjectKey: string,
  ): Promise<LocalEntitlementView | undefined> {
    if (!OPAQUE_SUBJECT_KEY.test(subjectKey)) return undefined;
    const record = await getInternal(tenantId);
    const accountType = record?.seatAssignments[subjectKey];
    return record == null || accountType == null
      ? undefined
      : { ...summarizeTenantEntitlement(record), accountType };
  }

  async function getAssignedAccountType(
    tenantId: string,
    subjectKey: string,
  ): Promise<TenantAccountType | undefined> {
    if (!tenantId || !OPAQUE_SUBJECT_KEY.test(subjectKey)) return undefined;
    const record = await model()
      .findOne({ tenantId })
      .select('seatAssignments')
      .lean<ITenantEntitlement | null>()
      .exec();
    const accountType = record?.seatAssignments?.[subjectKey];
    return isTenantAccountType(accountType) ? accountType : undefined;
  }

  async function setTenantEntitlement(
    tenantId: string,
    update: TenantEntitlementUpdate,
    updatedBy?: string,
  ): Promise<TenantEntitlementSummary> {
    const normalizedTenantId = tenantId.trim();
    if (!normalizedTenantId) throw new Error('Tenant entitlement tenantId is required');
    if (!isTenantPlanType(update.plan) || !VALID_STATUSES.has(update.status))
      throw new Error('Tenant entitlement plan/status is invalid');
    let allocatedSeats = 0;
    for (const [accountType, allocation] of Object.entries(update.accountTypes)) {
      if (
        !isTenantAccountType(accountType) ||
        !Number.isSafeInteger(allocation.seatLimit) ||
        allocation.seatLimit < 0 ||
        !Array.isArray(allocation.allowedModes) ||
        !allocation.allowedModes.every(isSemanticMode) ||
        (allocation.allowedCapabilities != null &&
          (!Array.isArray(allocation.allowedCapabilities) ||
            !allocation.allowedCapabilities.every((capability) =>
              ['work_tools', 'mcp', 'agents', 'code_execution'].includes(capability),
            ))) ||
        (allocation.localPrivacyEnabled != null &&
          typeof allocation.localPrivacyEnabled !== 'boolean')
      ) {
        throw new Error('Tenant entitlement contains an invalid account allocation');
      }
      if (
        accountType === 'family' &&
        (allocation.allowedModes.includes('Work') || allocation.allowedCapabilities?.length)
      ) {
        throw new Error('Family allocation must not include Work or Work tool capabilities');
      }
      allocatedSeats += allocation.seatLimit;
    }
    if (allocatedSeats > update.seatLimit)
      throw new Error('Account-type allocations exceed tenant seat limit');
    if (update.startsAt && update.expiresAt && update.expiresAt <= update.startsAt)
      throw new Error('Tenant entitlement expiry must be after its start');

    const existing = await getInternal(normalizedTenantId);
    const assignments = existing?.seatAssignments ?? {};
    const assignmentCounts: Partial<Record<TenantAccountType, number>> = {};
    for (const assignedType of Object.values(assignments)) {
      assignmentCounts[assignedType] = (assignmentCounts[assignedType] ?? 0) + 1;
      const allocation = update.accountTypes[assignedType];
      if (allocation == null) throw new Error('Cannot remove an account type with assigned seats');
    }
    if (Object.keys(assignments).length > update.seatLimit)
      throw new Error('Tenant seat limit cannot be lower than assigned seats');
    for (const [accountType, count] of Object.entries(assignmentCounts)) {
      if (count > update.accountTypes[accountType].seatLimit)
        throw new Error('Account-type seat limit cannot be lower than assigned seats');
    }

    const filter =
      existing == null
        ? { tenantId: normalizedTenantId, seatAssignments: { $exists: false } }
        : { tenantId: normalizedTenantId, seatAssignments: assignments };
    const record = await model()
      .findOneAndUpdate(
        filter,
        { $set: { ...update, seatAssignments: assignments, ...(updatedBy ? { updatedBy } : {}) } },
        { upsert: existing == null, new: true, runValidators: true, setDefaultsOnInsert: true },
      )
      .lean<ITenantEntitlement | null>()
      .exec();
    if (record == null)
      throw new Error('Tenant entitlement policy update raced with a seat change; retry');
    validateStoredEntitlement(record);
    return summarizeTenantEntitlement(record);
  }

  async function reserveTenantSeat(
    tenantId: string,
    subjectKey: string,
    accountType: TenantAccountType,
  ): Promise<EntitlementSeatReservation> {
    const normalizedTenantId = tenantId.trim();
    const normalizedSubjectKey = subjectKey.trim();
    if (!normalizedTenantId) return { ok: false, code: 'ENTITLEMENT_MISSING' };
    if (!OPAQUE_SUBJECT_KEY.test(normalizedSubjectKey))
      return { ok: false, code: 'ACCOUNT_TYPE_NOT_ALLOCATED' };
    const record = await getInternal(normalizedTenantId);
    if (record == null) return { ok: false, code: 'ENTITLEMENT_MISSING' };
    const now = new Date();
    if (
      record.status !== 'active' ||
      (record.startsAt != null && record.startsAt > now) ||
      (record.expiresAt != null && record.expiresAt <= now)
    )
      return { ok: false, code: 'ENTITLEMENT_INACTIVE' };
    const prior = record.seatAssignments[normalizedSubjectKey];
    if (prior != null)
      return prior === accountType
        ? { ok: true, summary: summarizeTenantEntitlement(record) }
        : { ok: false, code: 'ACCOUNT_TYPE_NOT_ALLOCATED' };
    const allocation = record.accountTypes[accountType];
    if (!allocation) return { ok: false, code: 'ACCOUNT_TYPE_NOT_ALLOCATED' };

    const assignmentPath = `seatAssignments.${normalizedSubjectKey}`;
    const nowForWrite = new Date();
    const updated = await model()
      .findOneAndUpdate(
        {
          _id: record._id,
          tenantId: normalizedTenantId,
          status: 'active',
          seatLimit: record.seatLimit,
          [`accountTypes.${accountType}.seatLimit`]: allocation.seatLimit,
          [assignmentPath]: { $exists: false },
          $expr: {
            $and: [
              {
                $lt: [
                  { $size: { $objectToArray: { $ifNull: ['$seatAssignments', {}] } } },
                  '$seatLimit',
                ],
              },
              {
                $lt: [
                  {
                    $size: {
                      $filter: {
                        input: { $objectToArray: { $ifNull: ['$seatAssignments', {}] } },
                        as: 'assignment',
                        cond: { $eq: ['$$assignment.v', accountType] },
                      },
                    },
                  },
                  `$accountTypes.${accountType}.seatLimit`,
                ],
              },
            ],
          },
          $and: [
            {
              $or: [
                { startsAt: null },
                { startsAt: { $exists: false } },
                { startsAt: { $lte: nowForWrite } },
              ],
            },
            {
              $or: [
                { expiresAt: null },
                { expiresAt: { $exists: false } },
                { expiresAt: { $gt: nowForWrite } },
              ],
            },
          ],
        },
        { $set: { [assignmentPath]: accountType } },
        { new: true, runValidators: true },
      )
      .lean<ITenantEntitlement | null>()
      .exec();
    if (updated == null) {
      const latest = await getInternal(normalizedTenantId);
      if (latest == null) return { ok: false, code: 'ENTITLEMENT_MISSING' };
      const latestNow = new Date();
      if (
        latest.status !== 'active' ||
        (latest.startsAt != null && latest.startsAt > latestNow) ||
        (latest.expiresAt != null && latest.expiresAt <= latestNow)
      ) {
        return { ok: false, code: 'ENTITLEMENT_INACTIVE' };
      }
      const latestAssignment = latest.seatAssignments[normalizedSubjectKey];
      if (latestAssignment != null) {
        return latestAssignment === accountType
          ? { ok: true, summary: summarizeTenantEntitlement(latest) }
          : { ok: false, code: 'ACCOUNT_TYPE_NOT_ALLOCATED' };
      }
      if (latest.accountTypes[accountType] == null)
        return { ok: false, code: 'ACCOUNT_TYPE_NOT_ALLOCATED' };
      return { ok: false, code: 'SEAT_CAP_REACHED' };
    }
    validateStoredEntitlement(updated);
    return { ok: true, summary: summarizeTenantEntitlement(updated) };
  }

  async function releaseTenantSeat(tenantId: string, subjectKey: string): Promise<boolean> {
    const normalizedTenantId = tenantId.trim();
    const normalizedSubjectKey = subjectKey.trim();
    if (!normalizedTenantId || !OPAQUE_SUBJECT_KEY.test(normalizedSubjectKey)) return false;
    const assignmentPath = `seatAssignments.${normalizedSubjectKey}`;
    const result = await model()
      .updateOne(
        { tenantId: normalizedTenantId, [assignmentPath]: { $exists: true } },
        { $unset: { [assignmentPath]: '' } },
      )
      .exec();
    return result.modifiedCount === 1;
  }

  async function listTenantEntitlements(): Promise<TenantEntitlementSummary[]> {
    const records = await model().find().lean<ITenantEntitlement[]>().exec();
    return records.map((record) => {
      validateStoredEntitlement(record);
      return summarizeTenantEntitlement(record);
    });
  }

  return {
    getTenantEntitlement,
    getTenantEntitlementForLocalUser,
    getAssignedAccountType,
    setTenantEntitlement,
    reserveTenantSeat,
    releaseTenantSeat,
    listTenantEntitlements,
  };
}
