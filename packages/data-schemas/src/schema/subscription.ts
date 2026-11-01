import { Schema } from 'mongoose';
import { SUBSCRIPTION_STATUSES, PLAN_TIERS } from '~/types/billing';
import type { ISubscriptionRecord, ISubscriptionDocument } from '~/types/billing';

const subscriptionSchema: Schema<ISubscriptionDocument> = new Schema<ISubscriptionDocument>(
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
    status: {
      type: String,
      enum: SUBSCRIPTION_STATUSES,
      required: true,
      default: 'pending_payment',
      index: true,
    },
    seatCount: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    lastPaymentRef: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

subscriptionSchema.index({ tenantId: 1, status: 1 });
subscriptionSchema.index({ user: 1, status: 1 });

export default subscriptionSchema;
