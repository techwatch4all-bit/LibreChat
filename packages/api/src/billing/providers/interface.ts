import type { IPaymentRecord, IPlanRecord, PlanTier } from '@librechat/data-schemas';

export type PaymentResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message?: string } };

export interface CreateIntentParams {
  userId: string;
  tenantId: string;
  plan: IPlanRecord;
  upiReference?: string;
}

export interface PaymentIntent {
  paymentId: string;
  qrPayload?: string;
  payeeVpa?: string;
  amount: number;
  currency: string;
  status: string;
}

export interface IPaymentProvider {
  createIntent: (params: CreateIntentParams) => Promise<PaymentResult<PaymentIntent>>;
  verifyPayment: (paymentId: string, reference: string) => Promise<PaymentResult<IPaymentRecord>>;
}
