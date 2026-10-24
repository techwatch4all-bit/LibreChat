import { useMemo, useState } from 'react';
import { Spinner } from '@librechat/client';
import { useLocalize } from '~/hooks';
import type { TenantAccountType, TenantSeatCapability } from 'librechat-data-provider';
import {
  useGroupsQuery,
  useGroupMembersQuery,
  useCreateGroupMutation,
  useDeleteGroupMutation,
  useRemoveGroupMemberMutation,
  GROUP_ACCOUNT_TYPES,
  type AdminGroup,
} from '~/data-provider/admin/groups';

/**
 * Tenant admin panel for commercial groups.
 *
 * A group is one product line inside a tenant and maps one-to-one onto a
 * One-API group of the same name, so the account type recorded here is the same
 * entitlement the operator's policy will enforce. The panel is the tenant's own
 * view of that mapping.
 *
 * The family shape is part of the product rather than an accident of
 * membership: a Family group is two adults and at most two children, so a
 * parent can supervise what a minor sends and receives.
 */

const ACCOUNT_TYPES = GROUP_ACCOUNT_TYPES;

const MODES = ['Chat', 'Study', 'Work', 'Privacy'] as const;

const CAPABILITIES = ['work_tools', 'mcp', 'agents', 'code_execution'] as const;

const MAX_FAMILY_ADULTS = 2;
const MAX_FAMILY_CHILDREN = 2;

function GroupEditor({
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
  const [localPrivacyEnabled, setLocalPrivacyEnabled] = useState(
    group?.localPrivacyEnabled ?? false,
  );
  const [allowedModes, setAllowedModes] = useState<string[]>(group?.allowedModes ?? []);
  const [allowedCapabilities, setAllowedCapabilities] = useState<string[]>(
    group?.allowedCapabilities ?? [],
  );

  const isFamily = accountType === 'family';

  const toggle = (list: string[], value: string, setter: (next: string[]) => void) => {
    setter(list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]);
  };

  const submit = async () => {
    if (!name.trim()) {
      return;
    }
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
      onClose();
    } catch {
      /* the mutation surfaces the error below */
    }
  };

  const error = createMutation.error;

  return (
    <div className="flex h-full flex-col overflow-auto p-4">
      <h2 className="mb-4 text-lg font-semibold">
        {group ? group.name : localize('com_admin_groups_new')}
      </h2>

      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-medium">{localize('com_admin_groups_name')}</span>
        <input
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Pro"
        />
      </label>

      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-medium">
          {localize('com_admin_groups_description')}
        </span>
        <textarea
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
        />
      </label>

      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-medium">
          {localize('com_admin_groups_account_type')}
        </span>
        <select
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          value={accountType}
          onChange={(event) => setAccountType(event.target.value as TenantAccountType | '')}
        >
          <option value="">{localize('com_admin_groups_account_type_none')}</option>
          {ACCOUNT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      {isFamily && (
        <div className="mb-3 rounded border border-gray-200 p-3">
          <p className="mb-2 text-sm font-medium">{localize('com_admin_groups_family_shape')}</p>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <span>{localize('com_admin_groups_family_adults')}</span>
              <input
                type="number"
                min={0}
                max={MAX_FAMILY_ADULTS}
                className="w-16 rounded border border-gray-300 px-2 py-1"
                value={maxAdults}
                onChange={(event) => setMaxAdults(Number(event.target.value))}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span>{localize('com_admin_groups_family_children')}</span>
              <input
                type="number"
                min={0}
                max={MAX_FAMILY_CHILDREN}
                className="w-16 rounded border border-gray-300 px-2 py-1"
                value={maxChildren}
                onChange={(event) => setMaxChildren(Number(event.target.value))}
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {localize('com_admin_groups_family_shape_hint')}
          </p>
        </div>
      )}

      {isFamily && (
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={shared}
            onChange={(event) => setShared(event.target.checked)}
          />
          {localize('com_admin_groups_family_shared')}
        </label>
      )}

      <label className="mb-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={localPrivacyEnabled}
          onChange={(event) => setLocalPrivacyEnabled(event.target.checked)}
        />
        {localize('com_admin_groups_local_privacy')}
      </label>

      <div className="mb-3">
        <span className="mb-1 block text-sm font-medium">
          {localize('com_admin_groups_allowed_modes')}
        </span>
        <div className="flex flex-wrap gap-3">
          {MODES.map((mode) => (
            <label key={mode} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={allowedModes.includes(mode)}
                onChange={() => toggle(allowedModes, mode, setAllowedModes)}
              />
              {mode}
            </label>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <span className="mb-1 block text-sm font-medium">
          {localize('com_admin_groups_allowed_capabilities')}
        </span>
        <div className="flex flex-wrap gap-3">
          {CAPABILITIES.map((capability) => (
            <label key={capability} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={allowedCapabilities.includes(capability)}
                onChange={() => toggle(allowedCapabilities, capability, setAllowedCapabilities)}
              />
              {capability}
            </label>
          ))}
        </div>
      </div>

      {error && (
        <p className="mb-3 text-sm text-red-600" role="alert">
          {error.message}
        </p>
      )}

      <div className="flex gap-2">
        <button
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={submit}
          disabled={createMutation.isPending || !name.trim()}
        >
          {createMutation.isPending ? <Spinner /> : localize('com_admin_groups_save')}
        </button>
        <button
          className="rounded border border-gray-300 px-4 py-2 text-sm"
          onClick={onClose}
        >
          {localize('com_ui_cancel')}
        </button>
      </div>
    </div>
  );
}

function GroupMembers({ group }: { group: AdminGroup }) {
  const localize = useLocalize();
  const membersQuery = useGroupMembersQuery(group._id, { limit: 200 });
  const removeMutation = useRemoveGroupMemberMutation(group._id);

  if (membersQuery.isLoading) {
    return <Spinner />;
  }
  if (membersQuery.isError) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {membersQuery.error.message}
      </p>
    );
  }
  const members = membersQuery.data?.members ?? [];

  if (members.length === 0) {
    return <p className="text-sm text-gray-500">{localize('com_admin_groups_no_members')}</p>;
  }

  return (
    <ul className="divide-y divide-gray-100">
      {members.map((member) => (
        <li key={member.userId} className="flex items-center justify-between py-2 text-sm">
          <span>
            {member.name} {member.email && <span className="text-gray-500">({member.email})</span>}
          </span>
          <button
            className="text-xs text-red-600"
            onClick={() => removeMutation.mutate(member.userId)}
            disabled={removeMutation.isPending}
          >
            {localize('com_admin_groups_remove_member')}
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function AdminGroupsPanel() {
  const localize = useLocalize();
  const [search, setSearch] = useState('');
  const [accountType, setAccountType] = useState<string>('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const groupsQuery = useGroupsQuery(
    useMemo(
      () => ({
        search: search || undefined,
        accountType: accountType || undefined,
        limit: 100,
      }),
      [search, accountType],
    ),
  );
  const deleteMutation = useDeleteGroupMutation();

  const groups = groupsQuery.data?.groups ?? [];
  const selected = groups.find((group) => group._id === selectedId) ?? null;

  if (groupsQuery.isLoading) {
    return <Spinner />;
  }

  return (
    <div className="flex h-full flex-col overflow-auto p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">{localize('com_admin_groups_title')}</h1>
        <button
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
          onClick={() => setShowCreate(true)}
        >
          {localize('com_admin_groups_new')}
        </button>
      </div>

      <div className="mb-4 flex gap-3">
        <input
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={localize('com_admin_groups_search')}
        />
        <select
          className="rounded border border-gray-300 px-3 py-2 text-sm"
          value={accountType}
          onChange={(event) => setAccountType(event.target.value)}
        >
          <option value="">{localize('com_admin_groups_all_types')}</option>
          {ACCOUNT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {groupsQuery.isError && (
        <p className="mb-3 text-sm text-red-600" role="alert">
          {groupsQuery.error.message}
        </p>
      )}

      {showCreate && (
        <div className="mb-4 rounded border border-gray-200">
          <GroupEditor
            onClose={() => setShowCreate(false)}
            onSaved={() => groupsQuery.refetch()}
          />
        </div>
      )}

      {selected && (
        <div className="mb-4 rounded border border-gray-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{selected.name}</h2>
            <button className="text-xs text-gray-500" onClick={() => setSelectedId(null)}>
              {localize('com_ui_close')}
            </button>
          </div>
          <dl className="mb-3 grid grid-cols-2 gap-1 text-xs text-gray-600">
            <dt>{localize('com_admin_groups_account_type')}</dt>
            <dd>{selected.accountType ?? '-'}</dd>
            <dt>{localize('com_admin_groups_allowed_modes')}</dt>
            <dd>{selected.allowedModes?.join(', ') || '-'}</dd>
            <dt>{localize('com_admin_groups_allowed_capabilities')}</dt>
            <dd>{selected.allowedCapabilities?.join(', ') || '-'}</dd>
            <dt>{localize('com_admin_groups_local_privacy')}</dt>
            <dd>{selected.localPrivacyEnabled ? 'yes' : 'no'}</dd>
            {selected.accountType === 'family' && (
              <>
                <dt>{localize('com_admin_groups_family_shape')}</dt>
                <dd>
                  {selected.familySeats?.maxAdults ?? 2} / {selected.familySeats?.maxChildren ?? 2}
                </dd>
              </>
            )}
          </dl>
          <GroupMembers group={selected} />
        </div>
      )}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="py-2">{localize('com_admin_groups_name')}</th>
            <th className="py-2">{localize('com_admin_groups_account_type')}</th>
            <th className="py-2">{localize('com_admin_groups_members')}</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group._id} className="border-b border-gray-100">
              <td className="py-2">{group.name}</td>
              <td className="py-2">{group.accountType ?? '-'}</td>
              <td className="py-2">{(group.memberIds?.length ?? 0).toString()}</td>
              <td className="py-2 text-right">
                <button
                  className="mr-2 text-xs text-blue-600"
                  onClick={() => setSelectedId(group._id)}
                >
                  {localize('com_admin_groups_manage')}
                </button>
                <button
                  className="text-xs text-red-600"
                  onClick={() => deleteMutation.mutate(group._id)}
                  disabled={deleteMutation.isPending}
                >
                  {localize('com_admin_groups_delete')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {groups.length === 0 && (
        <p className="mt-4 text-sm text-gray-500">{localize('com_admin_groups_empty')}</p>
      )}
    </div>
  );
}