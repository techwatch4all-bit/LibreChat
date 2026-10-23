import mongoose from 'mongoose';
import { createModels } from '../index';

/** Global symbol set by applyTenantIsolation() on every schema it processes. */
const TENANT_ISOLATION_APPLIED = Symbol.for('librechat:tenantIsolation');

/** Models with explicit cross-tenant query policy rather than ambient isolation. */
const MANUAL_TENANT_SCOPING = new Set<string>([
  'SystemGrant',
  'SkillSyncStatus',
  'AuditLog',
  'RefreshTokenBridge',
]);

function isPluginApplied(schema: mongoose.Schema): boolean {
  return (schema as unknown as { [key: symbol]: boolean })[TENANT_ISOLATION_APPLIED] === true;
}

describe('tenant-isolation plugin coverage', () => {
  beforeAll(() => {
    createModels(mongoose);
  });

  it('applies the tenant-isolation plugin to every model that has a tenantId field', () => {
    const missing: string[] = [];

    for (const [name, model] of Object.entries(mongoose.models)) {
      const hasTenantId = Boolean(model.schema.path('tenantId'));
      if (!hasTenantId || MANUAL_TENANT_SCOPING.has(name)) {
        continue;
      }
      if (!isPluginApplied(model.schema)) {
        missing.push(name);
      }
    }

    expect(missing).toEqual([]);
  });

  it('uses tenant-isolation for TenantEntitlement seat and plan records', () => {
    const model = mongoose.models.TenantEntitlement;
    expect(model).toBeDefined();
    expect(Boolean(model.schema.path('tenantId'))).toBe(true);
    expect(isPluginApplied(model.schema)).toBe(true);
    expect(model.schema.indexes()).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([
          expect.objectContaining({ tenantId: 1 }),
          expect.objectContaining({ unique: true }),
        ]),
      ]),
    );
  });

  it('keeps the manual-scoping allowlist accurate (tenantId field, no plugin)', () => {
    for (const name of MANUAL_TENANT_SCOPING) {
      const model = mongoose.models[name];
      expect(model).toBeDefined();
      expect(Boolean(model.schema.path('tenantId'))).toBe(true);
      expect(isPluginApplied(model.schema)).toBe(false);
    }
  });
});
