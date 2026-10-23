import { z } from 'zod';

/**
 * Tenant extension policy — per-tenant enable/disable for agents, skills and
 * MCP servers.
 *
 * WHY THIS EXISTS
 * ---------------
 * Satchida sells to schools, RWAs and SMEs. Each is a separate tenant with its
 * own licence, and the operator must be able to decide, per tenant, which
 * extensions are switched on — a school should not have unrestricted shell and
 * browser automation, and a paid professional tenant should. Upstream
 * LibreChat has no such lever: deployment skills and plugin MCP servers are
 * process-global, and agents are visible to every tenant that can list them.
 *
 * DESIGN
 * ------
 * The policy is DATA, evaluated by a PURE function. Nothing here reads a
 * database, a request, or the environment. That is deliberate: the same
 * evaluation runs at the API boundary, at the control service, and in tests,
 * and a gate that can only be exercised end-to-end is a gate that ships broken.
 *
 * Three-valued state
 * ------------------
 * Each extension resolves to one of:
 *   - explicitly allowed  (operator turned it on for this tenant)
 *   - explicitly denied   (operator turned it off)
 *   - unset               (the operator has not said)
 *
 * `defaultMode` then decides what `unset` means. The default is DENY for
 * capabilities that can reach the host (shell, filesystem, browser) and ALLOW
 * for inert content (a skill document), because the safe default for a
 * capability is the one that does not execute anything.
 *
 * Order of precedence
 * -------------------
 *   explicit allow > explicit deny > defaultMode
 *
 * Deny wins over allow at the same specificity EXCEPT where a tenant explicitly
 * allows something the platform itself refuses; that is represented by
 * `platformBlocked`, which no policy can override. A tenant cannot re-enable a
 * capability the operator has withdrawn from the product.
 */

/** Extensions that can execute on the host or reach the network on its behalf. */
export type ExtensionKind = 'skill' | 'mcp' | 'agent';

/** Whether an extension may be merely read, or also executed by the model. */
export type ExtensionRisk = 'inert' | 'capability';

const EXTENSION_KINDS: ExtensionKind[] = ['skill', 'mcp', 'agent'];

const kindSchema = z.enum(EXTENSION_KINDS as [ExtensionKind, ...ExtensionKind[]]);

/**
 * Per-kind resolution of an extension that the operator has not named.
 *
 * Defaults are deliberately asymmetric: an unset skill is visible (a markdown
 * document cannot hurt anyone), while an unset MCP server or agent is denied
 * (both can run code).
 */
export const DEFAULT_POLICY_MODES: Record<ExtensionKind, 'allow' | 'deny'> = {
  skill: 'allow',
  mcp: 'deny',
  agent: 'deny',
};

/**
 * Capabilities the platform itself withholds.
 *
 * These are never tenant-overridable. They exist so the operator can retire a
 * capability that turned out to be unsafe across every tenant in one edit,
 * rather than hunting each tenant policy.
 */
const PLATFORM_BLOCKED_DEFAULT: ExtensionKind[] = [];

/** Operator-set rules for a single tenant. */
export const tenantPolicySchema = z
  .object({
    tenantId: z.string().min(1).max(128),
    /** Explicit per-extension decisions, keyed by kind then name. */
    rules: z
      .record(kindSchema, z.record(z.string().min(1).max(256), z.enum(['allow', 'deny'])))
      .optional(),
    /** Overrides {@link DEFAULT_POLICY_MODES} per kind for this tenant. */
    defaultModes: z.record(kindSchema, z.enum(['allow', 'deny'])).optional(),
    /** Extensions withdrawn platform-wide; a tenant policy cannot re-allow these. */
    platformBlocked: z
      .object({
        skill: z.array(z.string().max(256)).optional(),
        mcp: z.array(z.string().max(256)).optional(),
        agent: z.array(z.string().max(256)).optional(),
      })
      .optional(),
    /** When false the whole tenant sees no extensions at all (kill switch). */
    extensionsEnabled: z.boolean().optional(),
    updatedAt: z.union([z.date(), z.string()]).optional(),
    updatedBy: z.string().max(256).optional(),
  })
  .strict();

export type TenantPolicy = z.infer<typeof tenantPolicySchema>;
export type PolicyMode = 'allow' | 'deny';
export type PolicyDecision = {
  allowed: boolean;
  /** Why, for the audit trail. Never surfaced verbatim to an end user. */
  reason:
    | 'allowed_explicitly'
    | 'denied_explicitly'
    | 'allowed_by_default'
    | 'denied_by_default'
    | 'platform_blocked'
    | 'tenant_extensions_disabled';
};

/** The policy applied when a tenant has no stored policy of its own. */
export const DEFAULT_TENANT_POLICY: TenantPolicy = {
  tenantId: '',
  platformBlocked: { skill: [], mcp: [], agent: [] },
};

function ruleFor(policy: TenantPolicy, kind: ExtensionKind, name: string): PolicyMode | undefined {
  return policy.rules?.[kind]?.[name];
}

function isPlatformBlocked(policy: TenantPolicy, kind: ExtensionKind, name: string): boolean {
  return policy.platformBlocked?.[kind]?.includes(name) === true;
}

/**
 * Resolve whether one extension is available to a tenant.
 *
 * Pure. `platformBlocked` is checked first and cannot be overridden, so a
 * platform-level withdrawal holds even against an explicit tenant allow.
 */
export function resolveExtension(
  policy: TenantPolicy | undefined,
  kind: ExtensionKind,
  name: string,
): PolicyDecision {
  if (isPlatformBlocked(policy ?? DEFAULT_TENANT_POLICY, kind, name)) {
    return { allowed: false, reason: 'platform_blocked' };
  }
  if (policy?.extensionsEnabled === false) {
    return { allowed: false, reason: 'tenant_extensions_disabled' };
  }

  const explicit = ruleFor(policy ?? DEFAULT_TENANT_POLICY, kind, name);
  if (explicit === 'allow') {
    return { allowed: true, reason: 'allowed_explicitly' };
  }
  if (explicit === 'deny') {
    return { allowed: false, reason: 'denied_explicitly' };
  }

  const fallback = policy?.defaultModes?.[kind] ?? DEFAULT_POLICY_MODES[kind] ?? 'deny';
  return fallback === 'allow'
    ? { allowed: true, reason: 'allowed_by_default' }
    : { allowed: false, reason: 'denied_by_default' };
}

export function isExtensionAllowed(
  policy: TenantPolicy | undefined,
  kind: ExtensionKind,
  name: string,
): boolean {
  return resolveExtension(policy, kind, name).allowed;
}

/** Filter a named list, preserving order. Pure. */
export function filterExtensions<T>(
  policy: TenantPolicy | undefined,
  kind: ExtensionKind,
  items: T[],
  nameOf: (item: T) => string,
): T[] {
  return items.filter((item) => isExtensionAllowed(policy, kind, nameOf(item)));
}

/**
 * Build a policy that allows exactly `names`, denying everything else in that
 * kind. Used when the operator provisions a tenant from a plan template.
 */
export function policyAllowlist(
  tenantId: string,
  kind: ExtensionKind,
  names: string[],
): TenantPolicy {
  const rules: Record<string, Record<string, PolicyMode>> = { [kind]: {} };
  for (const name of names) {
    (rules[kind] as Record<string, PolicyMode>)[name] = 'allow';
  }
  return {
    tenantId,
    rules,
    /* An allowlist only means something if everything outside it is denied. */
    defaultModes: { ...DEFAULT_POLICY_MODES, [kind]: 'deny' },
    platformBlocked: { skill: [], mcp: [], agent: [] },
    extensionsEnabled: true,
  };
}

/** The risk class an extension belongs to, used to pick a default mode. */
export function defaultRiskFor(kind: ExtensionKind): ExtensionRisk {
  return kind === 'skill' ? 'inert' : 'capability';
}

export const EXTENSION_KIND_LIST = EXTENSION_KINDS;
export { PLATFORM_BLOCKED_DEFAULT };
