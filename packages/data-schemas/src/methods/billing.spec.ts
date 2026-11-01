import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { IPlanRecord, IPaymentRecord } from '~/types';
import { createModels } from '~/models';
import { createBillingMethods } from './billing';

let mongoServer: MongoMemoryServer;
let methods: ReturnType<typeof createBillingMethods>;

const samplePlan: IPlanRecord = {
  tier: 'pro',
  displayName: 'Pro',
  description: 'Pro tier',
  price: 499,
  currency: 'INR',
  seatLimit: 5,
  tokenAllowance: 5000,
  refillIntervalValue: 1,
  refillIntervalUnit: 'months',
  active: true,
};

const basePaymentInput = (
  overrides: Partial<Omit<IPaymentRecord, 'id' | 'createdAt' | 'updatedAt'>> = {},
): Omit<IPaymentRecord, 'id' | 'createdAt' | 'updatedAt'> => ({
  user: new mongoose.Types.ObjectId().toString(),
  tenantId: 'satchida-master',
  plan: 'pro',
  amount: 499,
  currency: 'INR',
  upiReference: 'UPI-REF-1',
  submittedAt: new Date(),
  status: 'pending',
  provider: 'manual',
  ...overrides,
});

const createUser = async (email: string): Promise<string> => {
  const User = mongoose.models.User;
  const user = new User({ email, name: email.split('@')[0], username: email.split('@')[0] });
  await user.save();
  return user._id.toString();
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  createModels(mongoose);
  methods = createBillingMethods(mongoose);
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
});

describe('createBillingMethods', () => {
  describe('plans', () => {
    test('upsertPlan inserts a new plan and returns its id', async () => {
      const result = await methods.upsertPlan(samplePlan);
      expect(result.id).toBeDefined();
      expect(result.tier).toBe('pro');
      expect(result.price).toBe(499);
    });

    test('upsertPlan updates an existing plan by tier', async () => {
      await methods.upsertPlan(samplePlan);
      const updated = await methods.upsertPlan({ ...samplePlan, price: 599 });
      expect(updated.price).toBe(599);
    });

    test('getPlanByTier returns null for unknown tiers', async () => {
      expect(await methods.getPlanByTier('basic')).toBeNull();
    });

    test('getPlanByTier returns the stored plan', async () => {
      await methods.upsertPlan(samplePlan);
      const plan = await methods.getPlanByTier('pro');
      expect(plan?.displayName).toBe('Pro');
    });

    test('listActivePlans returns only active plans', async () => {
      await methods.upsertPlan({ ...samplePlan, tier: 'pro', active: true });
      await methods.upsertPlan({ ...samplePlan, tier: 'standard', active: true });
      await methods.upsertPlan({ ...samplePlan, tier: 'enterprise', active: false });
      const active = await methods.listActivePlans();
      expect(active).toHaveLength(2);
      expect(active.map((p) => p.tier).sort()).toEqual(['pro', 'standard']);
    });
  });

  describe('subscriptions', () => {
    test('getSubscriptionByUser returns null when absent', async () => {
      expect(await methods.getSubscriptionByUser('nonexistent')).toBeNull();
    });

    test('createSubscription stores and returns a subscription', async () => {
      await methods.upsertPlan(samplePlan);
      const uid = await createUser('sub@example.com');
      const sub = await methods.createSubscription({
        user: uid,
        tenantId: 'satchida-master',
        plan: 'pro',
        status: 'active',
        seatCount: 5,
        startedAt: new Date(),
        expiresAt: null,
        cancelledAt: null,
        lastPaymentRef: null,
      });
      expect(sub.id).toBeDefined();
      expect(sub.status).toBe('active');
      const fetched = await methods.getSubscriptionByUser(uid);
      expect(fetched?.plan).toBe('pro');
    });

    test('updateSubscriptionStatus flips status and sets startedAt', async () => {
      await methods.upsertPlan(samplePlan);
      const uid = await createUser('sub2@example.com');
      const sub = await methods.createSubscription({
        user: uid,
        tenantId: 'satchida-master',
        plan: 'pro',
        status: 'pending_payment',
        seatCount: 1,
      });
      const updated = await methods.updateSubscriptionStatus(sub.id, 'active', null);
      expect(updated?.status).toBe('active');
      expect(updated?.startedAt).not.toBeNull();
    });
  });

  describe('payments + reconciliation', () => {
    test('recordPaymentAttempt persists and getPaymentById fetches it', async () => {
      const payment = await methods.recordPaymentAttempt(basePaymentInput());
      expect(payment.id).toBeDefined();
      expect(payment.status).toBe('pending');
      const fetched = await methods.getPaymentById(payment.id);
      expect(fetched?.upiReference).toBe('UPI-REF-1');
    });

    test('findPaymentByUpiRef trims whitespace for an exact lookup', async () => {
      await methods.recordPaymentAttempt(basePaymentInput({ upiReference: 'UPI-ABC' }));
      const found = await methods.findPaymentByUpiRef('  UPI-ABC  ');
      expect(found?.upiReference).toBe('UPI-ABC');
    });

    test('approvePayment transitions pending -> approved and ignores duplicates', async () => {
      await methods.upsertPlan(samplePlan);
      const uid = await createUser('pay@example.com');
      const payment = await methods.recordPaymentAttempt(basePaymentInput({ user: uid }));
      const first = await methods.approvePayment(payment.id, 'operator-1');
      expect(first.ok).toBe(true);
      expect(first.payment?.status).toBe('approved');
      const dup = await methods.approvePayment(payment.id, 'operator-2');
      expect(dup.ok).toBe(false);
      expect(dup.error).toBe('already_approved');
    });

    test('approvePayment returns error for unknown ids', async () => {
      const result = await methods.approvePayment('not-a-real-id', 'operator-1');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('payment_not_found');
    });

    test('rejectPayment transitions and cannot reject an approved payment', async () => {
      const uid = await createUser('rej@example.com');
      const payment = await methods.recordPaymentAttempt(basePaymentInput({ user: uid }));
      await methods.approvePayment(payment.id, 'operator-1');
      const rej = await methods.rejectPayment(payment.id, 'operator-2', 'fraud');
      expect(rej.ok).toBe(false);
      expect(rej.error).toBe('cannot_reject_approved');
    });

    test('listReconciliationLedger paginates, counts statuses, and joins users', async () => {
      const uid = await createUser('ledger@example.com');
      await methods.recordPaymentAttempt(basePaymentInput({ user: uid, status: 'pending' }));
      const approved = await methods.recordPaymentAttempt(
        basePaymentInput({ user: uid, status: 'pending', upiReference: 'APPROVED-1' }),
      );
      await methods.approvePayment(approved.id, 'operator-1');
      await methods.recordPaymentAttempt(
        basePaymentInput({ user: uid, status: 'rejected', upiReference: 'REJ-1' }),
      );

      const page = await methods.listReconciliationLedger({ limit: 25, offset: 0 });
      expect(page.total).toBe(3);
      expect(page.pendingCount).toBe(1);
      expect(page.approvedCount).toBe(1);
      expect(page.rejectedCount).toBe(1);
      const byRef = page.items.find((i) => i.upiReference === 'APPROVED-1');
      expect(byRef?.status).toBe('approved');
      expect(byRef?.userEmail).toBe('ledger@example.com');
      expect(byRef?.approvingOperator).toBe('operator-1');
    });

    test('listReconciliationLedger applies search and status filters', async () => {
      const uid = await createUser('flt@example.com');
      await methods.recordPaymentAttempt(basePaymentInput({ user: uid, upiReference: 'MATCH-1' }));
      await methods.recordPaymentAttempt(
        basePaymentInput({ user: uid, upiReference: 'NOMATCH', status: 'approved' }),
      );
      const searched = await methods.listReconciliationLedger({ limit: 25, offset: 0, search: 'match-1' });
      expect(searched.total).toBe(1);
      expect(searched.items[0].upiReference).toBe('MATCH-1');
    });
  });
});
