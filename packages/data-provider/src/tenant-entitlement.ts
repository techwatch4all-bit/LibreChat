import { z } from 'zod';

export const TENANT_PLAN_TYPES = [
  'basic',
  'standard',
  'family',
  'pro',
  'pro_family',
  'enterprise',
] as const;
export const TENANT_ACCOUNT_TYPES = [
  'basic',
  'standard',
  'family',
  'pro',
  'pro_family',
  'enterprise',
  'privacy',
] as const;
export const SEMANTIC_MODES = ['Chat', 'Study', 'Work', 'Privacy'] as const;
export const TENANT_ENTITLEMENT_STATUSES = ['active', 'suspended', 'expired', 'revoked'] as const;

/**
 * Account types that may hold a Privacy entitlement.
 *
 * `family` is here because Family Privacy is a separately purchased local-GPU
 * add-on, not part of the base plan: it is granted by setting
 * `localPrivacyEnabled` on the Family allocation, exactly as the original
 * Family add-on path did. A dedicated `privacy` account type is the same
 * product sold on its own, with its own term and its own allocation.
 */
export const PRIVACY_ELIGIBLE_ACCOUNT_TYPES: readonly TenantAccountType[] = [
  'pro',
  'pro_family',
  'enterprise',
  'privacy',
  'family',
];
export const INITIAL_FAMILY_SEAT_LIMIT = 4;
export const OPAQUE_SEAT_KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

export type TenantPlanType = (typeof TENANT_PLAN_TYPES)[number];
export type TenantAccountType = (typeof TENANT_ACCOUNT_TYPES)[number];
export type SemanticMode = (typeof SEMANTIC_MODES)[number];
export type TenantEntitlementStatus = (typeof TENANT_ENTITLEMENT_STATUSES)[number];
export type TenantSeatCapability =
  | 'work_tools'
  | 'mcp'
  | 'agents'
  | 'code_execution'
  | 'vscode_server';

export const TENANT_SEAT_CAPABILITIES = [
  'work_tools',
  'mcp',
  'agents',
  'code_execution',
  'vscode_server',
] as const;

/** Reports whether a value is a recognised commercial account type. */
export function isTenantAccountType(value: unknown): value is TenantAccountType {
  return typeof value === 'string' && TENANT_ACCOUNT_TYPES.includes(value as TenantAccountType);
}

/**
 * The modes each account type may use.
 *
 * This is the product's account-type table, and it is the ONE place it is
 * written down. The operator's gateway derives each tenant's group policy from
 * it, the tenant's own entitlement records it, and the client greys out the
 * modes a seat may not use, so all three agree.
 *
 *   basic, standard   chat only
 *   family             chat and study. A family is a household, and Work is the
 *                     mode with the developer tools, so a family does not get
 *                     it.
 *   pro, pro_family    chat, study and work. Work is the mode that reaches
 *                     the developer tools, and it is what a pro seat buys.
 *   enterprise         all of pro, plus the privacy mode for the tenant's own
 *                      local models.
 *   privacy            all of pro, plus the privacy mode. A privacy seat is
 *                      sold as a local product, and it is also a cloud customer
 *                      for the modes it has not been restricted from.
 *
 * A seat that is not classified at all is treated as basic or standard: the
 * least-privileged type, chat only. It is not locked out, because a locked-out
 * seat is an operational mystery, and it is not given anything extra, because
 * an unclassified seat has told nobody what it is.
 */
export const ACCOUNT_TYPE_MODES: Readonly<Record<TenantAccountType, readonly SemanticMode[]>> = {
  basic: ['Chat'],
  standard: ['Chat'],
  family: ['Chat', 'Study'],
  pro: ['Chat', 'Study', 'Work'],
  pro_family: ['Chat', 'Study', 'Work'],
  enterprise: ['Chat', 'Study', 'Work', 'Privacy'],
  privacy: ['Chat', 'Study', 'Work', 'Privacy'],
};

/**
 * The account type a seat is treated as when it has not been classified.
 *
 * A seat whose type is unknown, or which is not a privacy seat and belongs to
 * no account type, gets the least-privileged type.
 */
export const DEFAULT_TENANT_ACCOUNT_TYPE: TenantAccountType = 'standard';

/**
 * Resolve a seat's effective account type.
 *
 * An unknown or missing type resolves to the default rather than to nothing,
 * so an unclassified seat is a basic seat with chat rather than a seat that
 * cannot do anything.
 */
export function resolveTenantAccountType(value: unknown): TenantAccountType {
  if (isTenantAccountType(value)) return value;
  return DEFAULT_TENANT_ACCOUNT_TYPE;
}

/**
 * The modes an account type may use, in the canonical capitalisation.
 */
export function accountTypeModes(accountType: unknown): readonly SemanticMode[] {
  return ACCOUNT_TYPE_MODES[resolveTenantAccountType(accountType)];
}

/**
 * Whether an account type may use a mode.
 *
 * The comparison is on the CANONICAL form of both sides, so an entitlement
 * written by an operator as "chat" or "CHAT" is honoured the same as "Chat".
 * It was compared literally, so the same seat was entitled under one spelling
 * and refused under another.
 */
export function accountTypeAllowsMode(accountType: unknown, mode: unknown): boolean {
  const canonical = normalizeSemanticMode(String(mode ?? ''));
  if (!canonical) return false;
  return accountTypeModes(accountType).includes(canonical);
}

/**
 * Normalise a list of mode labels to the canonical form, dropping the ones
 * that are not modes.
 *
 * It is used on the entitlement's own `allowedModes`, which an operator may
 * have written in any case.
 */
export function normalizeSemanticModes(
  modes: readonly string[] | undefined | null,
): SemanticMode[] {
  if (!Array.isArray(modes)) return [];
  const seen = new Set<SemanticMode>();
  for (const mode of modes) {
    const canonical = normalizeSemanticMode(String(mode ?? ''));
    if (canonical) seen.add(canonical);
  }
  return SEMANTIC_MODES.filter((mode) => seen.has(mode));
}

/** Reports whether a value is a recognised semantic mode label. */
export function isSemanticMode(value: unknown): value is SemanticMode {
  return typeof value === 'string' && SEMANTIC_MODES.includes(value as SemanticMode);
}

/**
 * Account types that may reach privileged cloud integrations.
 *
 * A `privacy` seat is a local product, but it is also a cloud customer for the
 * modes it has not been restricted from, so it holds the same tooling as the
 * other cloud-facing types. The LOCALITY is decided by the mode: a request in
 * the privacy mode is served by the tenant's own router, and the cloud
 * gateway refuses it.
 *
 * The floor is a floor. Whether a seat may actually use a capability is still
 * decided by the allocation the operator records for it, and that decision is
 * enforced where the allocation is read.
 */
const CLOUD_CAPABILITY_ACCOUNT_TYPES: readonly TenantAccountType[] = [
  'pro',
  'pro_family',
  'enterprise',
  'privacy',
];

/** Server-side capability floor; UI switches are never an authorization source. */
export function tenantSeatCanUseCapability(
  accountType: string | null | undefined,
  familyRole: string | null | undefined,
  capability: TenantSeatCapability,
): boolean {
  if (familyRole === 'minor' || familyRole === 'child') return false;
  if (accountType === 'family') return false;
  if (!CLOUD_CAPABILITY_ACCOUNT_TYPES.includes(accountType as TenantAccountType)) return false;
  return ['work_tools', 'mcp', 'agents', 'code_execution'].includes(capability);
}

export function normalizeSemanticMode(mode: string): SemanticMode | undefined {
  const normalized = mode.trim().toLowerCase();
  if (normalized === 'vibecoder' || normalized === 'vibe_coding') return 'Work';
  return SEMANTIC_MODES.find((candidate) => candidate.toLowerCase() === normalized);
}

export type SeatModeDecision =
  | { allowed: true; mode: SemanticMode }
  | {
      allowed: false;
      code:
        | 'MODE_NOT_ENTITLED'
        | 'LOCAL_PRIVACY_UNAVAILABLE'
        | 'CHILD_SAFETY_UNAVAILABLE'
        | 'WORK_TOOL_CAPABILITY_REQUIRED';
    };

/** Resolve one requested mode against server-returned seat policy. */
export function authorizeSeatMode(params: {
  mode: SemanticMode;
  accountType: TenantAccountType;
  familyRole?: string | null;
  allowedModes: readonly SemanticMode[];
  localModelHealthy: boolean;
  childSafetyReady: boolean;
  requestsWorkTools?: boolean;
  allowedCapabilities?: TenantSeatCapability[];
}): SeatModeDecision {
  if (!params.allowedModes.includes(params.mode))
    return { allowed: false, code: 'MODE_NOT_ENTITLED' };
  const isChild = params.familyRole === 'minor' || params.familyRole === 'child';
  if (isChild && !params.childSafetyReady)
    return { allowed: false, code: 'CHILD_SAFETY_UNAVAILABLE' };
  if (isChild && params.mode === 'Work') return { allowed: false, code: 'MODE_NOT_ENTITLED' };
  if (params.accountType === 'family' && params.mode === 'Work' && params.requestsWorkTools) {
    return { allowed: false, code: 'WORK_TOOL_CAPABILITY_REQUIRED' };
  }
  if (params.mode === 'Privacy' && !params.localModelHealthy)
    return { allowed: false, code: 'LOCAL_PRIVACY_UNAVAILABLE' };
  if (params.requestsWorkTools) {
    const hasCapability = params.allowedCapabilities?.some(
      (capability) =>
        capability === 'work_tools' ||
        capability === 'mcp' ||
        capability === 'agents' ||
        capability === 'code_execution',
    );
    if (
      !hasCapability ||
      !tenantSeatCanUseCapability(params.accountType, params.familyRole, 'work_tools')
    ) {
      return { allowed: false, code: 'WORK_TOOL_CAPABILITY_REQUIRED' };
    }
  }
  return { allowed: true, mode: params.mode };
}

const allocationSchema = z.object({
  seatLimit: z.number().int().min(0).max(100_000),
  allowedModes: z.array(z.enum(SEMANTIC_MODES)).max(SEMANTIC_MODES.length),
  /** Privileged work integrations. A Family Work mode is text-only by default. */
  allowedCapabilities: z
    .array(z.enum(['work_tools', 'mcp', 'agents', 'code_execution']))
    .optional(),
  /** Family Privacy is a separate local-GPU add-on, not part of the base plan. */
  localPrivacyEnabled: z.boolean().optional(),
  monthlyTokenCredits: z.number().finite().min(0).optional(),
  requestsPerMinute: z.number().int().min(0).optional(),
});

export const tenantEntitlementSchema = z
  .object({
    tenantId: z.string().trim().min(1).max(128),
    plan: z.enum(TENANT_PLAN_TYPES),
    status: z.enum(TENANT_ENTITLEMENT_STATUSES),
    seatLimit: z.number().int().min(0).max(100_000),
    accountTypes: z.record(z.string(), allocationSchema),
    seatAssignments: z.record(
      z.string().regex(OPAQUE_SEAT_KEY_PATTERN),
      z.enum(TENANT_ACCOUNT_TYPES),
    ),
    startsAt: z.coerce.date().nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    updatedBy: z.string().trim().max(256).optional(),
    createdAt: z.coerce.date().optional(),
    updatedAt: z.coerce.date().optional(),
  })
  .superRefine((entitlement, context) => {
    const assignedByType: Partial<Record<TenantAccountType, number>> = {};
    for (const accountType of Object.values(entitlement.seatAssignments)) {
      assignedByType[accountType] = (assignedByType[accountType] ?? 0) + 1;
    }

    const assignments = Object.keys(entitlement.seatAssignments).length;
    if (assignments > entitlement.seatLimit) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['seatAssignments'],
        message: 'Active seat assignments exceed the tenant seat limit',
      });
    }

    let allocatedSeats = 0;
    for (const [accountType, allocation] of Object.entries(entitlement.accountTypes)) {
      if (!TENANT_ACCOUNT_TYPES.includes(accountType as TenantAccountType)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['accountTypes', accountType],
          message: 'Unsupported account type',
        });
      }
      allocatedSeats += allocation.seatLimit;
      if (
        allocation.allowedCapabilities?.some(
          (capability) => !['work_tools', 'mcp', 'agents', 'code_execution'].includes(capability),
        )
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['accountTypes', accountType, 'allowedCapabilities'],
          message: 'Unsupported capability',
        });
      }
      if ((assignedByType[accountType as TenantAccountType] ?? 0) > allocation.seatLimit) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['accountTypes', accountType, 'seatLimit'],
          message: 'Active assignments exceed the account-type seat limit',
        });
      }
    }
    if (allocatedSeats > entitlement.seatLimit) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['accountTypes'],
        message: 'Account-type allocations exceed the tenant seat limit',
      });
    }
    if (
      Object.keys(assignedByType).some(
        (accountType) => entitlement.accountTypes[accountType] == null,
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['seatAssignments'],
        message: 'Seat assignment refers to an unallocated account type',
      });
    }
    if (
      entitlement.startsAt &&
      entitlement.expiresAt &&
      entitlement.expiresAt <= entitlement.startsAt
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expiresAt'],
        message: 'Entitlement expiry must be after its start',
      });
    }
  });

export type TenantEntitlement = z.infer<typeof tenantEntitlementSchema>;
export type TenantEntitlementPolicy = Omit<TenantEntitlement, 'seatAssignments'>;
export type TenantEntitlementSummary = TenantEntitlementPolicy & {
  activeSeats: number;
  accountTypes: Record<string, TenantEntitlement['accountTypes'][string] & { activeSeats: number }>;
};
export type TenantEntitlementUpdate = Omit<
  TenantEntitlementPolicy,
  'tenantId' | 'createdAt' | 'updatedAt'
>;
export type LocalEntitlementView = TenantEntitlementSummary & { accountType: TenantAccountType };

export function toTenantEntitlementSummary(
  entitlement: TenantEntitlement,
): TenantEntitlementSummary {
  const assignedByType: Record<string, number> = {};
  for (const accountType of Object.values(entitlement.seatAssignments)) {
    assignedByType[accountType] = (assignedByType[accountType] ?? 0) + 1;
  }
  return {
    tenantId: entitlement.tenantId,
    plan: entitlement.plan,
    status: entitlement.status,
    seatLimit: entitlement.seatLimit,
    activeSeats: Object.keys(entitlement.seatAssignments).length,
    accountTypes: Object.fromEntries(
      Object.entries(entitlement.accountTypes).map(([name, allocation]) => [
        name,
        { ...allocation, activeSeats: assignedByType[name] ?? 0 },
      ]),
    ),
    startsAt: entitlement.startsAt,
    expiresAt: entitlement.expiresAt,
    updatedBy: entitlement.updatedBy,
  };
}

export type EntitlementDecision =
  | { allowed: true; modes: SemanticMode[]; capabilities: string[] }
  | {
      allowed: false;
      code:
        | 'ENTITLEMENT_INACTIVE'
        | 'ACCOUNT_TYPE_NOT_ALLOCATED'
        | 'CHILD_SAFETY_UNAVAILABLE'
        | 'CHILD_WORK_NOT_ALLOWED'
        | 'FAMILY_POLICY_INVALID';
    };

export function resolveEntitledModes(
  entitlement: TenantEntitlement,
  accountType: TenantAccountType,
  options: {
    now?: Date;
    localModelHealthy: boolean;
    childAccount: boolean;
    childSafetyReady: boolean;
  },
): EntitlementDecision {
  const now = options.now ?? new Date();
  if (
    entitlement.status !== 'active' ||
    (entitlement.startsAt != null && entitlement.startsAt > now) ||
    (entitlement.expiresAt != null && entitlement.expiresAt <= now)
  ) {
    return { allowed: false, code: 'ENTITLEMENT_INACTIVE' };
  }
  const allocation = entitlement.accountTypes[accountType];
  if (!allocation || allocation.seatLimit <= 0) {
    return { allowed: false, code: 'ACCOUNT_TYPE_NOT_ALLOCATED' };
  }
  if (options.childAccount && !options.childSafetyReady) {
    return { allowed: false, code: 'CHILD_SAFETY_UNAVAILABLE' };
  }
  const modes = allocation.allowedModes.filter(
    (mode) =>
      mode !== 'Privacy' ||
      (allocation.localPrivacyEnabled === true &&
        PRIVACY_ELIGIBLE_ACCOUNT_TYPES.includes(accountType) &&
        options.localModelHealthy),
  );
  const effectiveModes = options.childAccount ? modes.filter((mode) => mode !== 'Work') : modes;
  const capabilities = (allocation.allowedCapabilities ?? []).filter(
    (capability) =>
      !options.childAccount &&
      accountType !== 'family' &&
      effectiveModes.includes('Work') &&
      ['work_tools', 'mcp', 'agents', 'code_execution'].includes(capability),
  );
  return { allowed: true, modes: effectiveModes, capabilities };
}
