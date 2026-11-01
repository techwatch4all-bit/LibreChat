import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';

export const VAULTS_QUERY_KEY = ['admin', 'vaults'] as const;

export type KnowledgeVaultItem = {
  id: number;
  name: string;
  slug: string;
  documentCount: number;
  createdAt: string;
};

export type VaultsResponse = {
  vaults: KnowledgeVaultItem[];
  total: number;
  error?: string;
};

export async function fetchAdminVaults(signal?: AbortSignal): Promise<VaultsResponse> {
  const response = await fetch('/api/admin/vaults', { signal });
  if (!response.ok) {
    throw new Error(`Failed to fetch vaults: HTTP ${response.status}`);
  }
  return (await response.json()) as VaultsResponse;
}

export function useAdminVaultsQuery(): UseQueryResult<VaultsResponse, Error> {
  return useQuery({
    queryKey: VAULTS_QUERY_KEY,
    queryFn: ({ signal }) => fetchAdminVaults(signal),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
