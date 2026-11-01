import { Types } from 'mongoose';
import type { Model } from 'mongoose';
import type {
  IPlanRecord,
  ISubscriptionRecord,
  IPaymentRecord,
  PlanTier,
  SubscriptionStatus,
  PaymentStatus,
  ReconciliationFilterParams,
  ReconciliationResponse,
  ReconciliationItem,
  IPlanDocument,
  ISubscriptionDocument,
  IPaymentDocument,
} from '~/types/billing';
import type { IUser } from '~/types';

export interface BillingMethods {
  getPlanByTier: (tier: PlanTier) => Promise<IPlanRecord | null>;
  listActivePlans: () => Promise<IPlanRecord[]>;
  upsertPlan: (plan: IPlanRecord) => Promise<IPlanRecord>;

  getSubscriptionByUser: (userId: string) => Promise<ISubscriptionRecord | null>;
  getSubscriptionByTenant: (tenantId: string) => Promise<ISubscriptionRecord | null>;
  createSubscription: (data: Omit<ISubscriptionRecord, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ISubscriptionRecord>;
  updateSubscriptionStatus: (
    subscriptionId: string,
    status: SubscriptionStatus,
    expiresAt?: Date | null,
  ) => Promise<ISubscriptionRecord | null>;

  recordPaymentAttempt: (data: Omit<IPaymentRecord, 'id' | 'createdAt' | 'updatedAt'>) => Promise<IPaymentRecord>;
  getPaymentById: (paymentId: string) => Promise<IPaymentRecord | null>;
  findPaymentByUpiRef: (upiReference: string) => Promise<IPaymentRecord | null>;
  approvePayment: (paymentId: string, operatorId: string) => Promise<{ ok: boolean; payment?: IPaymentRecord; error?: string }>;
  rejectPayment: (paymentId: string, operatorId: string, reason: string) => Promise<{ ok: boolean; payment?: IPaymentRecord; error?: string }>;

  listReconciliationLedger: (params: ReconciliationFilterParams) => Promise<ReconciliationResponse>;
}

export function createBillingMethods(mongoose: typeof import('mongoose')): BillingMethods {
  const Plan = () => mongoose.models.Plan as Model<IPlanDocument>;
  const Subscription = () => mongoose.models.Subscription as Model<ISubscriptionDocument>;
  const Payment = () => mongoose.models.Payment as Model<IPaymentDocument>;
  const User = () => mongoose.models.User as Model<IUser>;

  const getPlanByTier = async (tier: PlanTier): Promise<IPlanRecord | null> => {
    const doc = await Plan().findOne({ tier }).lean();
    if (!doc) return null;
    return {
      id: doc._id.toString(),
      tier: doc.tier,
      displayName: doc.displayName,
      description: doc.description,
      price: doc.price,
      currency: doc.currency,
      seatLimit: doc.seatLimit,
      tokenAllowance: doc.tokenAllowance,
      refillIntervalValue: doc.refillIntervalValue,
      refillIntervalUnit: doc.refillIntervalUnit,
      active: doc.active,
      metadata: doc.metadata,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  };

  const listActivePlans = async (): Promise<IPlanRecord[]> => {
    const docs = await Plan().find({ active: true }).lean();
    return docs.map((doc) => ({
      id: doc._id.toString(),
      tier: doc.tier,
      displayName: doc.displayName,
      description: doc.description,
      price: doc.price,
      currency: doc.currency,
      seatLimit: doc.seatLimit,
      tokenAllowance: doc.tokenAllowance,
      refillIntervalValue: doc.refillIntervalValue,
      refillIntervalUnit: doc.refillIntervalUnit,
      active: doc.active,
      metadata: doc.metadata,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));
  };

  const upsertPlan = async (plan: IPlanRecord): Promise<IPlanRecord> => {
    const doc = await Plan().findOneAndUpdate(
      { tier: plan.tier },
      { $set: plan },
      { upsert: true, new: true, lean: true },
    );
    if (!doc) {
      throw new Error('Failed to upsert plan');
    }
    return {
      id: doc._id.toString(),
      tier: doc.tier,
      displayName: doc.displayName,
      description: doc.description,
      price: doc.price,
      currency: doc.currency,
      seatLimit: doc.seatLimit,
      tokenAllowance: doc.tokenAllowance,
      refillIntervalValue: doc.refillIntervalValue,
      refillIntervalUnit: doc.refillIntervalUnit,
      active: doc.active,
      metadata: doc.metadata,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  };

  const getSubscriptionByUser = async (userId: string): Promise<ISubscriptionRecord | null> => {
    if (!Types.ObjectId.isValid(userId)) return null;
    const doc = await Subscription().findOne({ user: userId }).sort({ createdAt: -1 }).lean();
    if (!doc) return null;
    return {
      id: doc._id.toString(),
      user: doc.user.toString(),
      tenantId: doc.tenantId,
      plan: doc.plan,
      status: doc.status,
      seatCount: doc.seatCount,
      startedAt: doc.startedAt,
      expiresAt: doc.expiresAt,
      cancelledAt: doc.cancelledAt,
      lastPaymentRef: doc.lastPaymentRef,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  };

  const getSubscriptionByTenant = async (tenantId: string): Promise<ISubscriptionRecord | null> => {
    const doc = await Subscription().findOne({ tenantId }).sort({ createdAt: -1 }).lean();
    if (!doc) return null;
    return {
      id: doc._id.toString(),
      user: doc.user.toString(),
      tenantId: doc.tenantId,
      plan: doc.plan,
      status: doc.status,
      seatCount: doc.seatCount,
      startedAt: doc.startedAt,
      expiresAt: doc.expiresAt,
      cancelledAt: doc.cancelledAt,
      lastPaymentRef: doc.lastPaymentRef,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  };

  const createSubscription = async (
    data: Omit<ISubscriptionRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ISubscriptionRecord> => {
    const doc = await Subscription().create(data);
    const lean = doc.toObject();
    return {
      id: lean._id.toString(),
      user: lean.user.toString(),
      tenantId: lean.tenantId,
      plan: lean.plan,
      status: lean.status,
      seatCount: lean.seatCount,
      startedAt: lean.startedAt,
      expiresAt: lean.expiresAt,
      cancelledAt: lean.cancelledAt,
      lastPaymentRef: lean.lastPaymentRef,
      createdAt: lean.createdAt,
      updatedAt: lean.updatedAt,
    };
  };

  const updateSubscriptionStatus = async (
    subscriptionId: string,
    status: SubscriptionStatus,
    expiresAt?: Date | null,
  ): Promise<ISubscriptionRecord | null> => {
    const update: Record<string, unknown> = { status };
    if (expiresAt !== undefined) {
      update.expiresAt = expiresAt;
    }
    if (status === 'active') {
      update.startedAt = new Date();
    }
    const doc = await Subscription().findByIdAndUpdate(subscriptionId, { $set: update }, { new: true, lean: true });
    if (!doc) return null;
    return {
      id: doc._id.toString(),
      user: doc.user.toString(),
      tenantId: doc.tenantId,
      plan: doc.plan,
      status: doc.status,
      seatCount: doc.seatCount,
      startedAt: doc.startedAt,
      expiresAt: doc.expiresAt,
      cancelledAt: doc.cancelledAt,
      lastPaymentRef: doc.lastPaymentRef,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  };

  const recordPaymentAttempt = async (
    data: Omit<IPaymentRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<IPaymentRecord> => {
    const doc = await Payment().create(data);
    const lean = doc.toObject();
    return {
      id: lean._id.toString(),
      user: lean.user.toString(),
      tenantId: lean.tenantId,
      plan: lean.plan,
      amount: lean.amount,
      currency: lean.currency,
      upiReference: lean.upiReference,
      submittedAt: lean.submittedAt,
      status: lean.status,
      approvingOperator: lean.approvingOperator?.toString() ?? null,
      approvedAt: lean.approvedAt,
      rejectionReason: lean.rejectionReason,
      provider: lean.provider,
      providerMetadata: lean.providerMetadata,
      createdAt: lean.createdAt,
      updatedAt: lean.updatedAt,
    };
  };

  const getPaymentById = async (paymentId: string): Promise<IPaymentRecord | null> => {
    const doc = await Payment().findById(paymentId).lean();
    if (!doc) return null;
    return {
      id: doc._id.toString(),
      user: doc.user.toString(),
      tenantId: doc.tenantId,
      plan: doc.plan,
      amount: doc.amount,
      currency: doc.currency,
      upiReference: doc.upiReference,
      submittedAt: doc.submittedAt,
      status: doc.status,
      approvingOperator: doc.approvingOperator?.toString() ?? null,
      approvedAt: doc.approvedAt,
      rejectionReason: doc.rejectionReason,
      provider: doc.provider,
      providerMetadata: doc.providerMetadata,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  };

  const findPaymentByUpiRef = async (upiReference: string): Promise<IPaymentRecord | null> => {
    const doc = await Payment().findOne({ upiReference: upiReference.trim() }).lean();
    if (!doc) return null;
    return {
      id: doc._id.toString(),
      user: doc.user.toString(),
      tenantId: doc.tenantId,
      plan: doc.plan,
      amount: doc.amount,
      currency: doc.currency,
      upiReference: doc.upiReference,
      submittedAt: doc.submittedAt,
      status: doc.status,
      approvingOperator: doc.approvingOperator?.toString() ?? null,
      approvedAt: doc.approvedAt,
      rejectionReason: doc.rejectionReason,
      provider: doc.provider,
      providerMetadata: doc.providerMetadata,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  };

  const approvePayment = async (
    paymentId: string,
    operatorId: string,
  ): Promise<{ ok: boolean; payment?: IPaymentRecord; error?: string }> => {
    if (!Types.ObjectId.isValid(paymentId)) return { ok: false, error: 'payment_not_found' };
    const payment = await Payment().findById(paymentId);
    if (!payment) return { ok: false, error: 'payment_not_found' };
    if (payment.status === 'approved') return { ok: false, error: 'already_approved' };

    payment.status = 'approved';
    payment.approvingOperator = operatorId;
    payment.approvedAt = new Date();
    await payment.save();

    const lean = payment.toObject();
    return {
      ok: true,
      payment: {
        id: lean._id.toString(),
        user: lean.user.toString(),
        tenantId: lean.tenantId,
        plan: lean.plan,
        amount: lean.amount,
        currency: lean.currency,
        upiReference: lean.upiReference,
        submittedAt: lean.submittedAt,
        status: lean.status,
        approvingOperator: lean.approvingOperator?.toString() ?? null,
        approvedAt: lean.approvedAt,
        rejectionReason: lean.rejectionReason,
        provider: lean.provider,
        providerMetadata: lean.providerMetadata,
        createdAt: lean.createdAt,
        updatedAt: lean.updatedAt,
      },
    };
  };

  const rejectPayment = async (
    paymentId: string,
    operatorId: string,
    reason: string,
  ): Promise<{ ok: boolean; payment?: IPaymentRecord; error?: string }> => {
    if (!Types.ObjectId.isValid(paymentId)) return { ok: false, error: 'payment_not_found' };
    const payment = await Payment().findById(paymentId);
    if (!payment) return { ok: false, error: 'payment_not_found' };
    if (payment.status === 'approved') return { ok: false, error: 'cannot_reject_approved' };

    payment.status = 'rejected';
    payment.approvingOperator = operatorId;
    payment.rejectionReason = reason;
    await payment.save();

    const lean = payment.toObject();
    return {
      ok: true,
      payment: {
        id: lean._id.toString(),
        user: lean.user.toString(),
        tenantId: lean.tenantId,
        plan: lean.plan,
        amount: lean.amount,
        currency: lean.currency,
        upiReference: lean.upiReference,
        submittedAt: lean.submittedAt,
        status: lean.status,
        approvingOperator: lean.approvingOperator?.toString() ?? null,
        approvedAt: lean.approvedAt,
        rejectionReason: lean.rejectionReason,
        provider: lean.provider,
        providerMetadata: lean.providerMetadata,
        createdAt: lean.createdAt,
        updatedAt: lean.updatedAt,
      },
    };
  };

  const listReconciliationLedger = async (
    params: ReconciliationFilterParams,
  ): Promise<ReconciliationResponse> => {
    const query: Record<string, unknown> = {};
    if (params.status) query.status = params.status;
    if (params.plan) query.plan = params.plan;
    if (params.tenantId) query.tenantId = params.tenantId;
    if (params.from || params.to) {
      query.submittedAt = {};
      if (params.from) (query.submittedAt as Record<string, unknown>).$gte = params.from;
      if (params.to) (query.submittedAt as Record<string, unknown>).$lte = params.to;
    }
    if (params.search) {
      query.upiReference = { $regex: params.search.trim(), $options: 'i' };
    }

    const limit = Math.min(Math.max(params.limit ?? 25, 1), 200);
    const offset = Math.max(params.offset ?? 0, 0);

    const [payments, total, pendingCount, approvedCount, rejectedCount] = await Promise.all([
      Payment().find(query).sort({ submittedAt: -1 }).skip(offset).limit(limit).lean(),
      Payment().countDocuments(query),
      Payment().countDocuments({ status: 'pending' }),
      Payment().countDocuments({ status: 'approved' }),
      Payment().countDocuments({ status: 'rejected' }),
    ]);

    const userIds = Array.from(new Set(payments.map((p) => p.user)));
    const users = await User().find({ _id: { $in: userIds } }, 'email name username createdAt lastLogin').lean();
    const userMap = new Map<string, { email: string; name?: string; createdAt?: Date; lastLogin?: Date }>();
    for (const u of users) {
      userMap.set(u._id.toString(), {
        email: u.email,
        name: u.name || u.username,
        createdAt: u.createdAt,
        lastLogin: (u as Record<string, unknown>).lastLogin as Date | undefined,
      });
    }

    const items: ReconciliationItem[] = payments.map((p) => {
      const u = userMap.get(p.user.toString());
      return {
        id: p._id.toString(),
        userId: p.user.toString(),
        userEmail: u?.email ?? 'unknown',
        userName: u?.name,
        tenantId: p.tenantId,
        plan: p.plan,
        amount: p.amount,
        currency: p.currency,
        upiReference: p.upiReference,
        status: p.status,
        submittedAt: p.submittedAt.toISOString(),
        approvingOperator: p.approvingOperator?.toString() ?? null,
        approvedAt: p.approvedAt?.toISOString() ?? null,
        rejectionReason: p.rejectionReason ?? null,
        userRegisteredAt: u?.createdAt?.toISOString(),
        userLastAuth: u?.lastLogin?.toISOString(),
        provider: p.provider,
      };
    });

    return {
      items,
      total,
      pendingCount,
      approvedCount,
      rejectedCount,
    };
  };

  return {
    getPlanByTier,
    listActivePlans,
    upsertPlan,
    getSubscriptionByUser,
    getSubscriptionByTenant,
    createSubscription,
    updateSubscriptionStatus,
    recordPaymentAttempt,
    getPaymentById,
    findPaymentByUpiRef,
    approvePayment,
    rejectPayment,
    listReconciliationLedger,
  };
}
