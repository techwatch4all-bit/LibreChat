import { Schema } from 'mongoose';
import { SystemRoles, STATEFUL_CODE_ENVIRONMENTS } from 'librechat-data-provider';
import { IUser } from '~/types';

// Session sub-schema
const SessionSchema = new Schema(
  {
    refreshToken: {
      type: String,
      default: '',
    },
  },
  { _id: false },
);

// Backup code sub-schema
const BackupCodeSchema = new Schema(
  {
    codeHash: { type: String, required: true },
    used: { type: Boolean, default: false },
    usedAt: { type: Date, default: null },
  },
  { _id: false },
);

const userSchema: Schema<IUser> = new Schema<IUser>(
  {
    name: {
      type: String,
    },
    username: {
      type: String,
      lowercase: true,
      default: '',
    },
    email: {
      type: String,
      required: [true, "can't be blank"],
      lowercase: true,
      match: [/\S+@\S+\.\S+/, 'is invalid'],
      index: true,
    },
    emailVerified: {
      type: Boolean,
      required: true,
      default: false,
    },
    password: {
      type: String,
      trim: true,
      minlength: 8,
      maxlength: 128,
      select: false,
    },
    avatar: {
      type: String,
      required: false,
    },
    provider: {
      type: String,
      required: true,
      default: 'local',
    },
    role: {
      type: String,
      default: SystemRoles.USER,
    },
    googleId: {
      type: String,
    },
    facebookId: {
      type: String,
    },
    openidId: {
      type: String,
    },
    openidIssuer: {
      type: String,
    },
    samlId: {
      type: String,
    },
    ldapId: {
      type: String,
    },
    githubId: {
      type: String,
    },
    discordId: {
      type: String,
    },
    appleId: {
      type: String,
    },
    plugins: {
      type: Array,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    totpSecret: {
      type: String,
      select: false,
    },
    backupCodes: {
      type: [BackupCodeSchema],
      select: false,
    },
    pendingTotpSecret: {
      type: String,
      select: false,
    },
    pendingBackupCodes: {
      type: [BackupCodeSchema],
      select: false,
      default: undefined,
    },
    refreshToken: {
      type: [SessionSchema],
    },
    expiresAt: {
      type: Date,
      expires: 604800, // 7 days in seconds
    },
    termsAccepted: {
      type: Boolean,
      default: false,
    },
    termsAcceptedAt: {
      type: Date,
      default: null,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    challengeQuestion: {
      type: String,
      default: null,
    },
    challengeAnswerHash: {
      type: String,
      default: null,
      select: false,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    agentTriggerDeletionStartedAt: {
      type: Date,
      select: false,
    },
    subagentAdmissionFences: {
      type: [
        {
          token: { type: String, required: true },
          expiresAt: { type: Date, required: true },
        },
      ],
      _id: false,
      select: false,
      default: undefined,
    },
    personalization: {
      type: {
        memories: {
          type: Boolean,
          default: true,
        },
        statefulCodeEnvironment: {
          type: String,
          enum: STATEFUL_CODE_ENVIRONMENTS,
          default: 'user',
        },
      },
      default: {},
    },
    favorites: {
      type: [
        {
          _id: false,
          agentId: { type: String, maxlength: 256 },
          model: { type: String, maxlength: 256 },
          endpoint: { type: String, maxlength: 256 },
          spec: { type: String, maxlength: 256 },
        },
      ],
      default: [],
    },
    /** Display order for the sidebar's Pinned section: favorite and pinned-chat
     *  entry keys interleaved (`agent:`, `spec:`, `model:`, `convo:` prefixes).
     *  Keys whose item no longer exists are ignored; unlisted items keep their
     *  natural order after the listed ones. */
    pinnedOrder: {
      type: [String],
      default: [],
      /** Display-only, and allowed to grow large. Every authentication request
       *  loads the user document, so leaving this selected would put hundreds
       *  of kilobytes on paths that never read it. The pinned-order handler
       *  asks for it explicitly with `+pinnedOrder`. */
      select: false,
    },
    skillStates: {
      type: Map,
      of: Boolean,
      default: () => new Map(),
    },
    /** Field for external source identification (for consistency with TPrincipal schema) */
    idOnTheSource: {
      type: String,
      sparse: true,
    },
    tenantId: {
      type: String,
      index: true,
    },
    familyAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    guardianId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    familyRole: {
      type: String,
      enum: ['owner', 'adult', 'minor', null],
      default: null,
    },
    seatToken: {
      type: String,
      default: null,
      select: false,
    },
    satchidaSeatAlias: {
      type: String,
      default: null,
      select: false,
      match: /^[A-Za-z0-9_-]{16,128}$/,
    },
    privacyAssertion: {
      type: String,
      default: null,
      select: false,
    },
    accountType: {
      type: String,
      enum: ['basic', 'pro', 'family', 'privacy', null],
      default: null,
    },
    familyLimits: {
      type: {
        imageGenEnabled: { type: Boolean, default: false },
        imageCreditsPerDay: { type: Number, min: 0, default: null },
        tokenCreditsPerDay: { type: Number, min: 0, default: null },
        allowedHoursFrom: {
          type: String,
          match: /^(?:[01]\d|2[0-3]):[0-5]\d$/,
          default: null,
        },
        allowedHoursTo: {
          type: String,
          match: /^(?:[01]\d|2[0-3]):[0-5]\d$/,
          default: null,
        },
        timezone: { type: String, default: null },
      },
      default: null,
    },
    guardianProcessingConsentAt: {
      type: Date,
      default: null,
    },
    guardianProcessingConsentVersion: {
      type: String,
      default: null,
    },
    parentalTranscriptConsentAt: {
      type: Date,
      default: null,
    },
    parentalTranscriptConsentVersion: {
      type: String,
      default: null,
    },
    imageGenerationConsentAt: {
      type: Date,
      default: null,
    },
    imageGenerationConsentVersion: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

userSchema.index({ email: 1, tenantId: 1 }, { unique: true });
userSchema.index({ role: 1, tenantId: 1 });
userSchema.index({ idOnTheSource: 1, openidIssuer: 1, tenantId: 1 });
userSchema.index(
  { familyAccountId: 1, tenantId: 1, familyRole: 1 },
  { partialFilterExpression: { familyAccountId: { $type: 'objectId' } } },
);
userSchema.index(
  { guardianId: 1, tenantId: 1, familyRole: 1 },
  { partialFilterExpression: { guardianId: { $type: 'objectId' } } },
);

const oAuthIdFields = [
  'googleId',
  'facebookId',
  'openidId',
  'samlId',
  'ldapId',
  'githubId',
  'discordId',
  'appleId',
] as const;

for (const field of oAuthIdFields) {
  if (field === 'openidId') {
    userSchema.index(
      { openidId: 1, openidIssuer: 1, tenantId: 1 },
      { unique: true, partialFilterExpression: { openidId: { $exists: true } } },
    );
    continue;
  }

  userSchema.index(
    { [field]: 1, tenantId: 1 },
    { unique: true, partialFilterExpression: { [field]: { $exists: true } } },
  );
}

export default userSchema;
