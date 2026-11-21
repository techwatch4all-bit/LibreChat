import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { adminFetch } from './client';

/**
 * Effective capabilities for the logged-in admin user. The backend resolves
 * the caller's principals (role + direct grants) and returns the capability
 * strings the panel should honour in its UI — the same set the per-route
 * requireCapability middleware enforces server-side.
 */
export const EFFECTIVE_CAPABILITIES_QUERY_KEY = ['admin', 'effective-capabilities'] as const;

export type EffectiveCapabilities = {
  capabilities: string[];
};

export async function fetchEffectiveCapabilities(signal?: AbortSignal): Promise<EffectiveCapabilities> {
  const response = await adminFetch('/api/admin/grants/effective', { signal });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export function useEffectiveCapabilitiesQuery(): UseQueryResult<EffectiveCapabilities, Error> {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: EFFECTIVE_CAPABILITIES_QUERY_KEY,
    queryFn: ({ signal }) => fetchEffectiveCapabilities(signal),
    staleTime: 60_000,
    retry: false,
  });
}

/** Capability predicate helpers used to gate admin-panel UI. The server always
 *  re-checks authority per request — these only decide what the panel shows. */
export function hasCapability(capabilities: string[] | undefined, capability: string): boolean {
  return Array.isArray(capabilities) && capabilities.includes(capability);
}

export function useCapabilityInvalidation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: EFFECTIVE_CAPABILITIES_QUERY_KEY });
}
