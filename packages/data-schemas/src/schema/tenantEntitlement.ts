import { Schema } from 'mongoose';
import type { ITenantEntitlement } from '~/types';
import {
  TENANT_ACCOUNT_TYPES,
  TENANT_ENTITLEMENT_STATUSES,
  TENANT_PLAN_TYPES,
} from '~/types/entitlement';

const tenantEntitlementSchema: Schema<ITenantEntitlement> = new Schema<ITenantEntitlement>(
  {
    tenantId: { type: String, required: true, trim: true, index: true, unique: true },
    plan: { type: String, enum: TENANT_PLAN_TYPES, required: true },
    status: { type: String, enum: TENANT_ENTITLEMENT_STATUSES, required: true, default: 'active' },
    seatLimit: { type: Number, min: 0, max: 100_000, required: true },
    accountTypes: {
      type: Schema.Types.Mixed,
      required: true,
      default: () => ({}),
      validate: {
        validator(value: Record<string, unknown>) {
          return Object.entries(value ?? {}).every(([key, raw]) => {
            if (
              !TENANT_ACCOUNT_TYPES.includes(key as (typeof TENANT_ACCOUNT_TYPES)[number]) ||
              !raw ||
              typeof raw !== 'object'
            )
              return false;
            const allocation = raw as {
              allowedCapabilities?: unknown;
              localPrivacyEnabled?: unknown;
              allowedModes?: unknown;
            };
            if (
              key === 'family' &&
              Array.isArray(allocation.allowedModes) &&
              allocation.allowedModes.some((mode) => String(mode).toLowerCase() === 'work')
            )
              return false;
            return (
              (allocation.allowedCapabilities == null ||
                (Array.isArray(allocation.allowedCapabilities) &&
                  allocation.allowedCapabilities.every((capability) =>
                    ['work_tools', 'mcp', 'agents', 'code_execution'].includes(String(capability)),
                  ) &&
                  key !== 'family')) &&
              (allocation.localPrivacyEnabled == null ||
                typeof allocation.localPrivacyEnabled === 'boolean')
            );
          });
        },
        message: 'Unsupported tenant account type',
      },
    },
    seatAssignments: {
      type: Schema.Types.Mixed,
      required: true,
      default: () => ({}),
      validate: {
        validator(value: Record<string, unknown>) {
          return Object.entries(value ?? {}).every(
            ([subjectKey, accountType]) =>
              /^[A-Za-z0-9_-]{16,128}$/.test(subjectKey) &&
              TENANT_ACCOUNT_TYPES.includes(accountType as (typeof TENANT_ACCOUNT_TYPES)[number]),
          );
        },
        message: 'Invalid opaque seat assignment',
      },
    },
    startsAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    updatedBy: { type: String, trim: true, maxlength: 256 },
  },
  { timestamps: true },
);

tenantEntitlementSchema.index({ status: 1, expiresAt: 1 });

export default tenantEntitlementSchema;
