import type { Model } from 'mongoose';
import type { ITenantPolicy, TenantPolicy } from '~/types';

/**
 * Tenant extension policy storage.
 *
 * The evaluation rules live in `@librechat/data-provider/tenant-policy` and are
 * pure. This layer only reads and writes the operator's decisions; it never
 * decides anything itself, so the rules stay testable without a database.
 */

/** Mongoose stores a Map as a Map; the evaluator wants a plain object. */
function nameMapToRecord(value: unknown): Record<string, Record<string, string>> | undefined {
  if (value == null || typeof value !== 'object') return undefined;
  const out: Record<string, Record<string, string>> = {};
  for (const kind of ['skill', 'mcp', 'agent'] as const) {
    const entries = (value as Record<string, unknown>)[kind];
    if (entries == null) continue;
    const record: Record<string, string> = {};
    if (entries instanceof Map) {
      for (const [name, mode] of entries) record[String(name)] = String(mode);
    } else if (typeof entries === 'object') {
      for (const [name, mode] of Object.entries(entries as Record<string, unknown>)) {
        record[name] = String(mode);
      }
    }
    if (Object.keys(record).length) out[kind] = record;
  }
  return Object.keys(out).length ? out : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map(String);
}

/** Document -> the plain object `tenantPolicySchema` expects. */
export function toTenantPolicy(doc: Record<string, unknown> | null): TenantPolicy | undefined {
  if (doc == null) return undefined;
  const blocked = doc.platformBlocked as Record<string, unknown> | undefined;
  const modes = doc.defaultModes as Record<string, unknown> | undefined;
  const rules = nameMapToRecord(doc.rules);

  const policy: TenantPolicy = {
    tenantId: String(doc.tenantId),
    extensionsEnabled: doc.extensionsEnabled !== false,
  };
  if (rules) policy.rules = rules as TenantPolicy['rules'];
  if (modes) {
    const cleaned: Record<string, 'allow' | 'deny'> = {};
    for (const kind of ['skill', 'mcp', 'agent'] as const) {
      const mode = modes[kind];
      if (mode === 'allow' || mode === 'deny') cleaned[kind] = mode;
    }
    if (Object.keys(cleaned).length) {
      policy.defaultModes = cleaned as TenantPolicy['defaultModes'];
    }
  }
  if (blocked) {
    const cleaned: Record<string, string[]> = {};
    for (const kind of ['skill', 'mcp', 'agent'] as const) {
      const list = stringArray(blocked[kind]);
      if (list) cleaned[kind] = list;
    }
    if (Object.keys(cleaned).length) {
      policy.platformBlocked = cleaned as TenantPolicy['platformBlocked'];
    }
  }
  return policy;
}

export function createTenantPolicyMethods(mongoose: typeof import('mongoose')): {
  getTenantPolicy: (tenantId: string) => Promise<TenantPolicy | undefined>;
  setTenantPolicy: (
    tenantId: string,
    policy: Partial<TenantPolicy>,
    updatedBy?: string,
  ) => Promise<TenantPolicy>;
  listTenantPolicies: () => Promise<TenantPolicy[]>;
  deleteTenantPolicy: (tenantId: string) => Promise<boolean>;
} {
  const model = () => mongoose.models.TenantPolicy as Model<ITenantPolicy>;

  /**
   * Read one tenant's policy. Returns `undefined` — not a permissive object —
   * when the operator has stored nothing, so `resolveExtension` falls back to
   * `DEFAULT_POLICY_MODES` (skills visible, MCP and agents denied).
   */
  async function getTenantPolicy(tenantId: string): Promise<TenantPolicy | undefined> {
    if (!tenantId) return undefined;
    const doc = await model().findOne({ tenantId }).lean<ITenantPolicy | null>().exec();
    return toTenantPolicy(doc as Record<string, unknown> | null);
  }

  /** Upsert, so a caller does not have to know whether a policy already exists. */
  async function setTenantPolicy(
    tenantId: string,
    policy: Partial<TenantPolicy>,
    updatedBy?: string,
  ): Promise<TenantPolicy> {
    const update: Record<string, unknown> = { ...policy, tenantId };
    delete update.tenantId;
    update.updatedBy = updatedBy ?? policy.updatedBy;
    const doc = await model()
      .findOneAndUpdate(
        { tenantId },
        { $set: update },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .lean<ITenantPolicy>()
      .exec();
    return toTenantPolicy(doc as unknown as Record<string, unknown>) as TenantPolicy;
  }

  async function listTenantPolicies(): Promise<TenantPolicy[]> {
    const docs = await model().find().lean<ITenantPolicy[]>().exec();
    return docs
      .map((doc) => toTenantPolicy(doc as unknown as Record<string, unknown>))
      .filter((p): p is TenantPolicy => p != null);
  }

  async function deleteTenantPolicy(tenantId: string): Promise<boolean> {
    const res = await model().deleteOne({ tenantId }).exec();
    return res.deletedCount > 0;
  }

  return { getTenantPolicy, setTenantPolicy, listTenantPolicies, deleteTenantPolicy };
}
