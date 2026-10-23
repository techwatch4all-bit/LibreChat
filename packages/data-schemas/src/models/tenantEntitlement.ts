import { Model } from 'mongoose';
import type * as t from '~/types';
import tenantEntitlementSchema from '~/schema/tenantEntitlement';
import { applyTenantIsolation } from './plugins/tenantIsolation';

applyTenantIsolation(tenantEntitlementSchema);

export function createTenantEntitlementModel(
  mongoose: typeof import('mongoose'),
): Model<t.ITenantEntitlement> {
  return (
    mongoose.models.TenantEntitlement ||
    mongoose.model<t.ITenantEntitlement>('TenantEntitlement', tenantEntitlementSchema)
  );
}
