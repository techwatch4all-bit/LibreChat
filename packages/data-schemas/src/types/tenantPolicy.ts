/**
 * Stored form of a tenant's extension policy.
 *
 * These mirror `tenantPolicySchema` in `@librechat/data-provider`. They are
 * re-declared rather than imported because data-provider depends on
 * data-schemas, not the other way round — importing it here would close the
 * cycle. The Zod schema remains the single source of truth for validation; this
 * type only describes what Mongoose hands back.
 */
export type TenantPolicyMode = 'allow' | 'deny';

export type TenantExtensionKind = 'skill' | 'mcp' | 'agent';

export type TenantPolicy = {
  tenantId: string;
  /** Explicit per-extension decisions, keyed by kind then name. */
  rules?: Partial<Record<TenantExtensionKind, Record<string, TenantPolicyMode>>>;
  /** Overrides the platform default per kind for this tenant. */
  defaultModes?: Partial<Record<TenantExtensionKind, TenantPolicyMode>>;
  /** Withdrawn platform-wide; no tenant policy can re-allow these. */
  platformBlocked?: Partial<Record<TenantExtensionKind, string[]>>;
  /** When false the tenant sees no extensions at all (kill switch). */
  extensionsEnabled?: boolean;
  updatedAt?: Date | string;
  updatedBy?: string;
};

/** The Mongoose document type: one policy per tenant. */
export type ITenantPolicy = TenantPolicy;
