import { useState, useMemo } from 'react';
import { Spinner } from '@librechat/client';
import {
  Plus,
  Shield,
  Pencil,
  Trash2,
  Users,
  Search,
  CheckCircle2,
  X,
  Lock,
  ChevronRight,
  Info,
  ShieldAlert,
} from 'lucide-react';
import { useLocalize } from '~/hooks';
import {
  useRolesQuery,
  useRoleQuery,
  useDeleteRoleMutation,
  useCreateRoleMutation,
  useUpdateRolePermissionsMutation,
  type RoleListItem,
} from '~/data-provider/admin/roles';
import RoleMembers from './RoleMembers';

export default function RolesList() {
  const localize = useLocalize();
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [showMembersFor, setShowMembersFor] = useState<RoleListItem | null>(null);
  const [search, setSearch] = useState('');

  const rolesQuery = useRolesQuery();
  const deleteMutation = useDeleteRoleMutation();

  const roles = rolesQuery.data?.roles ?? [];

  const filteredRoles = useMemo(() => {
    if (!search.trim()) return roles;
    const q = search.toLowerCase();
    return roles.filter(
      (r) => r.name.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q),
    );
  }, [roles, search]);

  const handleDelete = async (roleName: string) => {
    if (!confirm(`Delete role "${roleName}"? Users with this role will fall back to base permissions.`)) {
      return;
    }
    await deleteMutation.mutateAsync(roleName);
    rolesQuery.refetch();
  };

  if (rolesQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto p-6 md:p-8 bg-surface-primary text-text-primary max-w-7xl mx-auto w-full">
      {/* Top Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              {localize('com_admin_roles_title') || 'Roles & Permissions'}
            </h1>
            <span className="rounded-full bg-surface-secondary border border-border-light px-2.5 py-0.5 text-xs font-semibold text-text-secondary">
              {roles.length} Roles
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Configure Role-Based Access Control (RBAC), capability entitlements, and user memberships.
          </p>
        </div>

        <button
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
          onClick={() => setEditingRoleId('__new__')}
        >
          <Plus size={15} />
          {localize('com_admin_roles_new') || 'Create Role'}
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="mb-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={15} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search roles by name or description..."
            className="w-full rounded-xl border border-border-light bg-surface-secondary pl-9 pr-4 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Error state */}
      {rolesQuery.isError && (
        <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400" role="alert">
          {rolesQuery.error.message}
        </div>
      )}

      {/* Roles Cards Grid */}
      {filteredRoles.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border-light bg-surface-secondary/30 p-8 text-center text-text-secondary">
          <Shield className="h-10 w-10 text-text-tertiary mb-3" />
          <div className="text-sm font-semibold text-text-primary">No roles found</div>
          <p className="text-xs text-text-secondary mt-1">
            {search ? 'Try clearing your search query.' : localize('com_admin_roles_empty') || 'No roles configured.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRoles.map((role) => {
            const isSystemRole = ['admin', 'user'].includes(role.name.toLowerCase());

            return (
              <div
                key={role._id}
                className="group relative flex flex-col justify-between rounded-2xl border border-border-light bg-surface-secondary/60 hover:bg-surface-secondary p-5 transition-all shadow-sm hover:shadow hover:border-primary/40"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                        <Shield size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors flex items-center gap-1.5">
                          {role.name}
                          {isSystemRole && (
                            <span className="rounded bg-surface-tertiary px-1.5 py-0.5 text-[9px] font-bold text-text-tertiary uppercase">
                              System
                            </span>
                          )}
                        </h3>
                        <span className="text-[11px] text-text-secondary">
                          RBAC Role
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingRoleId(role._id)}
                        className="p-1.5 text-text-tertiary hover:text-text-primary rounded-lg hover:bg-surface-tertiary transition-colors"
                        title="Edit Permissions"
                      >
                        <Pencil size={14} />
                      </button>
                      {!isSystemRole && (
                        <button
                          onClick={() => handleDelete(role.name)}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 text-text-tertiary hover:text-rose-500 rounded-lg hover:bg-surface-tertiary transition-colors"
                          title="Delete Role"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-text-secondary line-clamp-2 min-h-[32px] mb-4">
                    {role.description || 'Custom role with defined capability boundaries.'}
                  </p>
                </div>

                {/* Card Footer Actions */}
                <div className="mt-4 pt-3 border-t border-border-light flex items-center justify-between">
                  <button
                    onClick={() => setShowMembersFor(role)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                  >
                    <Users size={13} />
                    View Assigned Users
                  </button>

                  <button
                    onClick={() => setEditingRoleId(role._id)}
                    className="inline-flex items-center text-xs text-text-secondary hover:text-text-primary font-medium"
                  >
                    Configure <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Role Members Modal */}
      {showMembersFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border-medium bg-surface-primary p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <RoleMembers
              role={showMembersFor}
              onClose={() => setShowMembersFor(null)}
            />
          </div>
        </div>
      )}

      {/* Role Editor Modal */}
      {editingRoleId && (
        <RoleEditorModal
          roleId={editingRoleId}
          onClose={() => setEditingRoleId(null)}
          onSuccess={() => {
            setEditingRoleId(null);
            rolesQuery.refetch();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Role Editor Modal Component
// ---------------------------------------------------------------------------

function RoleEditorModal({
  roleId,
  onClose,
  onSuccess,
}: {
  roleId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isNew = roleId === '__new__';
  const roleQuery = useRoleQuery(isNew ? '' : roleId);
  const createMutation = useCreateRoleMutation();
  const updateMutation = useUpdateRolePermissionsMutation();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<Record<string, any>>({});
  const [initialized, setInitialized] = useState(false);

  if (!isNew && roleQuery.data && !initialized) {
    setName(roleQuery.data.name || '');
    setDescription(roleQuery.data.description || '');
    setPermissions(roleQuery.data.permissions || {});
    setInitialized(true);
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNew) {
      if (!name.trim()) return;
      await createMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        permissions,
      });
    } else {
      await updateMutation.mutateAsync({
        roleName: roleQuery.data?.name || '',
        permissions,
      });
    }
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border-medium bg-surface-primary p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-border-light">
          <h2 className="text-base font-bold text-text-primary">
            {isNew ? 'Create New Role' : `Edit Role: ${roleQuery.data?.name}`}
          </h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4 text-xs">
          {isNew && (
            <div>
              <label className="block font-semibold text-text-secondary mb-1">Role Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. data-scientist, analyst"
                className="w-full rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
                required
              />
            </div>
          )}

          <div>
            <label className="block font-semibold text-text-secondary mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of responsibilities..."
              className="w-full rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
            />
          </div>

          <div className="rounded-xl border border-border-light bg-surface-secondary/40 p-4 space-y-2">
            <div className="font-semibold text-text-primary">Capabilities & Entitlements</div>
            <p className="text-[11px] text-text-secondary">
              Role permissions are bound to system capabilities. Configure fine-grained access below.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border-light">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border-light bg-surface-secondary px-4 py-2 text-xs font-semibold text-text-primary hover:bg-surface-tertiary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
