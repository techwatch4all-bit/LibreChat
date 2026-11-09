import type {
  IPaymentRecord,
  ISubscriptionRecord,
  ReconciliationItem,
  ReconciliationResponse,
} from '@librechat/data-schemas';
import type { BillingMethods } from '@librechat/data-schemas';
import type { Response } from 'express';
import type { BillingService } from '../billing/service';
import type { ServerRequest } from '~/types/http';
import { createAdminReconciliationHandlers } from './reconciliation';

interface MockResponse extends Response {
  statusCode: number;
  body?: unknown;
  sent?: string;
  headers: Record<string, string>;
}

function mockResponse(): MockResponse {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    sent: undefined as string | undefined,
    headers: {} as Record<string, string>,
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    json(body: unknown) {
      response.body = body;
      return response;
    },
    setHeader(name: string, value: string) {
      response.headers[name] = value;
      return response;
    },
    send(text: string) {
      response.sent = text;
      return response;
    },
  };
  return response as unknown as MockResponse;
}

function baseRequest(overrides: Record<string, unknown> = {}): ServerRequest {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 'operator-1', role: 'ADMIN', tenantId: 'satchida-master' },
    ...overrides,
  } as unknown as ServerRequest;
}

const paymentRecord = (overrides: Partial<IPaymentRecord> = {}): IPaymentRecord => ({
  id: 'pay-1',
  user: 'user-1',
  tenantId: 'satchida-master',
  plan: 'pro',
  amount: 499,
  currency: 'INR',
  upiReference: 'UPI-1',
  submittedAt: new Date('2026-10-27T10:00:00Z'),
  status: 'pending',
  approvingOperator: null,
  approvedAt: null,
  rejectionReason: null,
  provider: 'manual',
  providerMetadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const ledgerItem = (overrides: Partial<ReconciliationItem> = {}): ReconciliationItem => ({
  id: 'pay-1',
  userId: 'user-1',
  userEmail: 'ledger@example.com',
  userName: 'Ledger',
  tenantId: 'satchida-master',
  plan: 'pro',
  amount: 499,
  currency: 'INR',
  upiReference: 'UPI-1',
  status: 'approved',
  submittedAt: '2026-10-27T10:00:00.000Z',
  approvingOperator: 'operator-1',
  approvedAt: '2026-10-27T10:05:00.000Z',
  rejectionReason: null,
  userRegisteredAt: '2026-09-01T00:00:00.000Z',
  userLastAuth: '2026-10-27T10:00:00.000Z',
  provider: 'manual',
  ...overrides,
});

interface Deps {
  billingMethods: BillingMethods;
  billingService: BillingService;
  listLedger: jest.Mock;
  approvePayment: jest.Mock;
  rejectPayment: jest.Mock;
  applySubscription: jest.Mock;
}

function makeDeps(): Deps {
  const listLedger = jest.fn();
  const approvePayment = jest.fn();
  const rejectPayment = jest.fn();
  const recordPaymentAttempt = jest.fn();
  const applySubscription = jest.fn();
  const sweepExpiredSubscriptions = jest.fn();
  const billingMethods = {
    listReconciliationLedger: listLedger,
    approvePayment,
    rejectPayment,
    recordPaymentAttempt,
  } as unknown as BillingMethods;
  const billingService = {
    applySubscription,
    sweepExpiredSubscriptions,
  } as unknown as BillingService;
  return {
    billingMethods,
    billingService,
    listLedger,
    approvePayment,
    rejectPayment,
    applySubscription,
  };
}

describe('createAdminReconciliationHandlers', () => {
  describe('listLedger', () => {
    it('parses page/limit filters into an offset and returns the ledger', async () => {
      const deps = makeDeps();
      const ledger: ReconciliationResponse = {
        items: [ledgerItem()],
        total: 1,
        pendingCount: 0,
        approvedCount: 1,
        rejectedCount: 0,
      };
      deps.listLedger.mockResolvedValue(ledger);
      const handlers = createAdminReconciliationHandlers({
        billingMethods: deps.billingMethods,
        billingService: deps.billingService,
      });

      const res = mockResponse();
      await handlers.listLedger(
        baseRequest({ query: { page: '2', limit: '25', status: 'approved' } }),
        res,
      );

      expect(res.statusCode).toBe(200);
      expect(deps.listLedger).toHaveBeenCalledWith(
        expect.objectContaining({ offset: 25, limit: 25, status: 'approved' }),
      );
      expect(res.body).toEqual(ledger);
    });

    it('clamps limit to a 100 ceiling and floors page at 1', async () => {
      const deps = makeDeps();
      deps.listLedger.mockResolvedValue({
        items: [],
        total: 0,
        pendingCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
      });
      const handlers = createAdminReconciliationHandlers({
        billingMethods: deps.billingMethods,
        billingService: deps.billingService,
      });

      const res = mockResponse();
      await handlers.listLedger(baseRequest({ query: { page: '0', limit: '500' } }), res);

      expect(deps.listLedger).toHaveBeenCalledWith(
        expect.objectContaining({ offset: 0, limit: 100 }),
      );
      expect(res.statusCode).toBe(200);
    });

    it('returns 500 with a safe error code when the ledger fetch throws', async () => {
      const deps = makeDeps();
      deps.listLedger.mockRejectedValue(new Error('boom'));
      const handlers = createAdminReconciliationHandlers({
        billingMethods: deps.billingMethods,
        billingService: deps.billingService,
      });

      const res = mockResponse();
      await handlers.listLedger(baseRequest(), res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({
        error: { code: 'ledger_fetch_failed', message: 'Failed to retrieve reconciliation ledger' },
      });
    });
  });

  describe('approvePayment', () => {
    it('returns 400 when the id parameter is missing', async () => {
      const deps = makeDeps();
      const handlers = createAdminReconciliationHandlers({
        billingMethods: deps.billingMethods,
        billingService: deps.billingService,
      });
      const res = mockResponse();

      await handlers.approvePayment(baseRequest({ params: {} }), res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        error: { code: 'missing_id', message: 'Payment ID is required' },
      });
      expect(deps.approvePayment).not.toHaveBeenCalled();
    });

    it('returns 400 when approval is rejected by the method', async () => {
      const deps = makeDeps();
      deps.approvePayment.mockResolvedValue({ ok: false, error: 'already_approved' });
      const handlers = createAdminReconciliationHandlers({
        billingMethods: deps.billingMethods,
        billingService: deps.billingService,
      });
      const res = mockResponse();

      await handlers.approvePayment(baseRequest({ params: { id: 'pay-1' } }), res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        error: { code: 'already_approved', message: 'Could not approve payment' },
      });
      expect(deps.applySubscription).not.toHaveBeenCalled();
    });

    it('returns 500 when applying the subscription fails', async () => {
      const deps = makeDeps();
      deps.approvePayment.mockResolvedValue({ ok: true, payment: paymentRecord() });
      deps.applySubscription.mockResolvedValue({
        ok: false,
        error: { code: 'no_such_plan', message: 'Plan inactive' },
      });
      const handlers = createAdminReconciliationHandlers({
        billingMethods: deps.billingMethods,
        billingService: deps.billingService,
      });
      const res = mockResponse();

      await handlers.approvePayment(baseRequest({ params: { id: 'pay-1' } }), res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: { code: 'no_such_plan', message: 'Plan inactive' } });
    });

    it('applies the subscription and returns 200 on success', async () => {
      const deps = makeDeps();
      const approved = paymentRecord();
      deps.approvePayment.mockResolvedValue({ ok: true, payment: approved });
      const sub: ISubscriptionRecord = {
        id: 'sub-1',
        user: 'user-1',
        tenantId: 'satchida-master',
        plan: 'pro',
        status: 'active',
        seatCount: 5,
      };
      deps.applySubscription.mockResolvedValue({
        ok: true,
        value: { subscription: sub, user: approved.user },
      });
      const handlers = createAdminReconciliationHandlers({
        billingMethods: deps.billingMethods,
        billingService: deps.billingService,
      });
      const res = mockResponse();

      await handlers.approvePayment(baseRequest({ params: { id: 'pay-1' } }), res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ ok: true, payment: approved, subscription: sub });
      expect(deps.applySubscription).toHaveBeenCalledWith('user-1', 'pro');
    });
  });

  describe('rejectPayment', () => {
    it('returns 400 when the id is missing', async () => {
      const deps = makeDeps();
      const handlers = createAdminReconciliationHandlers({
        billingMethods: deps.billingMethods,
        billingService: deps.billingService,
      });
      const res = mockResponse();

      await handlers.rejectPayment(baseRequest({ params: {}, body: { reason: 'fraud' } }), res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        error: { code: 'missing_id', message: 'Payment ID is required' },
      });
    });

    it('returns 400 when the reason is missing or non-string', async () => {
      const deps = makeDeps();
      const handlers = createAdminReconciliationHandlers({
        billingMethods: deps.billingMethods,
        billingService: deps.billingService,
      });
      const res = mockResponse();

      await handlers.rejectPayment(baseRequest({ params: { id: 'pay-1' }, body: {} }), res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        error: { code: 'missing_reason', message: 'Rejection reason is required' },
      });
      expect(deps.rejectPayment).not.toHaveBeenCalled();
    });

    it('rejects via the method and returns the rejected payment', async () => {
      const deps = makeDeps();
      const rejected = paymentRecord({ status: 'rejected' });
      rejected.rejectionReason = 'fraud';
      deps.rejectPayment.mockResolvedValue({ ok: true, payment: rejected });
      const handlers = createAdminReconciliationHandlers({
        billingMethods: deps.billingMethods,
        billingService: deps.billingService,
      });
      const res = mockResponse();

      await handlers.rejectPayment(
        baseRequest({ params: { id: 'pay-1' }, body: { reason: 'fraud' } }),
        res,
      );

      expect(deps.rejectPayment).toHaveBeenCalledWith('pay-1', 'operator-1', 'fraud');
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ ok: true, payment: rejected });
    });

    it('returns 400 when the method cannot reject the payment', async () => {
      const deps = makeDeps();
      deps.rejectPayment.mockResolvedValue({ ok: false, error: 'cannot_reject_approved' });
      const handlers = createAdminReconciliationHandlers({
        billingMethods: deps.billingMethods,
        billingService: deps.billingService,
      });
      const res = mockResponse();

      await handlers.rejectPayment(
        baseRequest({ params: { id: 'pay-1' }, body: { reason: 'fraud' } }),
        res,
      );

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        error: { code: 'cannot_reject_approved', message: 'Could not reject payment' },
      });
    });
  });

  describe('exportCsv', () => {
    it('streams a CSV with a BOM and the ledger columns, mapping the approver field', async () => {
      const deps = makeDeps();
      deps.listLedger.mockResolvedValue({
        items: [ledgerItem()],
        total: 1,
        pendingCount: 0,
        approvedCount: 1,
        rejectedCount: 0,
      });
      const handlers = createAdminReconciliationHandlers({
        billingMethods: deps.billingMethods,
        billingService: deps.billingService,
      });
      const res = mockResponse();

      await handlers.exportCsv(baseRequest(), res);

      expect(res.statusCode).toBe(200);
      expect(res.headers['Content-Type']).toBe('text/csv; charset=utf-8');
      expect(res.headers['Content-Disposition']).toMatch(
        /attachment; filename="reconciliation-ledger-/,
      );
      expect(res.sent).toMatch(/^\uFEFFPayment ID,/);
      expect(res.sent).toContain('"ledger@example.com"');
      expect(res.sent).toContain('"operator-1"');
    });
  });

  describe('audit', () => {
    it('emits payment.approved after a successful approval', async () => {
      const recordAuditEntry = jest.fn().mockResolvedValue(undefined);
      const deps = makeDeps();
      deps.approvePayment.mockResolvedValue({ ok: true, payment: paymentRecord() });
      deps.applySubscription.mockResolvedValue({
        ok: true,
        value: { subscription: { id: 'sub-1' } as never, user: 'user-1' },
      });
      const handlers = createAdminReconciliationHandlers({
        billingMethods: deps.billingMethods,
        billingService: deps.billingService,
        recordAuditEntry,
      });

      const res = mockResponse();
      await handlers.approvePayment(baseRequest({ params: { id: 'pay-1' } }), res);

      expect(res.statusCode).toBe(200);
      expect(recordAuditEntry).toHaveBeenCalledTimes(1);
      const entry = recordAuditEntry.mock.calls[0][0];
      expect(entry.action).toBe('payment.approved');
      expect(entry.target.id).toBe('pay-1');
      expect(entry.metadata.plan).toBe('pro');
      expect(entry.metadata.amount).toBe(499);
      expect(entry.actor.id).toBe('operator-1');
      expect(entry.tenantId).toBe('satchida-master');
    });

    it('emits payment.rejected with the operator reason', async () => {
      const recordAuditEntry = jest.fn().mockResolvedValue(undefined);
      const deps = makeDeps();
      deps.rejectPayment.mockResolvedValue({ ok: true, payment: paymentRecord() });
      const handlers = createAdminReconciliationHandlers({
        billingMethods: deps.billingMethods,
        billingService: deps.billingService,
        recordAuditEntry,
      });

      const res = mockResponse();
      await handlers.rejectPayment(
        baseRequest({ params: { id: 'pay-1' }, body: { reason: 'mismatched reference' } }),
        res,
      );

      expect(res.statusCode).toBe(200);
      const entry = recordAuditEntry.mock.calls[0][0];
      expect(entry.action).toBe('payment.rejected');
      expect(entry.metadata.reason).toBe('mismatched reference');
    });

    it('stays fail-open when the recorder rejects: the decision still answers', async () => {
      const recordAuditEntry = jest.fn().mockRejectedValue(new Error('audit store down'));
      const deps = makeDeps();
      deps.rejectPayment.mockResolvedValue({ ok: true, payment: paymentRecord() });
      const handlers = createAdminReconciliationHandlers({
        billingMethods: deps.billingMethods,
        billingService: deps.billingService,
        recordAuditEntry,
      });

      const res = mockResponse();
      await handlers.rejectPayment(
        baseRequest({ params: { id: 'pay-1' }, body: { reason: 'late' } }),
        res,
      );

      expect(res.statusCode).toBe(200);
      expect((res.body as { ok: boolean }).ok).toBe(true);
    });
  });
});
