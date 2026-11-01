import { Model } from 'mongoose';
import type { IPaymentDocument } from '~/types/billing';
import paymentSchema from '~/schema/payment';

export function createPaymentModel(mongoose: typeof import('mongoose')): Model<IPaymentDocument> {
  return mongoose.models.Payment || mongoose.model<IPaymentDocument>('Payment', paymentSchema);
}
