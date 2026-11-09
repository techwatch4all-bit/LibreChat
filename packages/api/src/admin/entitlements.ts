import { logger } from '@librechat/data-schemas';
import {
  SEMANTIC_MODES,
  TENANT_ACCOUNT_TYPES,
  TENANT_ENTITLEMENT_STATUSES,
  TENANT_PLAN_TYPES,
  TENANT_SEAT_CAPABILITIES,
} from 'librechat-data-provider';
import type {
  AuditAction,
  AuditMetadata,
  RecordAuditEntryInput,
  RecordAuditEntryOptions,
  SemanticMode,
  TenantAccountType,
  TenantEntitlementSummary,
  TenantEntitlementUpdate,
  TenantPlanType,
  TenantSeatCapability,
  TenantEntitlementStatus,
} from '@librechat/data-schemas';
import type { Response } from 'express';
import type { ServerRequest } from '~/types/http';
import { buildAuditContext } from './context';

const MAX_SEAT_LIMIT = 100_000;
const MAX_TENANT_ID_LENGTH = 128;

interface Parsed<T> {
  ok: true;
  value: T;
}

interface Rejected {
  ok: false;
  error: string;
}

function isSafeNonNegativeInt(value: unknown, max = MAX_SEAT_LIMIT): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max;
}

function parseEntitlementUpdate(raw: unknown): Parsed<TenantEntitlementUpdate> | Rejected {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'body must be an object' };
  }
  const body = raw as Record<string, unknown>;

  const plan = body.plan;
  if (typeof plan !== 'string' || !(TENANT_PLAN_TYPES as readonly string[]).includes(plan)) {
    return { ok: false, error: `plan must be one of ${TENANT_PLAN_TYPES.join(', ')}` };
  }
  const status = body.status;
  if (
    typeof status !== 'string' ||
    !(TENANT_ENTITLEMENT_STATUSES as readonly string[]).includes(status)
  ) {
    return { ok: false, error: `status must be one of ${TENANT_ENTITLEMENT_STATUSES.join(', ')}` };
  }
  if (!isSafeNonNegativeInt(body.seatLimit)) {
    return { ok: false, error: `seatLimit must be an integer between 0 and ${MAX_SEAT_LIMIT}` };
  }
  if (body.accountTypes == null || typeof body.accountTypes !== 'object') {
    return { ok: false, error: 'accountTypes is required' };
  }

  const accountTypes: TenantEntitlementUpdate['accountTypes'] = {};
  for (const [accountType, rawAllocation] of Object.entries(
    body.accountTypes as Record<string, unknown>,
  )) {
    if (!(TENANT_ACCOUNT_TYPES as readonly string[]).includes(accountType)) {
      return {
        ok: false,
        error: `accountTypes contains an unsupported account type: ${accountType}`,
      };
    }
    if (rawAllocation == null || typeof rawAllocation !== 'object') {
      return { ok: false, error: `allocation for ${accountType} must be an object` };
    }
    const alloc = rawAllocation as Record<string, unknown>;
    if (!isSafeNonNegativeInt(alloc.seatLimit)) {
      return {
        ok: false,
        error: `allocation for ${accountType} needs an integer seatLimit between 0 and ${MAX_SEAT_LIMIT}`,
      };
    }
    const allowedModes = alloc.allowedModes;
    if (
      !Array.isArray(allowedModes) ||
      !allowedModes.every((mode) => (SEMANTIC_MODES as readonly string[]).includes(mode as string))
    ) {
      return { ok: false, error: `allocation for ${accountType} has an invalid allowedModes` };
    }
    const allocation: TenantEntitlementUpdate['accountTypes'][TenantAccountType] = {
      seatLimit: alloc.seatLimit,
      allowedModes: allowedModes as SemanticMode[],
    };
    if (alloc.allowedCapabilities !== undefined) {
      const caps = alloc.allowedCapabilities;
      if (
        !Array.isArray(caps) ||
        !caps.every((capability) =>
          (TENANT_SEAT_CAPABILITIES as readonly string[]).includes(capability as string),
        )
      ) {
        return {
          ok: false,
          error: `allocation for ${accountType} has an invalid allowedCapabilities`,
        };
      }
      allocation.allowedCapabilities = caps as TenantSeatCapability[];
    }
    if (alloc.localPrivacyEnabled !== undefined) {
      if (typeof alloc.localPrivacyEnabled !== 'boolean') {
        return {
          ok: false,
          error: `allocation for ${accountType} needs a boolean localPrivacyEnabled`,
        };
      }
      allocation.localPrivacyEnabled = alloc.localPrivacyEnabled;
    }
    accountTypes[accountType as TenantAccountType] = allocation;
  }

  const update: TenantEntitlementUpdate = {
    plan: plan as TenantPlanType,
    status: status as TenantEntitlementStatus,
    seatLimit: body.seatLimit,
    accountTypes,
  };
  for (const boundary of ['startsAt', 'expiresAt'] as const) {
    const value = body[boundary];
    if (value === undefined || value === null) {
      continue;
    }
    const date = new Date(value as string);
    if (Number.isNaN(date.getTime())) {
      return { ok: false, error: `${boundary} must be an ISO date` };
    }
    update[boundary] = date;
  }

  return { ok: true, value: update };
}

export interface AdminEntitlementsDeps {
  getTenantEntitlement: (tenantId: string) => Promise<TenantEntitlementSummary | undefined>;
  listTenantEntitlements: () => Promise<TenantEntitlementSummary[]>;
  setTenantEntitlement: (
    tenantId: string,
    update: TenantEntitlementUpdate,
    updatedBy?: string,
  ) => Promise<TenantEntitlementSummary>;
  recordAuditEntry?: (
    input: RecordAuditEntryInput,
    options?: RecordAuditEntryOptions,
  ) => Promise<unknown>;
}

export interface AdminEntitlementsHandlers {
  listEntitlements: (req: ServerRequest, res: Response) => Promise<Response>;
  getEntitlement: (req: ServerRequest, res: Response) => Promise<Response>;
  setEntitlement: (req: ServerRequest, res: Response) => Promise<Response>;
}

/**
 * Operator-only entitlement administration. Entitlements are cross-tenant
 * budget data (seat limits, plan terms), so unlike grants these handlers are
 * mounted behind `operator:control` with `platformOnly`, never behind the
 * tenant-admin surface.
 */
export function createAdminEntitlementsHandlers(
  deps: AdminEntitlementsDeps,
): AdminEntitlementsHandlers {
  const { getTenantEntitlement, listTenantEntitlements, setTenantEntitlement, recordAuditEntry } =
    deps;

  /** Fail-open with a loud error: the entitlement change has already been
   * applied when the audit runs, and the handler cannot compensate it. */
  async function emitEntitlementAudit(
    req: ServerRequest,
    tenantId: string,
    summary: TenantEntitlementSummary,
  ): Promise<void> {
    const action: AuditAction = 'entitlement.set';
    if (!recordAuditEntry) return;
    const user = req.user;
    const userId = user?._id?.toString() ?? user?.id;
    if (!user || !userId) return;
    try {
      const metadata: AuditMetadata = {
        plan: summary.plan,
        status: summary.status,
        seatLimit: summary.seatLimit,
      };
      await recordAuditEntry({
        action,
        outcome: 'success',
        severity: 'warning',
        actor: {
          type: 'user',
          id: userId,
          name: user.name || user.username || user.email || userId,
        },
        target: { type: 'tenant', id: tenantId, name: tenantId },
        metadata,
        context: buildAuditContext(req),
        tenantId,
      });
    } catch (err) {
      logger.error(
        '[adminEntitlements] entitlement.set audit failed after the write took effect',
        err,
      );
    }
  }

  /** Classifies the data-layer validation errors of `setTenantEntitlement`.
   * The method throws plain Errors with stable messages; only the race is
   * retryable and only known-validation shapes may surface as 400 — anything
   * unrecognized stays a 500 so an unexpected failure is never mistaken for a
   * client mistake. */
  function classifySetError(error: unknown): { status: number; message: string } {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('raced with a seat change')) {
      return { status: 409, message };
    }
    const knownValidations = [
      'tenantId is required',
      'plan/status is invalid',
      'invalid account allocation',
      'Family allocation must not include',
      'allocations exceed tenant seat limit',
      'expiry must be after its start',
      'Cannot remove an account type with assigned seats',
      'cannot be lower than assigned seats',
    ];
    if (knownValidations.some((fragment) => message.includes(fragment))) {
      return { status: 400, message };
    }
    logger.error('[adminEntitlements] unrecognized setEntitlement failure:', error);
    return { status: 500, message: 'Failed to set tenant entitlement' };
  }

  async function listEntitlementsHandler(req: ServerRequest, res: Response) {
    try {
      const entitlements = await listTenantEntitlements();
      return res.status(200).json({ entitlements });
    } catch (error) {
      logger.error('[adminEntitlements] listEntitlements error:', error);
      return res.status(500).json({ error: 'Failed to list tenant entitlements' });
    }
  }

  async function getEntitlementHandler(req: ServerRequest, res: Response) {
    try {
      const { tenantId } = req.params as { tenantId?: string };
      if (!tenantId || tenantId.length > MAX_TENANT_ID_LENGTH) {
        return res.status(400).json({ error: 'tenantId is required' });
      }
      const entitlement = await getTenantEntitlement(tenantId);
      if (!entitlement) {
        return res.status(404).json({ error: 'Tenant entitlement not found' });
      }
      return res.status(200).json({ entitlement });
    } catch (error) {
      logger.error('[adminEntitlements] getEntitlement error:', error);
      return res.status(500).json({ error: 'Failed to get tenant entitlement' });
    }
  }

  async function setEntitlementHandler(req: ServerRequest, res: Response) {
    try {
      const { tenantId } = req.params as { tenantId?: string };
      if (!tenantId || tenantId.trim().length === 0 || tenantId.length > MAX_TENANT_ID_LENGTH) {
        return res.status(400).json({ error: 'tenantId is required' });
      }
      const parsed = parseEntitlementUpdate(req.body);
      if (!parsed.ok) {
        return res.status(400).json({ error: parsed.error });
      }
      const user = req.user;
      const operatorId = user?._id?.toString() ?? user?.id;
      const summary = await setTenantEntitlement(tenantId.trim(), parsed.value, operatorId);
      await emitEntitlementAudit(req, tenantId.trim(), summary);
      return res.status(200).json({ entitlement: summary });
    } catch (error) {
      const { status, message } = classifySetError(error);
      return res.status(status).json({ error: message });
    }
  }

  return {
    listEntitlements: listEntitlementsHandler,
    getEntitlement: getEntitlementHandler,
    setEntitlement: setEntitlementHandler,
  };
}
