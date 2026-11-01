import type { Document, Types } from 'mongoose';
import type { TenantAccountType, TenantSeatCapability } from './entitlement';
import { CursorPaginationParams } from '~/common';

/**
 * A group is one commercial product line inside a tenant.
 *
 * A group maps one-to-one onto a One-API group of the same name, so the group
 * carries the entitlement that the operator's One-API policy will enforce. The
 * names are the operator's choice; the mapping is by name within a tenant.
 */
export interface IGroup extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  email?: string;
  avatar?: string;
  /** Array of member IDs (stores idOnTheSource values, not ObjectIds) */
  memberIds?: string[];
  source: 'local' | 'entra';
  /** External ID (e.g., Entra ID) - required for non-local sources */
  idOnTheSource?: string;
  createdAt?: Date;
  updatedAt?: Date;
  tenantId?: string;

  /**
   * The commercial account type every member of this group holds.
   *
   * One-API calls the same thing a group, and it holds the mode and capability
   * allowlists. Mirroring it here means the tenant's own admin panel shows the
   * same entitlement the operator's policy will enforce, rather than a name that
   * has to be interpreted somewhere else.
   */
  accountType?: TenantAccountType;

  /**
   * Whether members of this group pool their usage onto one shared allowance.
   *
   * A Family group pools: the parents and the children share one seat budget, so
   * a child's usage draws on the family's allowance. An Enterprise group does
   * not, because each seat is billed separately.
   */
  shared?: boolean;

  /**
   * The Family seat model: two adults and at most two children.
   *
   * A Family group is four seats. The two children exist so a parent can
   * supervise what a minor sends and receives, and so Study can be shared
   * between a parent and a child. The counts are recorded on the group because
   * the shape is the product, not an accident of membership.
   */
  familySeats?: {
    maxAdults: number;
    maxChildren: number;
  };

  /**
   * Whether the group's members may use the local Privacy mode.
   *
   * Privacy is a local product and is a separate entitlement from the account
   * type, so it is recorded here rather than inferred.
   */
  localPrivacyEnabled?: boolean;

  /** Privileged capabilities the group's members hold. */
  allowedCapabilities?: TenantSeatCapability[];

  /**
   * The modes the group's members may use.
   *
   * Empty means the operator's One-API group decides. A non-empty list is the
   * tenant's own view and is applied as a further narrowing, never a widening.
   */
  allowedModes?: string[];
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
  email?: string;
  avatar?: string;
  memberIds?: string[];
  source: 'local' | 'entra';
  idOnTheSource?: string;
  accountType?: TenantAccountType;
  shared?: boolean;
  familySeats?: { maxAdults: number; maxChildren: number };
  localPrivacyEnabled?: boolean;
  allowedCapabilities?: TenantSeatCapability[];
  allowedModes?: string[];
  assignedKnowledgeVaults?: string[];
}

export interface UpdateGroupRequest {
  name?: string;
  description?: string;
  email?: string;
  avatar?: string;
  memberIds?: string[];
  source?: 'local' | 'entra' | 'ldap';
  idOnTheSource?: string;
  accountType?: TenantAccountType;
  shared?: boolean;
  familySeats?: { maxAdults: number; maxChildren: number };
  localPrivacyEnabled?: boolean;
  allowedCapabilities?: TenantSeatCapability[];
  allowedModes?: string[];
}

export interface GroupFilterOptions extends CursorPaginationParams {
  // Includes email, name and description
  search?: string;
  source?: 'local' | 'entra' | 'ldap';
  hasMember?: string;
  /** Filter by the commercial account type the group represents. */
  accountType?: TenantAccountType;
}
