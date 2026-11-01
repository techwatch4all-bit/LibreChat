import { Schema, Document } from 'mongoose';
import { REFILL_INTERVAL_UNITS } from 'librechat-data-provider';
import { PLAN_TIERS } from '~/types/billing';
import type { IPlanRecord } from '~/types/billing';

export type IPlanDocument = IPlanRecord & Document;

const planSchema: Schema<IPlanDocument> = new Schema<IPlanDocument>(
  {
    tier: {
      type: String,
      enum: PLAN_TIERS,
      required: true,
      unique: true,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    currency: {
      type: String,
      required: true,
      default: 'INR',
      uppercase: true,
      trim: true,
    },
    seatLimit: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    tokenAllowance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    refillIntervalValue: {
      type: Number,
      required: true,
      default: 30,
      min: 1,
    },
    refillIntervalUnit: {
      type: String,
      enum: REFILL_INTERVAL_UNITS,
      required: true,
      default: 'days',
    },
    active: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  },
);

export default planSchema;
