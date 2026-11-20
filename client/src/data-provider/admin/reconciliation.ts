import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import { adminFetch } from './client';

export const RECONCILIATION_QUERY_KEY = ['admin', 'reconciliation'] as const;

export interface ReconciliationItem {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  userRegisteredAt?: Date | string;
  userLastLogin?: Date | string;
  plan: string;
  paymentStatus: string;
  upiReference?: string;
  amount: number;
  currency: string;
  submittedAt?: Date | string;
  approverId?: string;
  approvedAt?: Date | string;
  subscriptionStatus?: string;
  subscriptionExpiresAt?: Date | string;
}

export interface ReconciliationResponse {
  items: ReconciliationItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReconciliationFilters {
  page?: number;
  limit?: number;
  status?: string;
  plan?: string;
  search?: string;
}

async function readError(response: Response): Promise<Error> {
  try {
    const payload = (await response.json()) as { error?: { message?: string; code?: string } | string };
    if (typeof payload?.error === 'object' && payload.error?.message) {
      return new Error(payload.error.message);
    }
    if (typeof payload?.error === 'string') {
      return new Error(payload.error);
    }
  } catch {
    // Non-JSON response
  }
  return new Error(`Request failed with status ${response.status}`);
}

export function useReconciliationLedgerQuery(
  filters: ReconciliationFilters = {},
): UseQueryResult<ReconciliationResponse> {
  return useQuery({
    queryKey: [...RECONCILIATION_QUERY_KEY, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.status) params.set('status', filters.status);
      if (filters.plan) params.set('plan', filters.plan);
      if (filters.search) params.set('search', filters.search);

      const res = await adminFetch(`/api/admin/reconciliation?${params.toString()}`);
      if (!res.ok) {
        throw await readError(res);
      }
      return (await res.json()) as ReconciliationResponse;
    },
    staleTime: 15_000,
  });
}

export function useApprovePaymentMutation(): UseMutationResult<
  { ok: boolean; payment: unknown },
  Error,
  string
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await adminFetch(`/api/admin/reconciliation/${paymentId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        throw await readError(res);
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECONCILIATION_QUERY_KEY });
    },
  });
}

export function useRejectPaymentMutation(): UseMutationResult<
  { ok: boolean; payment: unknown },
  Error,
  { paymentId: string; reason: string }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: string; reason: string }) => {
      const res = await adminFetch(`/api/admin/reconciliation/${paymentId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        throw await readError(res);
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECONCILIATION_QUERY_KEY });
    },
  });
}
