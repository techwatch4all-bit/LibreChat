import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import { GROUPS_QUERY_KEY } from './groups';

export const USERS_QUERY_KEY = ['admin', 'users'] as const;

export type AdminUserListItem = {
  id: string;
  name: string;
  username: string;
  email: string;
  avatar: string;
  role: string;
  provider: string;
  createdAt?: string;
  updatedAt?: string;
  tenantId?: string;
  accountType?: string | null;
  familyAccountId?: string | null;
  familyRole?: string | null;
  mustChangePassword?: boolean;
  seatAssigned?: boolean;
  seatTokenHint?: string | null;
  groupIds?: string[];
  suspended?: boolean;
  dailyMessageLimit?: number | null;
  assignedKnowledgeVaults?: string[];
};

export type AdminUserGroup = {
  id: string;
  name: string;
  description?: string;
};

export type AdminUserSearchResult = {
  id: string;
  name: string;
  email: string;
  username?: string;
  avatarUrl?: string;
};

export type UsersResponse = {
  users: AdminUserListItem[];
  total: number;
  limit: number;
  offset: number;
};

export type CreateUserPayload = {
  email: string;
  name?: string;
  username?: string;
  password?: string;
  role?: string;
  accountType?: string;
  quota?: number;
  familyRole?: string | null;
  familyAccountId?: string | null;
};

export type UpdateUserPayload = Partial<CreateUserPayload> & {
  mustChangePassword?: boolean;
  suspended?: boolean;
  dailyMessageLimit?: number | null;
  assignedKnowledgeVaults?: string[];
};

async function readError(response: Response): Promise<Error> {
  try {
    const body = await response.json();
    return new Error(body?.error ?? `Request failed with status ${response.status}`);
  } catch {
    return new Error(`Request failed with status ${response.status}`);
  }
}

export async function fetchUsers(
  params: { limit?: number; offset?: number } = {},
  signal?: AbortSignal,
): Promise<UsersResponse> {
  const query = new URLSearchParams();
  if (params.limit != null) query.set('limit', String(params.limit));
  if (params.offset != null) query.set('offset', String(params.offset));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const response = await fetch(`/api/admin/users${suffix}`, { signal });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as UsersResponse;
}

export async function searchUsers(query: string, signal?: AbortSignal): Promise<{ users: AdminUserSearchResult[] }> {
  const qs = new URLSearchParams({ q: query });
  const response = await fetch(`/api/admin/users/search?${qs.toString()}`, { signal });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as { users: AdminUserSearchResult[] };
}

export async function fetchUserGroups(userId: string, signal?: AbortSignal): Promise<{ groups: AdminUserGroup[] }> {
  const response = await fetch(`/api/admin/users/${userId}/groups`, { signal });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as { groups: AdminUserGroup[] };
}

export async function createUser(payload: CreateUserPayload): Promise<{ ok: boolean; temporaryPassword?: string; user: AdminUserListItem }> {
  const response = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as { ok: boolean; temporaryPassword?: string; user: AdminUserListItem };
}

export async function updateUser(userId: string, payload: UpdateUserPayload): Promise<{ user: AdminUserListItem }> {
  const response = await fetch(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as { user: AdminUserListItem };
}

export async function resetPassword(userId: string): Promise<{ ok: boolean; temporaryPassword: string }> {
  const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
    method: 'POST',
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as { ok: boolean; temporaryPassword: string };
}

export async function fetchCsvTemplate(): Promise<string> {
  const response = await fetch('/api/admin/users/csv-template');
  if (!response.ok) throw await readError(response);
  return await response.text();
}

export async function bulkCreateUsers(payload: { csvData?: string; users?: any[] }): Promise<{
  ok: boolean;
  createdCount: number;
  skippedCount: number;
  skipped: Array<{ email: string; reason: string }>;
  slips: Array<{ id: string | null; name: string; email: string; role: string; accountType: string | null; group: string; tempPassword: string }>;
}> {
  const response = await fetch('/api/admin/users/bulk', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as {
    ok: boolean;
    createdCount: number;
    skippedCount: number;
    skipped: Array<{ email: string; reason: string }>;
    slips: Array<{ id: string | null; name: string; email: string; role: string; accountType: string | null; group: string; tempPassword: string }>;
  };
}

export function useBulkCreateUsersMutation(): UseMutationResult<
  {
    ok: boolean;
    createdCount: number;
    skippedCount: number;
    skipped: Array<{ email: string; reason: string }>;
    slips: Array<{ id: string | null; name: string; email: string; role: string; accountType: string | null; group: string; tempPassword: string }>;
  },
  Error,
  { csvData?: string; users?: any[] }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bulkCreateUsers,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
  });
}

export function useUsersQuery(
  params: { limit?: number; offset?: number } = {},
  enabled = true,
): UseQueryResult<UsersResponse, Error> {
  return useQuery({
    queryKey: [...USERS_QUERY_KEY, params],
    queryFn: ({ signal }) => fetchUsers(params, signal),
    enabled,
    staleTime: 30_000,
  });
}

export function useSearchUsersQuery(
  query: string,
  enabled = true,
): UseQueryResult<{ users: AdminUserSearchResult[] }, Error> {
  return useQuery({
    queryKey: [...USERS_QUERY_KEY, 'search', query],
    queryFn: ({ signal }) => searchUsers(query, signal),
    enabled: enabled && query.trim().length > 0,
    staleTime: 10_000,
  });
}

export function useCreateUserMutation(): UseMutationResult<
  { ok: boolean; temporaryPassword?: string; user: AdminUserListItem },
  Error,
  CreateUserPayload
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
  });
}

export function useUpdateUserMutation(): UseMutationResult<
  { user: AdminUserListItem },
  Error,
  { userId: string; data: UpdateUserPayload }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, data }) => updateUser(userId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
  });
}

export function useResetPasswordMutation(): UseMutationResult<
  { ok: boolean; temporaryPassword: string },
  Error,
  string
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resetPassword,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
  });
}

export async function deleteUser(userId: string): Promise<{ message: string }> {
  const response = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as { message: string };
}

export function useDeleteUserMutation(): UseMutationResult<{ message: string }, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
  });
}


// ---------------------------------------------------------------------------
// Seat tokens (R1): per-user One-API tenant credential
// ---------------------------------------------------------------------------

export type AssignSeatPayload = {
  accountType: string;
  /** Operator instances may target any tenant; tenant admins are bound to
   *  their own tenant server-side, so this is ignored there. */
  tenantId?: string;
};

export async function assignSeatToken(
  userId: string,
  payload: AssignSeatPayload,
): Promise<{ accountType: string; seatAlias: string; oneapiTenant?: string; seatTokenHint: string }> {
  const response = await fetch(`/api/admin/users/${userId}/seat-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function revokeSeatToken(userId: string): Promise<{ revoked: boolean }> {
  const response = await fetch(`/api/admin/users/${userId}/seat-token`, { method: 'DELETE' });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export function useAssignSeatTokenMutation(): UseMutationResult<
  { accountType: string; seatAlias: string; oneapiTenant?: string; seatTokenHint: string },
  Error,
  { userId: string; payload: AssignSeatPayload }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }) => assignSeatToken(userId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: GROUPS_QUERY_KEY });
    },
  });
}

export function useRevokeSeatTokenMutation(): UseMutationResult<
  { revoked: boolean },
  Error,
  string
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeSeatToken,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
  });
}


export function useUserGroupsQuery(
  userId: string,
  enabled = true,
): UseQueryResult<{ groups: AdminUserGroup[] }, Error> {
  return useQuery({
    queryKey: [...USERS_QUERY_KEY, userId, 'groups'],
    queryFn: ({ signal }) => fetchUserGroups(userId, signal),
    enabled: enabled && Boolean(userId),
    staleTime: 10_000,
  });
}
