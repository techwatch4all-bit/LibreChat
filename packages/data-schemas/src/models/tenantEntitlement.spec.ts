import mongoose from 'mongoose';
import { createModels } from './index';

it('registers TenantEntitlement with tenant isolation', () => {
  const database = new mongoose.Mongoose();
  const models = createModels(database);
  const schema = models.TenantEntitlement.schema;
  expect(models.TenantEntitlement.modelName).toBe('TenantEntitlement');
  expect(
    (schema as unknown as Record<symbol, boolean>)[Symbol.for('librechat:tenantIsolation')],
  ).toBe(true);
  expect(schema.path('tenantId')).toBeDefined();
  expect(schema.indexes()).toEqual(
    expect.arrayContaining([
      expect.arrayContaining([
        expect.objectContaining({ tenantId: 1 }),
        expect.objectContaining({ unique: true }),
      ]),
      expect.arrayContaining([expect.objectContaining({ status: 1, expiresAt: 1 })]),
    ]),
  );
});
