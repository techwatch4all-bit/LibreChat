import { logger } from '@librechat/data-schemas';
import type { Request, Response } from 'express';
import { getSafeErrorMetadata } from '~/utils/errors';

export interface ContractSeatItem {
  accountType: string;
  seatCount: number;
  perSeatCostInr: number;
  enabled?: boolean;
}

export interface ApplyTenantContractInput {
  tenantId: string;
  contractRef?: string;
  fileName?: string;
  termMonths: number;
  termStartAt?: number;
  autoRenew?: boolean;
  monthlyBudgetTokens?: number;
  seats: ContractSeatItem[];
}

export interface TenantContractResult {
  ok: true;
  tenantId: string;
  contractRef: string;
  termMonths: number;
  termStartAt: number;
  termEndAt: number;
  appliedCount: number;
  rederived: unknown;
}

const VALID_ACCOUNT_TYPES = new Set([
  'basic',
  'standard',
  'family',
  'pro',
  'pro_family',
  'privacy',
  'enterprise',
]);

export function parseContractPayload(
  tenantId: string,
  rawBody: unknown,
): { ok: true; value: ApplyTenantContractInput } | { ok: false; error: { code: string; message: string } } {
  if (!tenantId || !/^[a-zA-Z0-9_-]{2,64}$/.test(tenantId)) {
    return { ok: false, error: { code: 'INVALID_TENANT_ID', message: 'Invalid tenant ID' } };
  }
  const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as Record<string, unknown>;
  const termMonths = Number(body.termMonths ?? 1);
  if (!Number.isInteger(termMonths) || ![1, 3, 6, 12].includes(termMonths)) {
    return {
      ok: false,
      error: {
        code: 'INVALID_TERM',
        message: 'termMonths must be 1 (monthly), 3 (quarterly), 6 (semi-annual), or 12 (annual)',
      },
    };
  }
  const rawSeats = Array.isArray(body.seats) ? body.seats : [];
  if (rawSeats.length === 0) {
    return {
      ok: false,
      error: { code: 'EMPTY_SEATS', message: 'At least one seat tier allocation is required' },
    };
  }
  const seats: ContractSeatItem[] = [];
  for (const item of rawSeats) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const rec = item as Record<string, unknown>;
    const accountType = typeof rec.accountType === 'string' ? rec.accountType.trim().toLowerCase() : '';
    if (!VALID_ACCOUNT_TYPES.has(accountType)) {
      return {
        ok: false,
        error: { code: 'INVALID_ACCOUNT_TYPE', message: `Unsupported accountType: ${accountType}` },
      };
    }
    const seatCount = Math.max(0, Math.floor(Number(rec.seatCount ?? 0)));
    const perSeatCostInr = Math.max(0, Math.round(Number(rec.perSeatCostInr ?? 0)));
    const enabled = rec.enabled !== undefined ? Boolean(rec.enabled) : seatCount > 0;
    seats.push({ accountType, seatCount, perSeatCostInr, enabled });
  }
  if (seats.length === 0) {
    return {
      ok: false,
      error: { code: 'EMPTY_SEATS', message: 'At least one valid seat tier allocation is required' },
    };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const termStartAt =
    typeof body.termStartAt === 'number' && Number.isFinite(body.termStartAt) && body.termStartAt > 0
      ? Math.floor(body.termStartAt)
      : nowSec;
  const monthlyBudgetTokens =
    typeof body.monthlyBudgetTokens === 'number' &&
    Number.isFinite(body.monthlyBudgetTokens) &&
    body.monthlyBudgetTokens >= 0
      ? Math.floor(body.monthlyBudgetTokens)
      : undefined;

  return {
    ok: true,
    value: {
      tenantId,
      contractRef: typeof body.contractRef === 'string' ? body.contractRef.trim().slice(0, 120) : '',
      fileName: typeof body.fileName === 'string' ? body.fileName.trim().slice(0, 180) : '',
      termMonths,
      termStartAt,
      autoRenew: Boolean(body.autoRenew),
      monthlyBudgetTokens,
      seats,
    },
  };
}

export function createApplyTenantContractHandler(deps?: { fetchImpl?: typeof fetch }) {
  const fetchFn = deps?.fetchImpl ?? fetch;

  return async (req: Request, res: Response): Promise<Response> => {
    try {
      const tenantId = typeof req.params?.tenantId === 'string' ? req.params.tenantId.trim() : '';
      const parsed = parseContractPayload(tenantId, req.body);
      if (!parsed.ok) {
        return res.status(400).json({ error: parsed.error });
      }
      const oneApiBase = (process.env.ONEAPI_BASE_URL || 'http://127.0.0.1:4000').replace(/\/+$/, '');
      const oneApiToken = process.env.ONEAPI_ADMIN_ACCESS_TOKEN || '';
      if (!oneApiToken) {
        return res.status(503).json({
          error: { code: 'ONEAPI_NOT_CONFIGURED', message: 'ONEAPI_ADMIN_ACCESS_TOKEN is not configured' },
        });
      }

      const headers: Record<string, string> = {
        Authorization: oneApiToken,
        'Content-Type': 'application/json',
      };
      if (process.env.ONEAPI_CF_CLIENT_ID && process.env.ONEAPI_CF_CLIENT_SECRET) {
        headers['CF-Access-Client-Id'] = process.env.ONEAPI_CF_CLIENT_ID;
        headers['CF-Access-Client-Secret'] = process.env.ONEAPI_CF_CLIENT_SECRET;
      }

      const { termMonths, termStartAt = Math.floor(Date.now() / 1000), autoRenew, seats } =
        parsed.value;
      const termEndAt = termStartAt + termMonths * 30 * 86400;

      for (const seat of seats) {
        const upsertRes = await fetchFn(
          `${oneApiBase}/api/tenant/${encodeURIComponent(tenantId)}/account-plan`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify({
              account_type: seat.accountType,
              per_seat_cost_inr: seat.perSeatCostInr,
              seat_count: seat.seatCount,
              term_months: termMonths,
              term_start_at: termStartAt,
              term_end_at: termEndAt,
              auto_renew: Boolean(autoRenew),
              enabled: seat.enabled ?? seat.seatCount > 0,
            }),
          },
        );
        if (!upsertRes.ok) {
          logger.warn('[TenantContract] account-plan upsert failed', {
            tenantId,
            accountType: seat.accountType,
            status: upsertRes.status,
          });
          return res.status(502).json({
            error: {
              code: 'ONEAPI_PLAN_UPSERT_FAILED',
              message: `Gateway rejected plan update for tier "${seat.accountType}" (HTTP ${upsertRes.status})`,
            },
          });
        }
      }

      const rederiveRes = await fetchFn(
        `${oneApiBase}/api/tenant/${encodeURIComponent(tenantId)}/rederive`,
        { method: 'POST', headers },
      );
      const rederived = rederiveRes.ok ? await rederiveRes.json().catch(() => null) : null;

      if (parsed.value.monthlyBudgetTokens !== undefined) {
        await fetchFn(`${oneApiBase}/api/tenant/${encodeURIComponent(tenantId)}/budget`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ monthly_tokens: parsed.value.monthlyBudgetTokens }),
        }).catch(() => {});
      }

      const result: TenantContractResult = {
        ok: true,
        tenantId,
        contractRef: parsed.value.contractRef || parsed.value.fileName || `contract-${termStartAt}`,
        termMonths,
        termStartAt,
        termEndAt,
        appliedCount: seats.length,
        rederived,
      };
      return res.json(result);
    } catch (error) {
      logger.error('[TenantContract] apply contract failed', getSafeErrorMetadata(error));
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to apply tenant contract' },
      });
    }
  };
}
