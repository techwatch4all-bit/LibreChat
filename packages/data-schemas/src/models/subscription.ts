import { Model } from 'mongoose';
import type { ISubscriptionDocument } from '~/types/billing';
import subscriptionSchema from '~/schema/subscription';

export function createSubscriptionModel(
  mongoose: typeof import('mongoose'),
): Model<ISubscriptionDocument> {
  return (
    mongoose.models.Subscription ||
    mongoose.model<ISubscriptionDocument>('Subscription', subscriptionSchema)
  );
}
