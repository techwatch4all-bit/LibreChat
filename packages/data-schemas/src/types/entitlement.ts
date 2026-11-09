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
export const SEMANTIC_MODES = ['Chat', 'Study', 'Work', 'Privacy', 'Vibecoding'] as const;
export const TENANT_ENTITLEMENT_STATUSES = ['active', 'suspended', 'expired', 'revoked'] as const;
export const TENANT_SEAT_CAPABILITIES = [
  'work_tools',
  'mcp',
  'agents',
  'code_execution',
  'vscode_server',
] as const;

export type TenantPlanType = (typeof TENANT_PLAN_TYPES)[number];
export type TenantAccountType = (typeof TENANT_ACCOUNT_TYPES)[number];
export type SemanticMode = (typeof SEMANTIC_MODES)[number];
export type TenantEntitlementStatus = (typeof TENANT_ENTITLEMENT_STATUSES)[number];
export type TenantSeatCapability = (typeof TENANT_SEAT_CAPABILITIES)[number];

export type EntitlementAccountType = {
  seatLimit: number;
  allowedModes: SemanticMode[];
  allowedCapabilities?: Array<'work_tools' | 'mcp' | 'agents' | 'code_execution' | 'vscode_server'>;
  localPrivacyEnabled?: boolean;
  monthlyTokenCredits?: number;
  requestsPerMinute?: number;
};

export type TenantEntitlementPolicy = {
  tenantId: string;
  plan: TenantPlanType;
  status: TenantEntitlementStatus;
  seatLimit: number;
  accountTypes: Record<string, EntitlementAccountType>;
  startsAt?: Date | null;
  expiresAt?: Date | null;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

/** Internal tenant-local record. Never serialize seatAssignments to operator-facing clients. */
export type ITenantEntitlement = TenantEntitlementPolicy & {
  _id?: string | { toString(): string };
  seatAssignments: Record<string, TenantAccountType>;
};

/** Safe operator/tenant-admin projection; it carries counts but no subject keys. */
export type TenantEntitlementSummary = Omit<TenantEntitlementPolicy, 'accountTypes'> & {
  activeSeats: number;
  accountTypes: Record<string, EntitlementAccountType & { activeSeats: number }>;
};

export type TenantEntitlementUpdate = Omit<
  TenantEntitlementPolicy,
  'tenantId' | 'createdAt' | 'updatedAt'
>;

/** Tenant-local authenticated view; contains only the caller's assigned account type. */
export type LocalEntitlementView = TenantEntitlementSummary & { accountType: TenantAccountType };

export function isTenantAccountType(value: unknown): value is TenantAccountType {
  return typeof value === 'string' && TENANT_ACCOUNT_TYPES.includes(value as TenantAccountType);
}

export function isTenantPlanType(value: unknown): value is TenantPlanType {
  return typeof value === 'string' && TENANT_PLAN_TYPES.includes(value as TenantPlanType);
}

export function isSemanticMode(value: unknown): value is SemanticMode {
  return typeof value === 'string' && SEMANTIC_MODES.includes(value as SemanticMode);
}

export function summarizeTenantEntitlement(record: ITenantEntitlement): TenantEntitlementSummary {
  const activeByType: Record<string, number> = {};
  for (const accountType of Object.values(record.seatAssignments)) {
    activeByType[accountType] = (activeByType[accountType] ?? 0) + 1;
  }
  return {
    tenantId: record.tenantId,
    plan: record.plan,
    status: record.status,
    seatLimit: record.seatLimit,
    activeSeats: Object.keys(record.seatAssignments).length,
    accountTypes: Object.fromEntries(
      Object.entries(record.accountTypes).map(([key, allocation]) => [
        key,
        { ...allocation, activeSeats: activeByType[key] ?? 0 },
      ]),
    ),
    startsAt: record.startsAt,
    expiresAt: record.expiresAt,
    updatedBy: record.updatedBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
