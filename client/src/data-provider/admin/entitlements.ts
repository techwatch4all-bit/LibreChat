import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import type { TenantEntitlementSummary, TenantEntitlementUpdate } from 'librechat-data-provider';

export const ADMIN_ENTITLEMENTS_QUERY_KEY = ['admin', 'entitlements'] as const;

async function readError(response: Response): Promise<Error> {
  try {
    const body = await response.json();
    return new Error(body?.error ?? `Request failed with status ${response.status}`);
  } catch {
    return new Error(`Request failed with status ${response.status}`);
  }
}

export async function fetchEntitlements(signal?: AbortSignal): Promise<{
  entitlements: TenantEntitlementSummary[];
}> {
  const response = await fetch('/api/admin/entitlements', { signal });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as { entitlements: TenantEntitlementSummary[] };
}

export async function fetchEntitlement(
  tenantId: string,
  signal?: AbortSignal,
): Promise<{ entitlement: TenantEntitlementSummary }> {
  const response = await fetch(
    `/api/admin/entitlements/${encodeURIComponent(tenantId)}`,
    { signal },
  );
  if (!response.ok) throw await readError(response);
  return (await response.json()) as { entitlement: TenantEntitlementSummary };
}

export async function putEntitlement(
  tenantId: string,
  update: TenantEntitlementUpdate,
): Promise<{ entitlement: TenantEntitlementSummary }> {
  const response = await fetch(`/api/admin/entitlements/${encodeURIComponent(tenantId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as { entitlement: TenantEntitlementSummary };
}

export function useEntitlementsQuery(enabled = true): UseQueryResult<
  { entitlements: TenantEntitlementSummary[] },
  Error
> {
  return useQuery({
    queryKey: ADMIN_ENTITLEMENTS_QUERY_KEY,
    queryFn: ({ signal }) => fetchEntitlements(signal),
    enabled,
    staleTime: 15_000,
  });
}

export function useEntitlementQuery(
  tenantId: string,
  enabled = true,
): UseQueryResult<{ entitlement: TenantEntitlementSummary }, Error> {
  return useQuery({
    queryKey: [...ADMIN_ENTITLEMENTS_QUERY_KEY, tenantId],
    queryFn: ({ signal }) => fetchEntitlement(tenantId, signal),
    enabled: enabled && !!tenantId,
    staleTime: 15_000,
  });
}

export function useSetEntitlementMutation(
  tenantId: string,
): UseMutationResult<
  { entitlement: TenantEntitlementSummary },
  Error,
  TenantEntitlementUpdate
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (update: TenantEntitlementUpdate) => putEntitlement(tenantId, update),
    onSuccess: (data) => {
      queryClient.setQueryData([...ADMIN_ENTITLEMENTS_QUERY_KEY, tenantId], data);
      queryClient.setQueryData<{ entitlements: TenantEntitlementSummary[] }>(
        ADMIN_ENTITLEMENTS_QUERY_KEY,
        (previous) => {
          if (!previous) {
            return previous;
          }
          const entitlements = previous.entitlements.map((entitlement) =>
            entitlement.tenantId === data.entitlement.tenantId ? data.entitlement : entitlement,
          );
          return { ...previous, entitlements };
        },
      );
    },
  });
}
