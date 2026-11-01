import { Model } from 'mongoose';
import type { IPlanDocument } from '~/types/billing';
import planSchema from '~/schema/plan';

export function createPlanModel(mongoose: typeof import('mongoose')): Model<IPlanDocument> {
  return mongoose.models.Plan || mongoose.model<IPlanDocument>('Plan', planSchema);
}
