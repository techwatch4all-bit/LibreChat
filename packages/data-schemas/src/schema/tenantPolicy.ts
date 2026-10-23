import { Schema } from 'mongoose';
import type { ITenantPolicy } from '~/types';

const modeSchema = new Schema(
  {
    skill: { type: String, enum: ['allow', 'deny'] },
    mcp: { type: String, enum: ['allow', 'deny'] },
    agent: { type: String, enum: ['allow', 'deny'] },
  },
  { _id: false },
);

const nameMapSchema = new Schema(
  {
    skill: { type: Map, of: String, default: undefined },
    mcp: { type: Map, of: String, default: undefined },
    agent: { type: Map, of: String, default: undefined },
  },
  { _id: false },
);

const blockedSchema = new Schema(
  {
    skill: { type: [String], default: undefined },
    mcp: { type: [String], default: undefined },
    agent: { type: [String], default: undefined },
  },
  { _id: false },
);

/**
 * One document per tenant. `tenantId` is unique: a tenant either has a policy or
 * it does not, and two documents for the same tenant would make "which rule won"
 * depend on read order.
 */
const tenantPolicySchema: Schema<ITenantPolicy> = new Schema<ITenantPolicy>(
  {
    tenantId: {
      type: String,
      required: true,
      trim: true,
      index: true,
      unique: true,
    },
    rules: { type: nameMapSchema, default: undefined },
    defaultModes: { type: modeSchema, default: undefined },
    platformBlocked: { type: blockedSchema, default: undefined },
    /** Kill switch: false hides every extension from the tenant. */
    extensionsEnabled: { type: Boolean, default: true },
    updatedBy: { type: String, trim: true },
  },
  { timestamps: true },
);

export default tenantPolicySchema;
