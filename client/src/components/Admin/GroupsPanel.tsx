import { useMemo, useState } from 'react';
import { Spinner } from '@librechat/client';
import {
  Layers,
  Plus,
  Users,
  Search,
  Shield,
  Trash2,
  ChevronRight,
  UserCheck,
  UserX,
  X,
  CheckCircle2,
  Settings,
  AlertCircle,
  Eye,
  Lock,
} from 'lucide-react';
import { useLocalize } from '~/hooks';
import type { TenantAccountType, TenantSeatCapability } from 'librechat-data-provider';
import {
  useGroupsQuery,
  useGroupMembersQuery,
  useCreateGroupMutation,
  useDeleteGroupMutation,
  useRemoveGroupMemberMutation,
  useAddGroupMemberMutation,
  GROUP_ACCOUNT_TYPES,
  type AdminGroup,
} from '~/data-provider/admin/groups';
import { useSearchUsersQuery } from '~/data-provider/admin/users';
import { useEffectiveCapabilitiesQuery, hasCapability } from '~/data-provider/admin/grants';

const ACCOUNT_TYPES = GROUP_ACCOUNT_TYPES;
const MODES = ['Chat', 'Study', 'Work', 'Privacy'] as const;
const CAPABILITIES = ['work_tools', 'mcp', 'agents', 'code_execution'] as const;

interface GroupsPanelProps {
  initialCreateOpen?: boolean;
  onClearInitialCreate?: () => void;
}

const canManage = (caps?: string[]) => hasCapability(caps, 'manage:groups');

export default function GroupsPanel({
  initialCreateOpen = false,
  onClearInitialCreate,
}: GroupsPanelProps) {
  const localize = useLocalize();
  const capsQuery = useEffectiveCapabilitiesQuery();
  const canManageGroups = canManage(capsQuery.data?.capabilities);
  const groupsQuery = useGroupsQuery();
  const deleteMutation = useDeleteGroupMutation();

  const [selectedGroup, setSelectedGroup] = useState<AdminGroup | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(initialCreateOpen);
  const [editingTarget, setEditingTarget] = useState<AdminGroup | undefined>(undefined);
  const [search, setSearch] = useState<string>('');
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>('all');

  const groups = useMemo(() => groupsQuery.data?.groups ?? [], [groupsQuery.data]);

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          g.name.toLowerCase().includes(q) ||
          g.description?.toLowerCase().includes(q) ||
          g.accountType?.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (accountTypeFilter !== 'all' && (g.accountType || 'none') !== accountTypeFilter) {
        return false;
      }
      return true;
    });
  }, [groups, search, accountTypeFilter]);

  const handleDelete = async (group: AdminGroup) => {
    if (
      !confirm(
        `Delete policy group "${group.name}"? Members assigned to this group will lose group-specific policies.`,
      )
    ) {
      return;
    }
    await deleteMutation.mutateAsync(group.name);
    if (selectedGroup?.name === group.name) {
      setSelectedGroup(null);
    }
    groupsQuery.refetch();
  };

  return (
    <div className="flex h-full flex-col overflow-auto p-6 md:p-8 bg-surface-primary text-text-primary max-w-7xl mx-auto w-full">
      {/* Top Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              {localize('com_admin_groups_title') || 'Commercial Policy Groups'}
            </h1>
            <span className="rounded-full bg-surface-secondary border border-border-light px-2.5 py-0.5 text-xs font-semibold text-text-secondary">
              {groups.length} Groups
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Map organization units to One-API policy entitlements, supervise family limits, and enforce privacy execution rules.
          </p>
        </div>

        {canManageGroups && (
          <button
            onClick={() => {
              setEditingTarget(undefined);
              setIsEditing(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
          >
            <Plus size={15} />
            {localize('com_admin_groups_new') || 'Create Policy Group'}
          </button>
        )}
      </div>

      {/* Filter / Search Bar */}
      <div className="mb-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={15} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search groups by name, description, or entitlement..."
            className="w-full rounded-xl border border-border-light bg-surface-secondary pl-9 pr-4 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary"
          />
        </div>

        <select
          value={accountTypeFilter}
          onChange={(e) => setAccountTypeFilter(e.target.value)}
          className="rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
        >
          <option value="all">All Group Types</option>
          {ACCOUNT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {/* Main Grid View */}
      {groupsQuery.isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border-light bg-surface-secondary/30 p-8 text-center text-text-secondary">
          <Layers className="h-10 w-10 text-text-tertiary mb-3" />
          <div className="text-sm font-semibold text-text-primary">No policy groups found</div>
          <p className="text-xs text-text-secondary mt-1 max-w-sm">
            {search ? 'Try clearing your search query or filters.' : 'Get started by creating your first commercial policy group.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredGroups.map((group) => {
            const isFamily = group.accountType === 'family';

            return (
              <div
                key={group.name}
                className="group relative flex flex-col justify-between rounded-2xl border border-border-light bg-surface-secondary/60 hover:bg-surface-secondary p-5 transition-all shadow-sm hover:shadow hover:border-primary/40"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="rounded-xl bg-purple-500/10 p-2.5 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                        <Layers size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors">
                          {group.name}
                        </h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-tertiary text-text-secondary uppercase">
                          {group.accountType || 'Generic Group'}
                        </span>
                      </div>
                    </div>

                    {canManageGroups && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(group)}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 text-text-tertiary hover:text-rose-500 rounded-lg hover:bg-surface-tertiary transition-colors"
                          title="Delete group"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-text-secondary line-clamp-2 min-h-[32px] mb-4">
                    {group.description || 'No description provided for this policy group.'}
                  </p>

                  {/* Policy Chips */}
                  <div className="space-y-2 pt-3 border-t border-border-light text-[11px]">
                    {isFamily && (
                      <div className="flex items-center justify-between text-text-secondary">
                        <span>Family Seats:</span>
                        <span className="font-semibold text-text-primary">
                          {group.familySeats?.maxAdults ?? 2} Adults / {group.familySeats?.maxChildren ?? 2} Minors
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-text-secondary">
                      <span>Local Privacy:</span>
                      <span className={group.localPrivacyEnabled ? 'text-emerald-500 font-semibold' : 'text-text-tertiary'}>
                        {group.localPrivacyEnabled ? 'Enforced' : 'Disabled'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-text-secondary">
                      <span>Capabilities:</span>
                      <span className="text-text-primary font-medium">
                        {group.allowedCapabilities?.length ? `${group.allowedCapabilities.length} enabled` : 'Default'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="mt-5 pt-3 border-t border-border-light flex items-center justify-between">
                  <button
                    onClick={() => setSelectedGroup(group)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                  >
                    <Users size={13} />
                    View Members
                  </button>

                  <span className="text-[10px] font-mono text-text-tertiary">
                    {group.shared ? 'Shared Quota' : 'Per-seat Quota'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Group Member Drawer / Modal */}
      {selectedGroup && (
        <GroupMembersModal
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
        />
      )}

      {/* Group Editor Drawer / Modal */}
      {isEditing && (
        <GroupEditorModal
          group={editingTarget}
          onClose={() => {
            setIsEditing(false);
            if (onClearInitialCreate) onClearInitialCreate();
          }}
          onSaved={() => {
            setIsEditing(false);
            if (onClearInitialCreate) onClearInitialCreate();
            groupsQuery.refetch();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group Members Inspection Modal
// ---------------------------------------------------------------------------

function GroupMembersModal({ group, onClose }: { group: AdminGroup; onClose: () => void }) {
  const membersQuery = useGroupMembersQuery(group.name);
  const removeMutation = useRemoveGroupMemberMutation();
  const addMutation = useAddGroupMemberMutation(group._id);
  const searchQuery = useSearchUsersQuery(searchText);
  const members = membersQuery.data?.members ?? [];
  const memberIds = new Set(members.map((m) => m.id));
  const candidates = (searchQuery.data?.users ?? []).filter((u) => !memberIds.has(u.id));

  const handleAdd = async (userId: string) => {
    try {
      await addMutation.mutateAsync(userId);
      membersQuery.refetch();
    } catch (err) {
      alert(`Failed to add user: ${(err as Error).message}`);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm('Remove user from this policy group?')) return;
    await removeMutation.mutateAsync({ groupName: group.name, userId });
    membersQuery.refetch();
  };

  const [searchText, setSearchText] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border-medium bg-surface-primary p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-border-light">
          <div>
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              <Users size={16} className="text-primary" />
              Members of {group.name}
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Assigned users inheriting this group's policies and capabilities.
            </p>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        {/* Add-user picker: search the tenant's users and add them to this
            licence group. Candidate list excludes existing members. */}
        <div className="my-3 rounded-xl border border-border-light bg-surface-secondary p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary mb-2">
            Add a user to this group
          </div>
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search users by email or name…"
            className="w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
          />
          {searchText.trim().length > 0 && (
            <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
              {searchQuery.isLoading ? (
                <div className="py-2 text-center"><Spinner /></div>
              ) : candidates.length === 0 ? (
                <div className="py-2 text-center text-[11px] text-text-secondary">No matching users found.</div>
              ) : (
                candidates.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleAdd(u.id)}
                    disabled={addMutation.isPending}
                    className="flex w-full items-center justify-between rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-left text-xs hover:border-primary transition-colors"
                  >
                    <span>
                      <span className="font-semibold text-text-primary">{u.email}</span>
                      {u.accountType ? (
                        <span className="ml-2 text-[10px] text-text-secondary capitalize">{u.accountType}</span>
                      ) : null}
                    </span>
                    <span className="text-[11px] font-medium text-primary">Add</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="my-4 max-h-80 overflow-y-auto space-y-2">
          {membersQuery.isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Spinner />
            </div>
          ) : members.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-secondary">
              No users currently assigned to this group.
            </div>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-xl border border-border-light bg-surface-secondary p-3 text-xs"
              >
                <div>
                  <div className="font-semibold text-text-primary">{member.name || member.username || 'Unnamed'}</div>
                  <div className="text-[11px] font-mono text-text-secondary">{member.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  {member.accountType && (
                    <span className="inline-flex items-center rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold capitalize text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      {member.accountType}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleRemove(member.id)}
                  disabled={removeMutation.isPending}
                  className="rounded-lg border border-border-light px-2.5 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-500/10 transition-colors"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-border-light">
          <button
            onClick={onClose}
            className="rounded-xl border border-border-light bg-surface-secondary px-4 py-2 text-xs font-semibold text-text-primary hover:bg-surface-tertiary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group Editor Modal
// ---------------------------------------------------------------------------

function GroupEditorModal({
  group,
  onClose,
  onSaved,
}: {
  group?: AdminGroup;
  onClose: () => void;
  onSaved: () => void;
}) {
  const localize = useLocalize();
  const createMutation = useCreateGroupMutation();

  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [accountType, setAccountType] = useState<string>(group?.accountType ?? '');
  const [shared, setShared] = useState(group?.shared ?? false);
  const [maxAdults, setMaxAdults] = useState(group?.familySeats?.maxAdults ?? 2);
  const [maxChildren, setMaxChildren] = useState(group?.familySeats?.maxChildren ?? 2);
  const [localPrivacyEnabled, setLocalPrivacyEnabled] = useState(group?.localPrivacyEnabled ?? false);
  const [allowedModes, setAllowedModes] = useState<string[]>(group?.allowedModes ?? []);
  const [allowedCapabilities, setAllowedCapabilities] = useState<string[]>(
    group?.allowedCapabilities ?? [],
  );

  const isFamily = accountType === 'family';

  const toggle = (list: string[], val: string, setter: (next: string[]) => void) => {
    setter(list.includes(val) ? list.filter((i) => i !== val) : [...list, val]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      accountType: (accountType || undefined) as TenantAccountType | undefined,
      shared: isFamily ? shared : false,
      familySeats: isFamily ? { maxAdults, maxChildren } : undefined,
      localPrivacyEnabled,
      allowedModes: allowedModes.length ? allowedModes : undefined,
      allowedCapabilities: (allowedCapabilities.length
        ? allowedCapabilities
        : undefined) as TenantSeatCapability[] | undefined,
    };

    try {
      await createMutation.mutateAsync(payload);
      onSaved();
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border-medium bg-surface-primary p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-border-light">
          <h2 className="text-base font-bold text-text-primary">
            {group ? `Edit ${group.name}` : 'Create Commercial Policy Group'}
          </h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        {createMutation.error && (
          <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
            {(createMutation.error as Error).message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Group Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. engineering-pro, standard-tier"
              disabled={!!group}
              className="w-full rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-text-secondary mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of group purpose..."
              className="w-full rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block font-semibold text-text-secondary mb-1">Account / Product Line</label>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              className="w-full rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
            >
              <option value="">None / Custom</option>
              {ACCOUNT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {isFamily && (
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-3">
              <div className="font-semibold text-purple-600 dark:text-purple-400">Family Seat Policy</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-text-secondary mb-1">Max Adults</label>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={maxAdults}
                    onChange={(e) => setMaxAdults(Number(e.target.value))}
                    className="w-full rounded-lg border border-border-light bg-surface-primary px-2.5 py-1.5 text-xs text-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-text-secondary mb-1">Max Children</label>
                  <input
                    type="number"
                    min={0}
                    max={6}
                    value={maxChildren}
                    onChange={(e) => setMaxChildren(Number(e.target.value))}
                    className="w-full rounded-lg border border-border-light bg-surface-primary px-2.5 py-1.5 text-xs text-text-primary"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="localPrivacy"
              checked={localPrivacyEnabled}
              onChange={(e) => setLocalPrivacyEnabled(e.target.checked)}
              className="rounded border-border-medium bg-surface-primary text-primary focus:ring-0"
            />
            <label htmlFor="localPrivacy" className="text-xs text-text-primary font-medium">
              Enforce Local GPU Privacy Mode
            </label>
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
              disabled={createMutation.isPending}
              className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Saving...' : 'Save Policy Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
