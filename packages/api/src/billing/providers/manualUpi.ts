import type { IPaymentProvider, PaymentResult, CreateIntentParams, PaymentIntent } from './interface';
import type { IPaymentRecord, BillingMethods } from '@librechat/data-schemas';

export class ManualUpiProvider implements IPaymentProvider {
  private billingMethods: BillingMethods;
  private payeeVpa: string;
  private payeeName: string;

  constructor(deps: { billingMethods: BillingMethods; payeeVpa?: string; payeeName?: string }) {
    this.billingMethods = deps.billingMethods;
    this.payeeVpa = deps.payeeVpa || process.env.UPI_PAYEE_VPA || 'admin@satchida';
    this.payeeName = deps.payeeName || process.env.UPI_PAYEE_NAME || 'Satchida AI';
  }

  async createIntent(params: CreateIntentParams): Promise<PaymentResult<PaymentIntent>> {
    try {
      const { userId, tenantId, plan, upiReference } = params;

      if (!plan || !plan.active) {
        return {
          ok: false,
          error: { code: 'no_such_plan', message: 'The specified plan is inactive or does not exist' },
        };
      }

      const payment = await this.billingMethods.recordPaymentAttempt({
        user: userId,
        tenantId,
        plan: plan.tier,
        amount: plan.price,
        currency: plan.currency || 'INR',
        upiReference: upiReference || `MANUAL-${Date.now()}`,
        submittedAt: new Date(),
        status: 'pending',
        provider: 'manual',
      });

      // Format UPI URI: upi://pay?pa=<vpa>&pn=<name>&am=<amount>&cu=<cu>&tn=<note>
      const note = encodeURIComponent(`Plan ${plan.displayName} - User ${userId}`);
      const qrPayload = `upi://pay?pa=${this.payeeVpa}&pn=${encodeURIComponent(this.payeeName)}&am=${plan.price}&cu=${plan.currency || 'INR'}&tn=${note}`;

      return {
        ok: true,
        value: {
          paymentId: payment.id,
          qrPayload,
          payeeVpa: this.payeeVpa,
          amount: plan.price,
          currency: plan.currency || 'INR',
          status: payment.status,
        },
      };
    } catch (err: unknown) {
      return {
        ok: false,
        error: { code: 'intent_creation_failed', message: 'Failed to create payment intent' },
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
    } catch (err: unknown) {
      return {
        ok: false,
        error: { code: 'verification_failed', message: 'Failed to verify payment' },
      };
    }
  }
}
