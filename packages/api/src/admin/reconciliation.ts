import type { Response } from 'express';
import type { ServerRequest } from '~/types/http';
import { logger } from '@librechat/data-schemas';
import type {
  BillingMethods,
  ReconciliationFilterParams,
  PaymentStatus,
  PlanTier,
} from '@librechat/data-schemas';
import type { BillingService } from '../billing/service';

export interface AdminReconciliationDeps {
  billingMethods: BillingMethods;
  billingService: BillingService;
  recordAuditEntry?: (entry: Record<string, unknown>) => Promise<unknown>;
}

export interface AdminReconciliationHandlers {
  listLedger: (req: ServerRequest, res: Response) => Promise<Response>;
  approvePayment: (req: ServerRequest, res: Response) => Promise<Response>;
  rejectPayment: (req: ServerRequest, res: Response) => Promise<Response>;
  exportCsv: (req: ServerRequest, res: Response) => Promise<Response | void>;
}

export function createAdminReconciliationHandlers(
  deps: AdminReconciliationDeps,
): AdminReconciliationHandlers {
  const { billingMethods, billingService } = deps;

  /**
   * GET /api/admin/reconciliation
   * List reconciliation ledger entries with pagination and filters.
   */
  const listLedger = async (req: ServerRequest, res: Response): Promise<Response> => {
    try {
       const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
       const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '25', 10)));
       const status = req.query.status as PaymentStatus | undefined;
       const plan = req.query.plan as PlanTier | undefined;
       const search = req.query.search as string | undefined;

       const params: ReconciliationFilterParams = {
         offset: (page - 1) * limit,
         limit,
         status,
         plan,
         search,
       };

      const result = await billingMethods.listReconciliationLedger(params);
      return res.status(200).json(result);
    } catch (err: unknown) {
      logger.error('[AdminReconciliation] Failed to list ledger:', err);
      return res.status(500).json({
        error: { code: 'ledger_fetch_failed', message: 'Failed to retrieve reconciliation ledger' },
      });
    }
  };

  /**
   * POST /api/admin/reconciliation/:id/approve
   * Approves a pending payment, applies the plan & quota, records operator audit log.
   */
  const approvePayment = async (req: ServerRequest, res: Response): Promise<Response> => {
    try {
      const { id } = req.params as { id?: string };
      const operatorId = req.user?.id || 'system';

      if (!id) {
        return res.status(400).json({ error: { code: 'missing_id', message: 'Payment ID is required' } });
      }

      const approval = await billingMethods.approvePayment(id, operatorId);
      if (!approval.ok || !approval.payment) {
        return res.status(400).json({
          error: { code: approval.error || 'approval_failed', message: 'Could not approve payment' },
        });
      }

      // Apply the subscription and token quota to the user
      const applyResult = await billingService.applySubscription(
        approval.payment.user,
        approval.payment.plan,
      );

      if (!applyResult.ok) {
        logger.error('[AdminReconciliation] Subscription application failed after approval:', applyResult.error);
        return res.status(500).json({
          error: { code: applyResult.error.code, message: applyResult.error.message },
        });
      }

      logger.info(`[AdminReconciliation] Payment ${id} approved by operator ${operatorId}`);

      return res.status(200).json({
        ok: true,
        payment: approval.payment,
        subscription: applyResult.value.subscription,
      });
    } catch (err: unknown) {
      logger.error('[AdminReconciliation] Error approving payment:', err);
      return res.status(500).json({
        error: { code: 'internal_error', message: 'An unexpected error occurred during approval' },
      });
    }
  };

  /**
   * POST /api/admin/reconciliation/:id/reject
   * Rejects a pending payment with an operator note.
   */
  const rejectPayment = async (req: ServerRequest, res: Response): Promise<Response> => {
    try {
      const { id } = req.params as { id?: string };
      const { reason } = req.body as { reason?: string };
      const operatorId = req.user?.id || 'system';

      if (!id) {
        return res.status(400).json({ error: { code: 'missing_id', message: 'Payment ID is required' } });
      }

      if (!reason || typeof reason !== 'string') {
        return res.status(400).json({
          error: { code: 'missing_reason', message: 'Rejection reason is required' },
        });
      }

      const rejection = await billingMethods.rejectPayment(id, operatorId, reason);
      if (!rejection.ok || !rejection.payment) {
        return res.status(400).json({
          error: { code: rejection.error || 'rejection_failed', message: 'Could not reject payment' },
        });
      }

      logger.info(`[AdminReconciliation] Payment ${id} rejected by operator ${operatorId}: ${reason}`);

      return res.status(200).json({
        ok: true,
        payment: rejection.payment,
      });
    } catch (err: unknown) {
      logger.error('[AdminReconciliation] Error rejecting payment:', err);
      return res.status(500).json({
        error: { code: 'internal_error', message: 'An unexpected error occurred during rejection' },
      });
    }
  };

  /**
   * GET /api/admin/reconciliation/export.csv
   * Stream/export CSV of ledger for bank reconciliation.
   */
  const exportCsv = async (req: ServerRequest, res: Response): Promise<Response | void> => {
    try {
      const status = req.query.status as PaymentStatus | undefined;
      const plan = req.query.plan as PlanTier | undefined;

      const ledger = await billingMethods.listReconciliationLedger({
        offset: 0,
        limit: 5000,
        status,
        plan,
      });

      const headers = [
        'Payment ID',
        'User Email',
        'User Name',
        'Plan Tier',
        'Amount',
        'Currency',
        'UPI Reference',
        'Status',
        'Submitted At',
        'Approver',
        'Approved At',
      ];

      const csvRows = [headers.join(',')];

      for (const item of ledger.items) {
        const row = [
          `"${item.id}"`,
          `"${item.userEmail || ''}"`,
          `"${(item.userName || '').replace(/"/g, '""')}"`,
          `"${item.plan}"`,
          item.amount,
          `"${item.currency}"`,
          `"${item.upiReference || ''}"`,
          `"${item.status}"`,
          `"${item.submittedAt ? new Date(item.submittedAt).toISOString() : ''}"`,
          `"${item.approvingOperator || ''}"`,
          `"${item.approvedAt ? new Date(item.approvedAt).toISOString() : ''}"`,
        ];
        csvRows.push(row.join(','));
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="reconciliation-ledger-${Date.now()}.csv"`);
      return res.status(200).send('\ufeff' + csvRows.join('\r\n'));
    } catch (err: unknown) {
      logger.error('[AdminReconciliation] Failed to export CSV:', err);
      return res.status(500).json({
        error: { code: 'export_failed', message: 'Failed to generate reconciliation CSV export' },
      });
    }
  };

  return {
    listLedger,
    approvePayment,
    rejectPayment,
    exportCsv,
  };
}
