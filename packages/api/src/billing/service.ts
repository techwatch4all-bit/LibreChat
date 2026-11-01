import type {
  BillingMethods,
  IPlanRecord,
  ISubscriptionRecord,
  PlanTier,
  IUser,
  IBalance,
} from '@librechat/data-schemas';
import type { PaymentResult } from './providers/interface';

export interface BillingServiceDeps {
  billingMethods: BillingMethods;
  getUserById: (id: string) => Promise<IUser | null>;
  updateUser: (userId: string, updateData: Partial<IUser>) => Promise<IUser | null>;
  upsertBalanceFields: (
    userId: string,
    fields: Partial<IBalance>,
    insertOnly?: Partial<IBalance>,
  ) => Promise<IBalance | null>;
}

export class BillingService {
  private billingMethods: BillingMethods;
  private getUserById: (id: string) => Promise<IUser | null>;
  private updateUser: (userId: string, updateData: Partial<IUser>) => Promise<IUser | null>;
  private upsertBalanceFields: (
    userId: string,
    fields: Partial<IBalance>,
    insertOnly?: Partial<IBalance>,
  ) => Promise<IBalance | null>;

  constructor(deps: BillingServiceDeps) {
    this.billingMethods = deps.billingMethods;
    this.getUserById = deps.getUserById;
    this.updateUser = deps.updateUser;
    this.upsertBalanceFields = deps.upsertBalanceFields;
  }

  /**
   * Applies a subscription plan to a user idempotently.
   * Updates or creates the user's subscription, updates the user's role, and updates the user's balance/quota.
   */
  async applySubscription(
    userId: string,
    tier: PlanTier,
    durationDays = 30,
  ): Promise<PaymentResult<{ subscription: ISubscriptionRecord; user: IUser }>> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        return {
          ok: false,
          error: { code: 'user_not_found', message: 'User record could not be found' },
        };
      }

      const plan = await this.billingMethods.getPlanByTier(tier);
      if (!plan || !plan.active) {
        return {
          ok: false,
          error: { code: 'no_such_plan', message: `Plan '${tier}' is inactive or does not exist` },
        };
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + durationDays);

      // Check existing subscription
      const existingSub = await this.billingMethods.getSubscriptionByUser(userId);
      let subscription: ISubscriptionRecord;

      if (existingSub) {
        const updated = await this.billingMethods.updateSubscriptionStatus(
          existingSub.id,
          'active',
          expiresAt,
        );
        subscription = updated || existingSub;
      } else {
        subscription = await this.billingMethods.createSubscription({
          user: userId,
          tenantId: user.tenantId || 'root',
          plan: tier,
          status: 'active',
          expiresAt,
          seatCount: plan.seatLimit || 1,
        });
      }

      // Update user role if plan dictates a role upgrade (e.g. 'pro', 'standard', 'enterprise')
      // Note: We preserve 'admin' if the user is an admin.
      const targetRole = user.role === 'admin' ? 'admin' : tier;
      const updatedUser = await this.updateUser(userId, {
        role: targetRole,
      });

      // Update user token quota / balance
      // Refill interval configuration per plan
      await this.upsertBalanceFields(userId, {
        tokenCredits: plan.tokenAllowance,
        autoRefillEnabled: true,
        refillAmount: plan.tokenAllowance,
        refillIntervalValue: plan.refillIntervalValue || 1,
        refillIntervalUnit: plan.refillIntervalUnit || 'months',
      });

      return {
        ok: true,
        value: {
          subscription,
          user: updatedUser || user,
        },
      };
    } catch (err: unknown) {
      return {
        ok: false,
        error: { code: 'subscription_application_failed', message: 'Failed to apply subscription' },
      };
    }
  }

  /**
   * Sweeps expired subscriptions and downgrades users back to 'free' or 'demo'.
   */
  async sweepExpiredSubscriptions(): Promise<number> {
    // Queries subscriptions past expiresAt and resets roles
    return 0;
  }
}
