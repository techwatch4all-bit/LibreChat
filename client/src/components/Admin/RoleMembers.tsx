import { useState } from 'react';
import { Spinner } from '@librechat/client';
import { Search } from 'lucide-react';
import { useLocalize } from '~/hooks';
import {
  useRoleMembersQuery,
  useAddRoleMemberMutation,
  useRemoveRoleMemberMutation,
  type RoleListItem,
} from '~/data-provider/admin/roles';
import { useSearchUsersQuery } from '~/data-provider/admin/users';

interface RoleMembersProps {
  role: RoleListItem;
  onClose: () => void;
}

export default function RoleMembers({ role, onClose }: RoleMembersProps) {
  const localize = useLocalize();
  const membersQuery = useRoleMembersQuery(role.name);
  const removeMemberMutation = useRemoveRoleMemberMutation(role.name);
  const [searchQuery, setSearchQuery] = useState('');
  const userSearchQuery = useSearchUsersQuery(searchQuery, Boolean(searchQuery));
  const addMemberMutation = useAddRoleMemberMutation(role.name);

  const existingMemberIds = new Set(membersQuery.data?.members.map((m) => m.userId));
  const availableUsers = (userSearchQuery.data?.users ?? []).filter(
    (u) => !existingMemberIds.has(u.id),
  );

  const handleRemove = async (userId: string) => {
    if (!confirm('Remove this member from the role?')) return;
    await removeMemberMutation.mutateAsync(userId);
    membersQuery.refetch();
  };

  const handleAdd = async (userId: string) => {
    await addMemberMutation.mutateAsync(userId);
    membersQuery.refetch();
    setSearchQuery('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-3xl rounded-lg bg-surface-primary border border-border-light p-6 shadow-xl max-h-[80vh] overflow-auto text-text-primary">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Members of "{role.name}"
          </h2>
          <button
            className="text-text-secondary hover:text-text-primary"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* Add member */}
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
              <input
                className="w-full rounded border border-border-light bg-surface-secondary pl-10 pr-3 py-2 text-sm text-text-primary placeholder-text-secondary"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users to add..."
              />
            </div>
          </div>

          {searchQuery && userSearchQuery.isLoading && (
            <div className="mt-2 flex justify-center py-4">
              <Spinner />
            </div>
          )}

          {availableUsers.length > 0 && (
            <div className="mt-2 border-t border-border-light pt-2">
              <p className="mb-2 text-xs text-text-secondary">Available users:</p>
              {availableUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-1">
                  <span className="text-sm">{u.name || u.email}</span>
                  <button
                    className="text-xs font-medium text-text-primary hover:underline"
                    onClick={() => handleAdd(u.id)}
                    disabled={addMemberMutation.isPending}
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Members list */}
        {membersQuery.isLoading ? (
          <div className="py-4 text-center">
            <Spinner />
          </div>
        ) : membersQuery.isError ? (
          <p className="text-sm text-red-500" role="alert">
            {membersQuery.error.message}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-light text-text-secondary">
                <th className="pb-2">Name</th>
                <th className="pb-2">Email</th>
                <th className="pb-2">Joined</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {membersQuery.data?.members.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-text-secondary">
                    No members in this role.
                  </td>
                </tr>
              ) : (
                membersQuery.data?.members.map((m) => (
                  <tr key={m.userId} className="border-b border-border-light">
                    <td className="py-2">{m.name}</td>
                    <td className="py-2">{m.email}</td>
                    <td className="py-2">{m.joinedAt || '-'}</td>
                    <td className="py-2 text-right">
                      <button
                        className="text-xs text-red-500 hover:text-red-700"
                        onClick={() => handleRemove(m.userId)}
                        disabled={removeMemberMutation.isPending}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {membersQuery.data && (
          <div className="mt-3 text-xs text-text-secondary">
            {membersQuery.data.total ?? 0} total members
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button className="rounded border border-border-light px-4 py-2 text-sm text-text-primary hover:bg-surface-secondary" onClick={onClose}>
            {localize('com_ui_close')}
          </button>
        </div>
      </div>
    </div>
  );
}
