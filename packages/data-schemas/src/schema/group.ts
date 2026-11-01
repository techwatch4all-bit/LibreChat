import { Schema } from 'mongoose';
import type { IGroup } from '~/types';
import { TENANT_ACCOUNT_TYPES } from '~/types/entitlement';

const groupSchema: Schema<IGroup> = new Schema<IGroup>(
  {
    name: {
      type: String,
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: false,
    },
    email: {
      type: String,
      required: false,
      index: true,
    },
    avatar: {
      type: String,
      required: false,
    },
    memberIds: [
      {
        type: String,
        required: false,
      },
    ],
    source: {
      type: String,
      enum: ['local', 'entra'],
      default: 'local',
    },
    /** External ID (e.g., Entra ID) */
    idOnTheSource: {
      type: String,
      sparse: true,
      index: true,
      required: function (this: IGroup) {
        return this.source !== 'local';
      },
    },
    tenantId: {
      type: String,
      index: true,
    },

    /**
     * The commercial account type every member of this group holds.
     *
     * It mirrors the One-API group of the same name so the tenant's admin panel
     * shows the same entitlement the operator's policy will enforce.
     */
    accountType: {
      type: String,
      enum: TENANT_ACCOUNT_TYPES,
      default: null,
      index: true,
    },

    /**
     * Whether members pool their usage onto one shared allowance.
     *
     * A Family group pools: parents and children share one seat budget. An
     * Enterprise group does not, because each seat is billed separately.
     */
    shared: {
      type: Boolean,
      default: false,
    },

    /**
     * The Family seat model: two adults and at most two children.
     *
     * The children exist so a parent can supervise what a minor sends and
     * receives, and so Study can be shared between a parent and a child.
     */
    familySeats: {
      type: {
        maxAdults: { type: Number, min: 0, max: 2, default: 2 },
        maxChildren: { type: Number, min: 0, max: 2, default: 2 },
      },
      default: undefined,
    },

    /**
     * Whether the group's members may use the local Privacy mode.
     *
     * Privacy is a local product and a separate entitlement from the account
     * type, so it is recorded here rather than inferred.
     */
    localPrivacyEnabled: {
      type: Boolean,
      default: false,
    },

    /** Privileged capabilities the group's members hold. */
    allowedCapabilities: {
      type: [String],
      default: undefined,
    },

    /**
     * The modes the group's members may use.
     *
     * Empty means the operator's One-API group decides. A non-empty list is a
     * further narrowing, never a widening.
     */
    allowedModes: {
      type: [String],
      default: undefined,
    },

    /**
     * AnythingLLM Knowledge Vault slugs assigned to this group.
     * Members of this group are permitted to query, search, and contribute to these vaults.
     */
    assignedKnowledgeVaults: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true },
);

groupSchema.index(
  { idOnTheSource: 1, source: 1, tenantId: 1 },
  {
    unique: true,
    partialFilterExpression: { idOnTheSource: { $exists: true } },
  },
);
groupSchema.index({ memberIds: 1, tenantId: 1 });

export default groupSchema;
