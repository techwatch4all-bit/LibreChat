import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';

export const ROLES_QUERY_KEY = ['admin', 'roles'] as const;

export type RoleListItem = {
  _id: string;
  name: string;
  description?: string;
};

export type AdminRoleMember = {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  joinedAt?: string;
};

export type RolesResponse = {
  roles: RoleListItem[];
  total: number;
  limit: number;
  offset: number;
};

export type RoleMembersResponse = {
  members: AdminRoleMember[];
  total: number;
  limit: number;
  offset: number;
};

export type CreateRolePayload = {
  name: string;
  description?: string;
  permissions?: Record<string, Record<string, boolean>>;
};

export type UpdateRolePermissionsPayload = {
  permissions: Record<string, Record<string, boolean>>;
};

export type AddRoleMemberPayload = {
  userId: string;
};

async function readError(response: Response): Promise<Error> {
  try {
    const body = await response.json();
    return new Error(body?.error ?? `Request failed with status ${response.status}`);
  } catch {
    return new Error(`Request failed with status ${response.status}`);
  }
}

export async function fetchRoles(signal?: AbortSignal): Promise<RolesResponse> {
  const response = await fetch('/api/admin/roles', { signal });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as RolesResponse;
}

export async function fetchRole(name: string, signal?: AbortSignal): Promise<{ role: any }> {
  const response = await fetch(`/api/admin/roles/${encodeURIComponent(name)}`, { signal });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as { role: any };
}

export async function createRole(payload: CreateRolePayload): Promise<{ role: any }> {
  const response = await fetch('/api/admin/roles', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as { role: any };
}

export async function updateRolePermissions(
  name: string,
  permissions: Record<string, Record<string, boolean>>,
): Promise<{ role: any }> {
  const response = await fetch(`/api/admin/roles/${encodeURIComponent(name)}/permissions`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ permissions }),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as { role: any };
}

export async function deleteRole(name: string): Promise<{ success: boolean }> {
  const response = await fetch(`/api/admin/roles/${encodeURIComponent(name)}`, { method: 'DELETE' });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as { success: boolean };
}

export async function fetchRoleMembers(
  name: string,
  params: { limit?: number; offset?: number } = {},
  signal?: AbortSignal,
): Promise<RoleMembersResponse> {
  const query = new URLSearchParams();
  if (params.limit != null) query.set('limit', String(params.limit));
  if (params.offset != null) query.set('offset', String(params.offset));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const response = await fetch(`/api/admin/roles/${encodeURIComponent(name)}/members${suffix}`, { signal });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as RoleMembersResponse;
}

export async function addRoleMember(roleName: string, userId: string): Promise<{ success: boolean }> {
  const response = await fetch(`/api/admin/roles/${encodeURIComponent(roleName)}/members`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as { success: boolean };
}

export async function removeRoleMember(roleName: string, userId: string): Promise<{ success: boolean }> {
  const response = await fetch(`/api/admin/roles/${encodeURIComponent(roleName)}/members/${userId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as { success: boolean };
}

// React Query hooks

export function useRolesQuery(enabled = true): UseQueryResult<RolesResponse, Error> {
  return useQuery({
    queryKey: ROLES_QUERY_KEY,
    queryFn: ({ signal }) => fetchRoles(signal),
    enabled,
    staleTime: 30_000,
  });
}

export function useRoleQuery(roleName: string, enabled = true): UseQueryResult<{ role: any }, Error> {
  return useQuery({
    queryKey: [...ROLES_QUERY_KEY, roleName],
    queryFn: ({ signal }) => fetchRole(roleName, signal),
    enabled: Boolean(roleName) && enabled,
    staleTime: 30_000,
  });
}

export function useRoleMembersQuery(roleName: string, enabled = true): UseQueryResult<RoleMembersResponse, Error> {
  return useQuery({
    queryKey: [...ROLES_QUERY_KEY, roleName, 'members'],
    queryFn: ({ signal }) => fetchRoleMembers(roleName, {}, signal),
    enabled: Boolean(roleName) && enabled,
    staleTime: 15_000,
  });
}

export function useCreateRoleMutation(): UseMutationResult<{ role: any }, Error, CreateRolePayload> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createRole,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ROLES_QUERY_KEY }),
  });
}

export function useUpdateRolePermissionsMutation(roleName: string): UseMutationResult<{ role: any }, Error, Record<string, Record<string, boolean>>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (permissions) => updateRolePermissions(roleName, permissions),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ROLES_QUERY_KEY }),
  });
}

export function useDeleteRoleMutation(): UseMutationResult<{ success: boolean }, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteRole,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ROLES_QUERY_KEY }),
  });
}

export function useAddRoleMemberMutation(roleName: string): UseMutationResult<{ success: boolean }, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId) => addRoleMember(roleName, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...ROLES_QUERY_KEY, roleName, 'members'] }),
  });
}

export function useRemoveRoleMemberMutation(roleName: string): UseMutationResult<{ success: boolean }, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId) => removeRoleMember(roleName, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...ROLES_QUERY_KEY, roleName, 'members'] }),
  });
}
