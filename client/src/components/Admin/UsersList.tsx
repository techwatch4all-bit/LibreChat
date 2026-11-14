import { useMemo, useState, useRef } from 'react';
import { useAssignSeatTokenMutation, useRevokeSeatTokenMutation } from '~/data-provider/admin/users';
import { Spinner } from '@librechat/client';
import {
  Search,
  Plus,
  Upload,
  Download,
  Pencil,
  KeyRound,
  Zap,
  Ban,
  Trash2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter,
  CheckCircle2,
  Clock,
  Lock,
  Unlock,
  ShieldAlert,
  UserCheck,
  UserX,
  X,
  RefreshCw,
  MoreVertical,
} from 'lucide-react';
import { useLocalize } from '~/hooks';
import { useGroupsQuery } from '~/data-provider/admin/groups';
import { useUserGroupsQuery } from '~/data-provider/admin/users';
import { useEffectiveCapabilitiesQuery, hasCapability } from '~/data-provider/admin/grants';
import {
  useUsersQuery,
  useDeleteUserMutation,
  useUpdateUserMutation,
  useResetPasswordMutation,
  useBulkCreateUsersMutation,
  fetchCsvTemplate,
  type AdminUserListItem,
  type UpdateUserPayload,
} from '~/data-provider/admin/users';
import CreateUser from './CreateUser';

const PAGE_SIZE = 25;

interface UsersListProps {
  initialCreateOpen?: boolean;
  onClearInitialCreate?: () => void;
}

export default function UsersList({
  initialCreateOpen = false,
  onClearInitialCreate,
}: UsersListProps) {
  const localize = useLocalize();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(initialCreateOpen);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserListItem | null>(null);
  const [resetResult, setResetResult] = useState<{ email: string; tempPassword: string } | null>(null);

  // Enterprise Filter States
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [seatEditing, setSeatEditing] = useState<{ userId: string; email: string; accountType: string } | null>(null);
  const [seatFilter, setSeatFilter] = useState<string>('all');
  const [tenantFilter, setTenantFilter] = useState<string>('all');

  // Distinct tenant list for the operator's filter dropdown
  const tenantOptions = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => set.add(u.tenantId || 'satchida-master'));
    return Array.from(set).sort();
  }, [users]);
  const assignSeatMutation = useAssignSeatTokenMutation();
  const revokeSeatMutation = useRevokeSeatTokenMutation();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Bulk Selection States
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  const usersQuery = useUsersQuery({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const deleteMutation = useDeleteUserMutation();
  const resetPasswordMutation = useResetPasswordMutation();
  const updateMutation = useUpdateUserMutation();

  const users = usersQuery.data?.users ?? [];
  const total = usersQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  // Filter application
  const filtered = users.filter((u) => {
    // Search query match
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q);
      if (!match) return false;
    }

    // Role filter
    if (roleFilter !== 'all' && u.role !== roleFilter) {
      return false;
    }

    // Tier filter
    if (tierFilter !== 'all' && (u.accountType || 'free') !== tierFilter) {
      return false;
    }

    // Status filter
    if (statusFilter === 'active' && u.mustChangePassword) return false;
    if (statusFilter === 'temp' && !u.mustChangePassword) return false;

    // Seat filter (One-API seat token assigned or not)
    if (seatFilter === 'assigned' && !u.seatAssigned) return false;
    if (seatFilter === 'unassigned' && u.seatAssigned) return false;

    // Tenant filter (operator view spans tenants)
    if (tenantFilter !== 'all' && (u.tenantId || 'satchida-master') !== tenantFilter) return false;

    return true;
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedUserIds(new Set(filtered.map((u) => u.id)));
    } else {
      setSelectedUserIds(new Set());
    }
  };

  const handleToggleSelect = (userId: string) => {
    const next = new Set(selectedUserIds);
    if (next.has(userId)) {
      next.delete(userId);
    } else {
      next.add(userId);
    }
    setSelectedUserIds(next);
  };

  const handleToggleSuspend = async (user: AdminUserListItem) => {
    const action = user.suspended ? 'Unsuspend' : 'Suspend';
    if (!confirm(`${action} user ${user.name || user.email}? ${user.suspended ? 'User will regain platform access.' : 'User will be immediately blocked from signing in.'}`)) {
      return;
    }
    try {
      await updateMutation.mutateAsync({
        userId: user.id,
        payload: { suspended: !user.suspended },
      });
      usersQuery.refetch();
    } catch (err) {
      alert(`Failed to ${action.toLowerCase()} user: ${(err as Error).message}`);
    }
  };
  const handleRevokeSeat = async (user: AdminUserListItem) => {
    if (!confirm(`Revoke the One-API seat token for ${user.email}? Requests will fall back to the shared gateway credential.`)) return;
    try {
      await revokeSeatMutation.mutateAsync(user.id);
      alert('Seat token revoked.');
    } catch (err) {
      alert(`Failed to revoke seat token: ${(err as Error).message}`);
    }
  };

  const handleDelete = async (user: AdminUserListItem) => {
    if (!confirm(`Delete user ${user.name || user.email}? This action cannot be undone.`)) {
      return;
    }
    await deleteMutation.mutateAsync(user.id);
    usersQuery.refetch();
  };

  const handleResetPassword = async (user: AdminUserListItem) => {
    if (!confirm(`Reset password for ${user.name || user.email}? A temporary password will be generated.`)) {
      return;
    }
    try {
      const res = await resetPasswordMutation.mutateAsync(user.id);
      setResetResult({ email: user.email, tempPassword: res.temporaryPassword });
    } catch (err) {
      alert(`Failed to reset password: ${(err as Error).message}`);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUserIds.size === 0) return;
    if (
      !confirm(
        `Are you sure you want to permanently delete ${selectedUserIds.size} selected users? This action cannot be reversed.`,
      )
    ) {
      return;
    }
    for (const id of Array.from(selectedUserIds)) {
      await deleteMutation.mutateAsync(id);
    }
    setSelectedUserIds(new Set());
    usersQuery.refetch();
  };

  const isAllSelected = filtered.length > 0 && selectedUserIds.size === filtered.length;

  return (
    <div className="flex h-full flex-col overflow-auto p-6 md:p-8 bg-surface-primary text-text-primary max-w-7xl mx-auto w-full">
      {/* Top Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              {localize('com_admin_users_title') || 'User Directory'}
            </h1>
            <span className="rounded-full bg-surface-secondary border border-border-light px-2.5 py-0.5 text-xs font-semibold text-text-secondary">
              {total} Total
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Provision, manage roles, configure quotas, reset passwords, and bulk import accounts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => usersQuery.refetch()}
            disabled={usersQuery.isFetching}
            className="flex items-center gap-1.5 rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs font-medium text-text-primary hover:bg-surface-tertiary transition-colors"
          >
            <RefreshCw size={14} className={usersQuery.isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            className="flex items-center gap-1.5 rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs font-medium text-text-primary hover:bg-surface-tertiary transition-colors"
            onClick={() => setShowBulkImport(true)}
          >
            <Upload size={14} />
            CSV Import
          </button>
          <button
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity shadow-sm"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={15} />
            {localize('com_admin_users_new') || 'Provision User'}
          </button>
        </div>
      </div>

      {/* Action / Filter Bar */}
      <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={15} />
          <input
            className="w-full rounded-xl border border-border-light bg-surface-secondary pl-9 pr-4 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={localize('com_admin_users_search') || 'Filter by name, email, or username...'}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Dropdown Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
          >
            <option value="all">All Roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
            <option value="standard">Standard</option>
            <option value="pro">Pro</option>
          </select>

          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
          >
            <option value="all">All Tiers</option>
            <option value="free">None / Free</option>
            <option value="basic">Basic</option>
            <option value="standard">Standard</option>
            <option value="family">Family</option>
            <option value="pro">Pro</option>
            <option value="pro_family">Pro Family</option>
            <option value="privacy">Privacy</option>
            <option value="enterprise">Enterprise (white-label)</option>
            <option value="enterprise">Enterprise</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="temp">Temp Password</option>
          </select>
        </div>
      </div>

      {/* Bulk Action Header when rows are selected */}
      {selectedUserIds.size > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-xs">
          <div className="font-semibold text-primary">
            {selectedUserIds.size} user{selectedUserIds.size === 1 ? '' : 's'} selected
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors"
            >
              <Trash2 size={13} />
              Delete Selected
            </button>
            <button
              onClick={() => setSelectedUserIds(new Set())}
              className="text-xs text-text-secondary hover:text-text-primary px-2 py-1"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Errors */}
      {usersQuery.isError && (
        <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400" role="alert">
          {usersQuery.error.message}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-2xl border border-border-light bg-surface-primary shadow-sm">
        {usersQuery.isLoading && users.length === 0 ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center text-text-secondary">
            <p className="text-xs">
              {search || roleFilter !== 'all' || tierFilter !== 'all'
                ? 'No users match the active criteria.'
                : localize('com_admin_users_empty') || 'No users found.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border-light bg-surface-secondary/70 font-semibold text-text-secondary uppercase tracking-wider">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    className="rounded border-border-medium bg-surface-primary text-primary focus:ring-0"
                  />
                </th>
                <th className="py-3 px-4">{localize('com_admin_users_name') || 'User'}</th>
                <th className="py-3 px-4">{localize('com_admin_users_email') || 'Email'}</th>
                <th className="py-3 px-4">{localize('com_admin_users_role') || 'Role'}</th>
                <th className="py-3 px-4">{localize('com_admin_users_account_type') || 'Plan Tier'}</th>
                <th className="py-3 px-4">Family Seat</th>
                        <th className="py-3 px-4">One-API Seat</th>
                <th className="py-3 px-4">{localize('com_admin_users_status') || 'Status'}</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {filtered.map((user) => {
                const isSelected = selectedUserIds.has(user.id);

                return (
                  <tr
                    key={user.id}
                    className={`transition-colors ${
                      isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-surface-secondary/50'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(user.id)}
                        className="rounded border-border-medium bg-surface-primary text-primary focus:ring-0"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {user.avatar ? (
                          <img className="h-7 w-7 rounded-full object-cover" src={user.avatar} alt="" />
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-secondary text-xs font-bold text-text-primary border border-border-light">
                            {(user.name || user.email || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-text-primary">{user.name || user.username || '—'}</div>
                          {user.username && user.name && (
                            <div className="text-[11px] text-text-tertiary">@{user.username}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-text-secondary font-mono text-[11px]">{user.email}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize ${
                          user.role === 'admin'
                            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                            : 'bg-surface-secondary text-text-secondary border border-border-light'
                        }`}
                      >
                        {user.role || 'user'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 capitalize">
                        {user.accountType || 'free'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {user.seatAssigned ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          title={`Seat token ${user.seatTokenHint ?? ''}`}
                        >
                          <Zap size={11} /> Active
                        </span>
                      ) : (
                        <span className="text-[11px] text-text-secondary">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-text-secondary capitalize">
                      {user.familyRole ? (
                        <span className="inline-flex items-center gap-1 rounded bg-surface-secondary px-1.5 py-0.5 text-[11px] border border-border-light">
                          {user.familyRole}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {user.suspended ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          <Lock size={11} /> Suspended
                        </span>
                      ) : user.mustChangePassword ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <Clock size={11} /> Temp Pass
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 size={11} /> Active
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-secondary transition-colors"
                          title="Edit User"
                          onClick={() => setEditingUser(user)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className={`p-1.5 rounded-lg hover:bg-surface-secondary transition-colors ${user.suspended ? 'text-rose-500 hover:text-emerald-500' : 'text-text-secondary hover:text-rose-500'}`}
                          title={user.suspended ? 'Unsuspend User' : 'Suspend User'}
                          onClick={() => handleToggleSuspend(user)}
                          disabled={updateMutation.isPending}
                        >
                          {user.suspended ? <Unlock size={14} /> : <Lock size={14} />}
                        </button>
                        <button
                          className="p-1.5 text-text-secondary hover:text-emerald-500 rounded-lg hover:bg-surface-secondary transition-colors"
                          title="Assign / change One-API seat (licence)"
                          onClick={() => setSeatEditing({ userId: user.id, email: user.email, accountType: user.accountType || '' })}
                        >
                          <Zap size={14} />
                        </button>
                        {user.seatAssigned && (
                          <button
                            className="p-1.5 text-text-secondary hover:text-rose-500 rounded-lg hover:bg-surface-secondary transition-colors"
                            title="Revoke the One-API seat token"
                            onClick={() => handleRevokeSeat(user)}
                            disabled={revokeSeatMutation.isPending}
                          >
                            <Ban size={14} />
                          </button>
                        )}
                        <button
                          className="p-1.5 text-text-secondary hover:text-amber-500 rounded-lg hover:bg-surface-secondary transition-colors"
                          title="Reset Password"
                          onClick={() => handleResetPassword(user)}
                          disabled={resetPasswordMutation.isPending}
                        >
                          <KeyRound size={14} />
                        </button>
                        <button
                          className="p-1.5 text-text-secondary hover:text-rose-500 rounded-lg hover:bg-surface-secondary transition-colors"
                          title="Delete User"
                          onClick={() => handleDelete(user)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="mt-4 flex items-center justify-between text-xs text-text-secondary">
        <div>
          Showing {filtered.length} of {total} total user{total === 1 ? '' : 's'}
        </div>
        <div className="flex items-center gap-2">
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <button
            className="rounded-lg border border-border-light p-1.5 hover:bg-surface-secondary disabled:opacity-40 transition-colors"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            title="Previous page"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            className="rounded-lg border border-border-light p-1.5 hover:bg-surface-secondary disabled:opacity-40 transition-colors"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            title="Next page"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Password Reset Modal */}
      {resetResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border-medium bg-surface-primary p-6 shadow-2xl">
            <h3 className="text-base font-bold text-text-primary">Temporary Password Generated</h3>
            <p className="mt-2 text-xs text-text-secondary">
              A temporary password has been minted for <span className="font-semibold text-text-primary">{resetResult.email}</span>. The user will be required to change it on their next login.
            </p>
            <div className="my-4 rounded-xl border border-border-light bg-surface-secondary p-3 text-center">
              <code className="text-sm font-mono font-bold text-primary select-all">
                {resetResult.tempPassword}
              </code>
            </div>
            <div className="flex justify-end">
              <button
                className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
                onClick={() => setResetResult(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateUser
          onClose={() => {
            setShowCreate(false);
            if (onClearInitialCreate) onClearInitialCreate();
          }}
          onSuccess={() => {
            setShowCreate(false);
            if (onClearInitialCreate) onClearInitialCreate();
            usersQuery.refetch();
          }}
        />
      )}

      {seatEditing && (
        <SeatDialog target={seatEditing} onClose={() => setSeatEditing(null)} />
      )}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSuccess={() => {
            setEditingUser(null);
            usersQuery.refetch();
          }}
        />
      )}

      {showBulkImport && (
        <BulkImportDialog
          onClose={() => setShowBulkImport(false)}
          onSuccess={() => {
            setShowBulkImport(false);
            usersQuery.refetch();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit User Modal
// ---------------------------------------------------------------------------

function EditUserModal({
  user,
  onClose,
  onSuccess,
}: {
  user: AdminUserListItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const updateMutation = useUpdateUserMutation();
  const [name, setName] = useState(user.name || '');
  const [username, setUsername] = useState(user.username || '');
  const [role, setRole] = useState(user.role || 'user');
  const [accountType, setAccountType] = useState(user.accountType || '');
  const [familyRole, setFamilyRole] = useState(user.familyRole || '');
  const [mustChangePassword, setMustChangePassword] = useState(user.mustChangePassword || false);
  const [suspended, setSuspended] = useState(user.suspended || false);
  const [dailyMessageLimit, setDailyMessageLimit] = useState<number | string>(user.dailyMessageLimit ?? '');
  const [error, setError] = useState<string | null>(null);

  // Licence-group membership: the tenant IT guy's primary workflow. Visibility
  // is gated by the caller's effective capabilities — manage:groups enables
  // add/remove; read:groups shows the memberships read-only.
  const capsQuery = useEffectiveCapabilitiesQuery();
  const canManageGroups = hasCapability(capsQuery.data?.capabilities, 'manage:groups');
  const groupsQuery = useGroupsQuery();
  const userGroupsQuery = useUserGroupsQuery(user.id);
  const userGroupIds = new Set((userGroupsQuery.data?.groups ?? []).map((g) => g.id));
  const joinableGroups = (groupsQuery.data ?? []).filter((g) => !userGroupIds.has(g._id));

  const handleAddToGroup = async (groupId: string) => {
    setError(null);
    try {
      // The endpoint binds to the group id; the '__add__' placeholder groupId
      // on the mutation object is unused for these two calls.
      await fetch(`/api/admin/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      userGroupsQuery.refetch();
    } catch (err) {
      setError(`Failed to add user to group: ${(err as Error).message}`);
    }
  };

  const handleRemoveFromGroup = async (groupId: string) => {
    setError(null);
    try {
      await fetch(`/api/admin/groups/${groupId}/members/${user.id}`, { method: 'DELETE' });
      userGroupsQuery.refetch();
    } catch (err) {
      setError(`Failed to remove user from group: ${(err as Error).message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const parsedLimit = dailyMessageLimit === '' ? null : Number(dailyMessageLimit);
      const payload: UpdateUserPayload = {
        name: name.trim() || undefined,
        username: username.trim() || undefined,
        role: role.trim() || undefined,
        accountType: (accountType.trim() as any) || null,
        familyRole: (familyRole.trim() as any) || null,
        mustChangePassword,
        suspended,
        dailyMessageLimit: Number.isFinite(parsedLimit) ? parsedLimit : null,
      };
      await updateMutation.mutateAsync({ userId: user.id, payload });
      onSuccess();
    } catch (err) {
      setError((err as Error).message || 'Failed to update user');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border-medium bg-surface-primary p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-border-light">
          <div>
            <h2 className="text-base font-bold text-text-primary">Edit User Profile</h2>
            <p className="text-xs text-text-secondary mt-0.5">{user.email}</p>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block font-semibold text-text-secondary mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-text-secondary mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="standard">Standard</option>
                <option value="pro">Pro</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-text-secondary mb-1">Account Tier</label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                className="w-full rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="">None / Free</option>
                <option value="basic">Basic</option>
                <option value="standard">Standard</option>
                <option value="family">Family</option>
                <option value="pro">Pro</option>
                <option value="pro_family">Pro Family</option>
                <option value="privacy">Privacy</option>
                <option value="enterprise">Enterprise (white-label)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-text-secondary mb-1">Family Seat Role</label>
            <select
              value={familyRole}
              onChange={(e) => setFamilyRole(e.target.value)}
              className="w-full rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
            >
              <option value="">None (Individual)</option>
              <option value="owner">Owner (Primary)</option>
              <option value="adult">Adult Supervisor</option>
              <option value="minor">Minor / Dependent</option>
            </select>
          </div>

          {canManageGroups || (userGroupsQuery.data?.groups ?? []).length > 0 ? (
            <div>
              <label className="block font-semibold text-text-secondary mb-1">
                Licence Groups {canManageGroups ? '' : '(read-only)'}
              </label>
              <div className="space-y-2">
                {(userGroupsQuery.data?.groups ?? []).map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs"
                  >
                    <span className="font-semibold text-text-primary capitalize">{g.name}</span>
                    {canManageGroups && (
                      <button
                        type="button"
                        onClick={() => handleRemoveFromGroup(g.id)}
                        className="rounded-lg border border-border-light px-2.5 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-500/10 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                {canManageGroups && joinableGroups.length > 0 && (
                  <select
                    className="w-full rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
                    value=""
                    onChange={(e) => e.target.value && handleAddToGroup(e.target.value)}
                  >
                    <option value="">+ Add to licence group…</option>
                    {joinableGroups.map((g) => (
                      <option key={g._id} value={g._id}>
                        {g.name}
                        {g.accountType ? ` (${g.accountType})` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {!canManageGroups && (userGroupsQuery.data?.groups ?? []).length === 0 && (
                  <div className="text-[11px] text-text-secondary">No licence groups assigned.</div>
                )}
              </div>
              <p className="text-[11px] text-text-secondary mt-1">
                Membership places the user into the group's licence policy. Seat assignment
                (Users list, lightning icon) mints the One-API credential.
              </p>
            </div>
          ) : null}

          <div>
            <label className="block font-semibold text-text-secondary mb-1">Daily Message Limit (Optional)</label>
            <input
              type="number"
              placeholder="Unlimited"
              min="1"
              value={dailyMessageLimit}
              onChange={(e) => setDailyMessageLimit(e.target.value)}
              className="w-full rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="mustChangePassword"
                checked={mustChangePassword}
                onChange={(e) => setMustChangePassword(e.target.checked)}
                className="rounded border-border-medium bg-surface-primary text-primary focus:ring-0"
              />
              <label htmlFor="mustChangePassword" className="text-xs text-text-primary">
                Must change password on next sign-in
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="userSuspended"
                checked={suspended}
                onChange={(e) => setSuspended(e.target.checked)}
                className="rounded border-border-medium bg-surface-primary text-rose-500 focus:ring-0"
              />
              <label htmlFor="userSuspended" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                Suspend Account (Freeze all logins & access)
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border-light">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border-light bg-surface-secondary px-4 py-2 text-xs font-semibold text-text-primary hover:bg-surface-tertiary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bulk Import Dialog
// ---------------------------------------------------------------------------

function BulkImportDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const localize = useLocalize();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slips, setSlips] = useState<
    Array<{ email: string; temporaryPassword?: string; seatToken?: string }>
  >([]);

  const bulkMutation = useBulkCreateUsersMutation();

  const handleDownloadTemplate = async () => {
    try {
      const template = await fetchCsvTemplate();
      const blob = new Blob([template], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'user-import-template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Failed to download template: ${(err as Error).message}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText((event.target?.result as string) || '');
    };
    reader.readAsText(file);
  };

  const parseCsvToUsers = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length <= 1) return [];

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const emailIdx = headers.indexOf('email');
    const nameIdx = headers.indexOf('name');
    const roleIdx = headers.indexOf('role');
    const userIdx = headers.indexOf('username');

    if (emailIdx === -1) {
      throw new Error("CSV missing required 'email' column header.");
    }

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      const email = cols[emailIdx];
      if (email) {
        rows.push({
          email,
          name: nameIdx !== -1 ? cols[nameIdx] : undefined,
          role: roleIdx !== -1 ? cols[roleIdx] : 'user',
          username: userIdx !== -1 ? cols[userIdx] : undefined,
        });
      }
    }
    return rows;
  };

  const handleImport = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const usersToImport = parseCsvToUsers(csvText);
      if (usersToImport.length === 0) {
        throw new Error('No valid user rows found in CSV text.');
      }

      const res = await bulkMutation.mutateAsync({ users: usersToImport });
      if (res.slips && res.slips.length > 0) {
        setSlips(res.slips);
      } else {
        onSuccess();
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to import users');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadSlips = () => {
    const csvContent = [
      'Email,TemporaryPassword,SeatToken',
      ...slips.map((s) => `${s.email},${s.temporaryPassword || ''},${s.seatToken || ''}`),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `provisioned-credential-slips-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-border-medium bg-surface-primary p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-border-light">
          <div className="flex items-center gap-2">
            <Upload size={18} className="text-primary" />
            <h2 className="text-base font-bold text-text-primary">Bulk User Provisioning (CSV)</h2>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        {slips.length > 0 ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs text-emerald-600 dark:text-emerald-400">
              <div className="font-bold">Successfully provisioned {slips.length} users!</div>
              <p className="mt-1">
                Download the credential slips containing temporary passwords to distribute to your users.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handleDownloadSlips}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
              >
                <Download size={14} />
                Download Credential Slips (CSV)
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">Paste CSV rows or choose a local file:</span>
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1 text-xs text-primary hover:underline font-semibold"
              >
                <FileText size={13} />
                Download CSV Template
              </button>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
                {error}
              </div>
            )}

            <textarea
              className="w-full h-40 rounded-xl border border-border-light bg-surface-secondary p-3 text-xs font-mono text-text-primary focus:outline-none focus:border-primary resize-none"
              placeholder={`email,name,role,username\nalice@satchida.com,Alice Smith,user,asmith\nbob@satchida.com,Bob Jones,user,bjones`}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv"
              className="hidden"
            />

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs font-semibold text-text-primary hover:bg-surface-tertiary transition-colors"
              >
                Browse File...
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-border-light bg-surface-secondary px-4 py-2 text-xs font-semibold text-text-primary hover:bg-surface-tertiary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={!csvText.trim() || isSubmitting}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isSubmitting ? 'Provisioning...' : 'Start Import'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// SeatDialog: mint/rotate the per-user One-API seat token (R1). The backend
// derives the seat policy from the licence group and stores the token on the
// user; every relay from this user then attributes to the right tenant.
// ---------------------------------------------------------------------------
const SEAT_TYPES = ['basic', 'standard', 'family', 'pro', 'pro_family', 'privacy', 'enterprise'];

function SeatDialog({
  target,
  onClose,
}: {
  target: { userId: string; email: string; accountType: string };
  onClose: () => void;
}) {
  const [accountType, setAccountType] = useState(target.accountType || 'basic');
  const assignMutation = useAssignSeatTokenMutation();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await assignMutation.mutateAsync({ userId: target.userId, payload: { accountType } });
      alert(`Seat assigned: ${res.accountType} (alias ${res.seatAlias})`);
      onClose();
    } catch (err) {
      alert(`Failed to assign seat: ${(err as Error).message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-border-medium bg-surface-primary p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between pb-4 border-b border-border-light">
          <div>
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              <Zap size={16} className="text-emerald-500" />
              Assign seat — {target.email}
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Mints an One-API seat token inside this user's tenant. The licence type sets the
              seat's policy group, ceilings and attribution.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        <div className="my-4 space-y-3">
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Licence type</label>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              className="w-full rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
            >
              {SEAT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-text-secondary">
            Re-assigning rotates the seat token: the previous key is disabled before the new one
            is issued, so the user's access moves cleanly.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border-light">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border-light bg-surface-secondary px-4 py-2 text-xs font-semibold text-text-primary hover:bg-surface-tertiary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={assignMutation.isPending}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {assignMutation.isPending ? 'Minting…' : 'Assign seat'}
          </button>
        </div>
      </form>
    </div>
  );
}
