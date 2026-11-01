import { Schema } from 'mongoose';
import { PAYMENT_STATUSES, PLAN_TIERS } from '~/types/billing';
import type { IPaymentRecord, IPaymentDocument } from '~/types/billing';

const paymentSchema: Schema<IPaymentDocument> = new Schema<IPaymentDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tenantId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    plan: {
      type: String,
      enum: PLAN_TIERS,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: 'INR',
      uppercase: true,
      trim: true,
    },
    upiReference: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    submittedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      required: true,
      default: 'pending',
      index: true,
    },
    approvingOperator: {
      type: String,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
      trim: true,
    },
    provider: {
      type: String,
      enum: ['manual', 'razorpay'],
      required: true,
      default: 'manual',
    },
    providerMetadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  },
);

paymentSchema.index({ tenantId: 1, status: 1 });
paymentSchema.index({ user: 1, status: 1 });

export default paymentSchema;
