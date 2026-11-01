import type { Document, Types } from 'mongoose';

export const SUBSCRIPTION_STATUSES = [
  'pending_payment',
  'active',
  'expired',
  'revoked',
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const PAYMENT_STATUSES = [
  'pending',
  'approved',
  'rejected',
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PLAN_TIERS = [
  'basic',
  'standard',
  'pro',
  'family',
  'enterprise',
  'privacy',
] as const;

export type PlanTier = (typeof PLAN_TIERS)[number];

/** Plan definition - stored in DB or config */
export interface IPlanRecord {
  id?: string;
  tier: PlanTier;
  displayName: string;
  description?: string;
  price: number;
  currency: string;
  seatLimit: number;
  tokenAllowance: number;
  refillIntervalValue: number;
  refillIntervalUnit: 'days' | 'weeks' | 'months';
  active: boolean;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Subscription document type - plain object representation */
export interface ISubscriptionRecord {
  id: string;
  user: string;
  tenantId: string;
  plan: PlanTier;
  status: SubscriptionStatus;
  seatCount: number;
  startedAt?: Date | null;
  expiresAt?: Date | null;
  cancelledAt?: Date | null;
  lastPaymentRef?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Payment document type - UPI / Manual payment verification record */
export interface IPaymentRecord {
  id: string;
  user: string;
  tenantId: string;
  plan: PlanTier;
  amount: number;
  currency: string;
  upiReference: string;
  submittedAt: Date;
  status: PaymentStatus;
  approvingOperator?: string | null;
  approvedAt?: Date | null;
  rejectionReason?: string | null;
  provider: 'manual' | 'razorpay';
  providerMetadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Filter parameters for operator reconciliation */
export interface ReconciliationFilterParams {
  status?: PaymentStatus;
  plan?: PlanTier;
  tenantId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
  search?: string;
}

/** Single item in the operator reconciliation ledger */
export interface ReconciliationItem {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  tenantId: string;
  plan: PlanTier;
  amount: number;
  currency: string;
  upiReference: string;
  status: PaymentStatus;
  submittedAt: string;
  approvingOperator?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  userRegisteredAt?: string;
  userLastAuth?: string;
  provider: string;
}

export interface ReconciliationResponse {
  items: ReconciliationItem[];
  total: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

/**
 * Mongoose document interfaces. Reference fields (`user`, `approvingOperator`) are
 * `Types.ObjectId` on the document (what the schema stores), while the plain
 * record types above keep them as `string` for input/return values. This mirrors
 * the `IBalance` interface in `types/balance.ts`: extend `Document` and redeclare
 * any clashing reference fields. `id` is dropped from the records so Mongoose's
 * `Document.id` does not conflict.
 */
export interface IPlanDocument extends Omit<IPlanRecord, 'id'>, Document {}

export interface ISubscriptionDocument extends Omit<ISubscriptionRecord, 'id' | 'user'>, Document {
  user: Types.ObjectId;
}

export interface IPaymentDocument extends Omit<IPaymentRecord, 'id' | 'user' | 'approvingOperator'>, Document {
  user: Types.ObjectId;
  /** Operator user id or 'system'; stored as a plain string because the value may
   *  not be a valid ObjectId (e.g. the 'system' fallback). */
  approvingOperator: string | null;
}
