import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';

export const AUDIT_LOG_QUERY_KEY = ['admin', 'audit-log'] as const;

export interface AuditActor {
  type: string;
  id?: string;
  name: string;
}

export interface AuditTarget {
  type: string;
  id?: string;
  name?: string;
}

export interface AuditLogEntry {
  _id: string;
  seq: number;
  action: string;
  category: string;
  outcome: 'success' | 'failure' | 'denied';
  severity: 'info' | 'warning' | 'error' | 'critical';
  actor: AuditActor;
  target: AuditTarget;
  context?: {
    ip?: string;
    userAgent?: string;
  };
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogResponse {
  entries: AuditLogEntry[];
  total: number;
  nextCursor?: number | null;
}

export interface AuditVerificationResult {
  ok: boolean;
  chainKey: string;
  checked: number;
  brokenAt?: number;
  reason?: string;
}

async function readError(response: Response): Promise<Error> {
  try {
    const body = await response.json();
    return new Error(body?.error ?? `Request failed with status ${response.status}`);
  } catch {
    return new Error(`Request failed with status ${response.status}`);
  }
}

export async function fetchAuditLog(
  params: { limit?: number; offset?: number; search?: string } = {},
  signal?: AbortSignal,
): Promise<AuditLogResponse> {
  const query = new URLSearchParams();
  if (params.limit != null) query.set('limit', String(params.limit));
  if (params.offset != null) query.set('offset', String(params.offset));
  if (params.search) query.set('search', params.search);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const response = await fetch(`/api/admin/audit-log${suffix}`, { signal });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as AuditLogResponse;
}

export function useAuditLogQuery(
  params: { limit?: number; offset?: number; search?: string } = {},
  enabled = true,
): UseQueryResult<AuditLogResponse, Error> {
  return useQuery({
    queryKey: [...AUDIT_LOG_QUERY_KEY, params],
    queryFn: ({ signal }) => fetchAuditLog(params, signal),
    enabled,
    staleTime: 15_000,
  });
}

export async function verifyAuditChain(): Promise<AuditVerificationResult> {
  const response = await fetch('/api/admin/audit-log/verify');
  if (!response.ok) throw await readError(response);
  return (await response.json()) as AuditVerificationResult;
}
