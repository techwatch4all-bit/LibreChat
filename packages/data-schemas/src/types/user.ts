import type {
  TUserFavorite,
  RefillIntervalUnit,
  StatefulCodeEnvironment,
} from 'librechat-data-provider';
import type { Document, Types } from 'mongoose';
import type { TenantSeatCapability, TenantAccountType } from './entitlement';
import { CursorPaginationParams } from '~/common';

export type FamilyRole = 'owner' | 'adult' | 'minor' | null;

/**
 * Account-type tiers, mirroring one-api's seeded policy groups. Lowercase
 * because one-api resolves a seat's group with an exact match on the group name
 * it seeded (`basic`/`pro`/`family`/`privacy`), and a mis-cased name silently
 * bypasses that side's `MaxSeats` cap.
 */
export const ACCOUNT_TYPES = [
  'basic',
  'standard',
  'family',
  'pro',
  'pro_family',
  'enterprise',
  'privacy',
] as const;
export type AccountType = TenantAccountType;

export interface FamilyLimits {
  imageGenEnabled: boolean;
  imageCreditsPerDay?: number | null;
  tokenCreditsPerDay?: number | null;
  allowedHoursFrom?: string | null;
  allowedHoursTo?: string | null;
  timezone?: string | null;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  /**
   * Mongoose's `Document.id` virtual is typed `id?: any`. At runtime it's
   * always `_id.toString()` for a hydrated doc, so narrow to a required
   * string. This also lets `IUser` satisfy Express.User augmentations
   * (the OIDC remote-agent middleware assigns `req.user = IUser` where
   * the project's local `Express.User` requires `id: string`).
   */
  id: string;
  name?: string;
  username?: string;
  email: string;
  emailVerified: boolean;
  password?: string;
  passwordSig?: string | null;
  avatar?: string;
  provider: string;
  role?: string;
  googleId?: string;
  facebookId?: string;
  openidId?: string;
  samlId?: string;
  ldapId?: string;
  githubId?: string;
  discordId?: string;
  appleId?: string;
  plugins?: string[];
  openidIssuer?: string;
  twoFactorEnabled?: boolean;
  totpSecret?: string;
  backupCodes?: Array<{
    codeHash: string;
    used: boolean;
    usedAt?: Date | null;
  }>;
  pendingTotpSecret?: string;
  pendingBackupCodes?: Array<{
    codeHash: string;
    used: boolean;
    usedAt?: Date | null;
  }>;
  refreshToken?: Array<{
    refreshToken: string;
  }>;
  expiresAt?: Date;
  termsAccepted?: boolean;
  termsAcceptedAt?: Date | null;
  mustChangePassword?: boolean;
  challengeQuestion?: string | null;
  challengeAnswerHash?: string | null;
  passwordChangedAt?: Date | null;
  /** Internal fence that prevents agent-trigger admission during account deletion. */
  agentTriggerDeletionStartedAt?: Date;
  /** Expiring fences closing subagent admission while bulk deletions drain. */
  subagentAdmissionFences?: Array<{
    token: string;
    expiresAt: Date;
  }>;
  personalization?: {
    memories?: boolean;
    statefulCodeEnvironment?: StatefulCodeEnvironment;
  };
  favorites?: TUserFavorite[];
  /** Display order for the sidebar's Pinned section: favorite and pinned-chat
   *  entry keys interleaved (`agent:`, `spec:`, `model:`, `convo:` prefixes). */
  pinnedOrder?: string[];
  /** Per-skill active/inactive overrides. Key = skillId, value = active state. */
  skillStates?: Record<string, boolean>;
  familyAccountId?: Types.ObjectId | null;
  guardianId?: Types.ObjectId | null;
  familyRole?: FamilyRole;
  seatToken?: string;
  /** Operator-provisioned opaque seat alias; not a person identifier. */
  satchidaSeatAlias?: string;
  satchidaSeatTokenId?: number;
  /** Local router assertion, kept server-side and never returned to clients. */
  privacyAssertion?: string;
  /** True only when the current local seat policy grants the Privacy add-on. */
  privacyEntitled?: boolean;
  tenantSeatCapabilities?: TenantSeatCapability[] | string[];
  /** Account type / one-api seat group this user is entitled under. */
  accountType?: AccountType | null;
  familyLimits?: FamilyLimits | null;
  guardianProcessingConsentAt?: Date | null;
  guardianProcessingConsentVersion?: string | null;
  parentalTranscriptConsentAt?: Date | null;
  parentalTranscriptConsentVersion?: string | null;
  imageGenerationConsentAt?: Date | null;
  imageGenerationConsentVersion?: string | null;
  suspended?: boolean;
  dailyMessageLimit?: number | null;
  assignedKnowledgeVaults?: string[];
  createdAt?: Date;
  updatedAt?: Date;
  /** Field for external source identification (for consistency with TPrincipal schema) */
  idOnTheSource?: string;
  uniqueIdentifier?: string | null;
  idCategory?: string | null;
  tenantId?: string;
  federatedTokens?: OIDCTokens;
  openidTokens?: OIDCTokens;
}

export interface OIDCTokens {
  access_token?: string;
  id_token?: string;
  refresh_token?: string;
  expires_at?: number;
}

export interface BalanceConfig {
  enabled?: boolean;
  startBalance?: number;
  autoRefillEnabled?: boolean;
  refillIntervalValue?: number;
  refillIntervalUnit?: RefillIntervalUnit;
  refillAmount?: number;
  reservationTtlMs?: number;
}

export interface CreateUserRequest extends Partial<IUser> {
  email: string;
}

export interface UpdateUserRequest {
  name?: string;
  username?: string;
  uniqueIdentifier?: string | null;
  email?: string;
  role?: string;
  emailVerified?: boolean;
  avatar?: string;
  plugins?: string[];
  twoFactorEnabled?: boolean;
  termsAccepted?: boolean;
  termsAcceptedAt?: Date | null;
  personalization?: {
    memories?: boolean;
    statefulCodeEnvironment?: StatefulCodeEnvironment;
  };
  skillStates?: Record<string, boolean>;
}

export interface UserDeleteResult {
  deletedCount: number;
  message: string;
}

export interface UserFilterOptions extends CursorPaginationParams {
  _id?: Types.ObjectId | string;
  // Includes email, username and name
  search?: string;
  role?: string;
  emailVerified?: boolean;
  provider?: string;
  twoFactorEnabled?: boolean;
  // External IDs
  googleId?: string;
  facebookId?: string;
  openidId?: string;
  samlId?: string;
  ldapId?: string;
  githubId?: string;
  discordId?: string;
  appleId?: string;
  // Date filters
  createdAfter?: string;
  createdBefore?: string;
}

export interface UserQueryOptions {
  fieldsToSelect?: string | string[] | null;
  lean?: boolean;
}
