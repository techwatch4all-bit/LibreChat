import { Model } from 'mongoose';
import type * as t from '~/types';
import { applyTenantIsolation } from './plugins/tenantIsolation';
import tenantPolicySchema from '~/schema/tenantPolicy';

applyTenantIsolation(tenantPolicySchema);

export function createTenantPolicyModel(
  mongoose: typeof import('mongoose'),
): Model<t.ITenantPolicy> {
  return (
    mongoose.models.TenantPolicy ||
    mongoose.model<t.ITenantPolicy>('TenantPolicy', tenantPolicySchema)
  );
}
