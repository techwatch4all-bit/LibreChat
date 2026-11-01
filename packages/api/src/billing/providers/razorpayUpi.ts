import type { IPaymentProvider, PaymentResult, CreateIntentParams, PaymentIntent } from './interface';
import type { IPaymentRecord, BillingMethods } from '@librechat/data-schemas';

export class RazorpayUpiProvider implements IPaymentProvider {
  private billingMethods: BillingMethods;
  private keyId: string;
  private keySecret: string;

  constructor(deps: { billingMethods: BillingMethods; keyId?: string; keySecret?: string }) {
    this.billingMethods = deps.billingMethods;
    this.keyId = deps.keyId || process.env.RAZORPAY_KEY_ID || '';
    this.keySecret = deps.keySecret || process.env.RAZORPAY_KEY_SECRET || '';
  }

  async createIntent(params: CreateIntentParams): Promise<PaymentResult<PaymentIntent>> {
    if (!this.keyId || !this.keySecret) {
      return {
        ok: false,
        error: { code: 'gateway_not_configured', message: 'Razorpay credentials not configured' },
      };
    }

    try {
      const { userId, tenantId, plan } = params;

      const payment = await this.billingMethods.recordPaymentAttempt({
        user: userId,
        tenantId,
        plan: plan.tier,
        amount: plan.price,
        currency: plan.currency || 'INR',
        upiReference: `RZP-${Date.now()}`,
        submittedAt: new Date(),
        status: 'pending',
        provider: 'razorpay',
      });

      return {
        ok: true,
        value: {
          paymentId: payment.id,
          amount: plan.price,
          currency: plan.currency || 'INR',
          status: payment.status,
        },
      };
    } catch {
      return {
        ok: false,
        error: { code: 'intent_creation_failed', message: 'Failed to create Razorpay intent' },
      };
    }
  }

  async verifyPayment(paymentId: string, reference: string): Promise<PaymentResult<IPaymentRecord>> {
    try {
      const payment = await this.billingMethods.getPaymentById(paymentId);
      if (!payment) {
        return {
          ok: false,
          error: { code: 'payment_not_found', message: 'Payment record not found' },
        };
      }
      return { ok: true, value: payment };
    } catch {
      return {
        ok: false,
        error: { code: 'verification_failed', message: 'Failed to verify Razorpay payment' },
      };
    }
  }
}
