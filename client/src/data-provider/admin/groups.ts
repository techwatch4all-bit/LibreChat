import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import type { TenantAccountType, TenantSeatCapability } from 'librechat-data-provider';
import { adminFetch } from './client';

/**
 * Admin group management.
 *
 * A group is one commercial product line inside a tenant and maps one-to-one
 * onto a One-API group of the same name. The account type, the mode allowlist,
 * the capabilities and the family seat model recorded here are the tenant's own
 * view of the entitlement the operator's policy will enforce.
 *
 * The counts a tenant admin sees are always the operator's records, never a
 * client-side guess: the server derives them from the entitlement and the seat
 * roster.
 */

export const GROUPS_QUERY_KEY = ['admin', 'groups'] as const;

export type AdminGroup = {
  _id: string;
  name: string;
  description?: string;
  email?: string;
  avatar?: string;
  memberIds?: string[];
  source: 'local' | 'entra';
  idOnTheSource?: string;
  tenantId?: string;
  accountType?: TenantAccountType;
  shared?: boolean;
  familySeats?: { maxAdults: number; maxChildren: number };
  localPrivacyEnabled?: boolean;
  allowedCapabilities?: TenantSeatCapability[];
  allowedModes?: string[];
  assignedKnowledgeVaults?: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type AdminGroupMember = {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  accountType?: string | null;
  seatAssigned?: boolean;
};

export type GroupsResponse = {
  groups: AdminGroup[];
  total: number;
  limit: number;
  offset: number;
};

export type GroupMembersResponse = {
  members: AdminGroupMember[];
  total: number;
  limit: number;
  offset: number;
};

export type GroupListParams = {
  search?: string;
  source?: string;
  accountType?: string;
  limit?: number;
  offset?: number;
};

async function readError(response: Response): Promise<Error> {
  try {
    const body = await response.json();
    return new Error(body?.error ?? `Request failed with status ${response.status}`);
  } catch {
    return new Error(`Request failed with status ${response.status}`);
  }
}

export async function fetchGroups(params: GroupListParams = {}, signal?: AbortSignal) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.source) query.set('source', params.source);
  if (params.accountType) query.set('accountType', params.accountType);
  if (params.limit != null) query.set('limit', String(params.limit));
  if (params.offset != null) query.set('offset', String(params.offset));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const response = await adminFetch(`/api/admin/groups${suffix}`, { signal });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as GroupsResponse;
}

export async function fetchGroupMembers(
  groupId: string,
  params: { limit?: number; offset?: number } = {},
  signal?: AbortSignal,
) {
  const query = new URLSearchParams();
  if (params.limit != null) query.set('limit', String(params.limit));
  if (params.offset != null) query.set('offset', String(params.offset));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const response = await adminFetch(`/api/admin/groups/${groupId}/members${suffix}`, { signal });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as GroupMembersResponse;
}

export type CreateGroupPayload = {
  name: string;
  description?: string;
  accountType?: TenantAccountType;
  shared?: boolean;
  familySeats?: { maxAdults: number; maxChildren: number };
  localPrivacyEnabled?: boolean;
  allowedCapabilities?: TenantSeatCapability[];
  allowedModes?: string[];
};

export type UpdateGroupPayload = Partial<CreateGroupPayload>;

/**
 * The account types a group may represent.
 *
 * An empty string means "not set", which the API accepts and stores as null. It
 * is kept out of the payload type so the API never has to distinguish an absent
 * field from an empty one.
 */
export const GROUP_ACCOUNT_TYPES: TenantAccountType[] = [
  'basic',
  'standard',
  'family',
  'pro',
  'pro_family',
  'enterprise',
  'privacy',
];

export async function createGroup(payload: CreateGroupPayload) {
  const response = await adminFetch('/api/admin/groups', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as { group: AdminGroup };
}

export async function updateGroup(groupId: string, payload: UpdateGroupPayload) {
  const response = await adminFetch(`/api/admin/groups/${groupId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as { group: AdminGroup };
}

export async function deleteGroup(groupId: string) {
  const response = await adminFetch(`/api/admin/groups/${groupId}`, { method: 'DELETE' });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as { success: boolean; id: string };
}

export async function addGroupMember(groupId: string, userId: string) {
  const response = await adminFetch(`/api/admin/groups/${groupId}/members`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as { group: AdminGroup };
}

export async function removeGroupMember(groupId: string, userId: string) {
  const response = await adminFetch(`/api/admin/groups/${groupId}/members/${userId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as { success: boolean };
}

export function useGroupsQuery(
  params: GroupListParams = {},
  enabled = true,
): UseQueryResult<GroupsResponse, Error> {
  return useQuery({
    queryKey: [...GROUPS_QUERY_KEY, params],
    queryFn: ({ signal }) => fetchGroups(params, signal),
    enabled,
    staleTime: 30_000,
  });
}

export function useGroupMembersQuery(
  groupId: string | null,
  params: { limit?: number; offset?: number } = {},
): UseQueryResult<GroupMembersResponse, Error> {
  return useQuery({
    queryKey: [...GROUPS_QUERY_KEY, groupId, 'members', params],
    queryFn: ({ signal }) => {
      if (!groupId) throw new Error('a group id is required');
      return fetchGroupMembers(groupId, params, signal);
    },
    enabled: Boolean(groupId),
    staleTime: 15_000,
  });
}

export function useCreateGroupMutation(): UseMutationResult<
  { group: AdminGroup },
  Error,
  CreateGroupPayload
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createGroup,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GROUPS_QUERY_KEY }),
  });
}

export function useUpdateGroupMutation(
  groupId: string,
): UseMutationResult<{ group: AdminGroup }, Error, UpdateGroupPayload> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateGroupPayload) => updateGroup(groupId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GROUPS_QUERY_KEY }),
  });
}

export function useDeleteGroupMutation(): UseMutationResult<
  { success: boolean; id: string },
  Error,
  string
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GROUPS_QUERY_KEY }),
  });
}

export function useAddGroupMemberMutation(
  groupId: string,
): UseMutationResult<{ group: AdminGroup }, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => addGroupMember(groupId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GROUPS_QUERY_KEY }),
  });
}

export function useRemoveGroupMemberMutation(
  groupId: string,
): UseMutationResult<{ success: boolean }, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeGroupMember(groupId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GROUPS_QUERY_KEY }),
  });
}