import { useState } from 'react';
import { Spinner } from '@librechat/client';
import { RefreshCw, ShieldCheck, Pencil, Plus, X } from 'lucide-react';
import {
  SEMANTIC_MODES,
  TENANT_ACCOUNT_TYPES,
  TENANT_ENTITLEMENT_STATUSES,
  TENANT_PLAN_TYPES,
} from 'librechat-data-provider';
import type { TenantEntitlementUpdate } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';
import {
  useEntitlementsQuery,
  useSetEntitlementMutation,
} from '~/data-provider/admin/entitlements';

interface AllocationDraft {
  seatLimit: number;
  allowedModes: string[];
  localPrivacyEnabled: boolean;
}

interface DraftEntitlement {
  tenantId: string;
  plan: string;
  status: string;
  seatLimit: number;
  accountTypes: Record<string, AllocationDraft>;
}

function draftFrom(
  tenantId: string,
  source?: TenantEntitlementUpdate & { activeSeats?: number },
): DraftEntitlement {
  const accountTypes: Record<string, AllocationDraft> = {};
  for (const [accountType, allocation] of Object.entries(source?.accountTypes ?? {})) {
    accountTypes[accountType] = {
      seatLimit: allocation.seatLimit,
      allowedModes: [...allocation.allowedModes],
      localPrivacyEnabled: allocation.localPrivacyEnabled === true,
    };
  }
  return {
    tenantId,
    plan: source?.plan ?? 'basic',
    status: source?.status ?? 'active',
    seatLimit: source?.seatLimit ?? 0,
    accountTypes,
  };
}

/** The seat limits and mode/tool allocations this panel edits. The data layer
 * is the authority — it refuses allocations that exceed the tenant seat limit,
 * family allocations that carry Work, and limits below assigned seats. */
export default function EntitlementsPanel() {
  const localize = useLocalize();
  const entitlementsQuery = useEntitlementsQuery();
  const [editing, setEditing] = useState<DraftEntitlement | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const mutation = useSetEntitlementMutation(editing?.tenantId ?? '');

  const entitlements = entitlementsQuery.data?.entitlements ?? [];

  const openEdit = (tenantId: string) => {
    const source = entitlements.find((entitlement) => entitlement.tenantId === tenantId);
    setEditing(draftFrom(tenantId, source));
    setIsNew(source == null);
  };

  const openCreate = () => {
    setEditing(draftFrom(''));
    setIsNew(true);
  };

  const handleSave = async () => {
    if (!editing || !editing.tenantId.trim()) {
      alert(localize('com_admin_entitlements_tenant_required'));
      return;
    }
    setSaving(true);
    try {
      const update: TenantEntitlementUpdate = {
        plan: editing.plan as TenantEntitlementUpdate['plan'],
        status: editing.status as TenantEntitlementUpdate['status'],
        seatLimit: editing.seatLimit,
        accountTypes: editing.accountTypes as TenantEntitlementUpdate['accountTypes'],
      };
      await mutation.mutateAsync(update);
      setEditing(null);
    } catch (err) {
      alert(`${localize('com_admin_entitlements_save_failed')}: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const updateAllocation = (accountType: string, patch: Partial<AllocationDraft>) => {
    setEditing((current) => {
      if (!current) {
        return current;
      }
      const existing = current.accountTypes[accountType] ?? {
        seatLimit: 0,
        allowedModes: [],
        localPrivacyEnabled: false,
      };
      return {
        ...current,
        accountTypes: {
          ...current.accountTypes,
          [accountType]: { ...existing, ...patch },
        },
      };
    });
  };

  const removeAllocation = (accountType: string) => {
    setEditing((current) => {
      if (!current) {
        return current;
      }
      const next = { ...current.accountTypes };
      delete next[accountType];
      return { ...current, accountTypes: next };
    });
  };

  const addAllocation = (accountType: string) => {
    updateAllocation(accountType, {});
  };

  const totalAllocated = editing
    ? Object.values(editing.accountTypes).reduce((sum, allocation) => sum + allocation.seatLimit, 0)
    : 0;

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-auto bg-surface-primary p-6 text-text-primary md:p-8">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ShieldCheck className="h-6 w-6" />
            {localize('com_admin_entitlements_title')}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {localize('com_admin_entitlements_subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => entitlementsQuery.refetch()}
            className="rounded-lg border border-border-light px-3 py-2 text-sm hover:bg-surface-hover"
            aria-label={localize('com_admin_entitlements_refresh')}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-text-primary px-3 py-2 text-sm text-surface-primary hover:opacity-90"
          >
            {localize('com_admin_entitlements_new')}
          </button>
        </div>
      </div>

      {entitlementsQuery.isLoading && (
        <div className="flex justify-center py-12">
          <Spinner aria-live="polite" />
        </div>
      )}

      {!editing && !entitlementsQuery.isLoading && (
        <div className="overflow-x-auto rounded-xl border border-border-light">
          <table className="w-full text-sm">
            <thead className="bg-surface-secondary text-text-secondary">
              <tr>
                <th className="px-4 py-3 text-left font-medium">
                  {localize('com_admin_entitlements_tenant')}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {localize('com_admin_entitlements_plan')}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {localize('com_admin_entitlements_status')}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {localize('com_admin_entitlements_seats')}
                </th>
                <th className="px-4 py-3" aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {entitlements.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-text-secondary">
                    {localize('com_admin_entitlements_empty')}
                  </td>
                </tr>
              )}
              {entitlements.map((entitlement) => (
                <tr key={entitlement.tenantId} className="border-t border-border-light">
                  <td className="px-4 py-3 font-medium">{entitlement.tenantId}</td>
                  <td className="px-4 py-3">{entitlement.plan}</td>
                  <td className="px-4 py-3">{entitlement.status}</td>
                  <td className="px-4 py-3">
                    {entitlement.activeSeats} / {entitlement.seatLimit}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(entitlement.tenantId)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border-light px-2 py-1 text-xs hover:bg-surface-hover"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {localize('com_admin_entitlements_edit')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="rounded-xl border border-border-light p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {isNew
                ? localize('com_admin_entitlements_new')
                : localize('com_admin_entitlements_editing')}
            </h2>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-lg border border-border-light p-2 hover:bg-surface-hover"
              aria-label={localize('com_admin_entitlements_cancel')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-text-secondary">
                {localize('com_admin_entitlements_tenant')}
              </span>
              <input
                type="text"
                value={editing.tenantId}
                disabled={!isNew}
                onChange={(event) =>
                  setEditing((current) =>
                    current ? { ...current, tenantId: event.target.value } : current,
                  )
                }
                className="w-full rounded-lg border border-border-light bg-transparent px-3 py-2 disabled:opacity-60"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-text-secondary">
                {localize('com_admin_entitlements_plan')}
              </span>
              <select
                value={editing.plan}
                onChange={(event) =>
                  setEditing((current) =>
                    current ? { ...current, plan: event.target.value } : current,
                  )
                }
                className="w-full rounded-lg border border-border-light bg-transparent px-3 py-2"
              >
                {TENANT_PLAN_TYPES.map((plan) => (
                  <option key={plan} value={plan}>
                    {plan}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-text-secondary">
                {localize('com_admin_entitlements_status')}
              </span>
              <select
                value={editing.status}
                onChange={(event) =>
                  setEditing((current) =>
                    current ? { ...current, status: event.target.value } : current,
                  )
                }
                className="w-full rounded-lg border border-border-light bg-transparent px-3 py-2"
              >
                {TENANT_ENTITLEMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-text-secondary">
                {localize('com_admin_entitlements_seat_limit')}
              </span>
              <input
                type="number"
                min={0}
                value={editing.seatLimit}
                onChange={(event) =>
                  setEditing((current) =>
                    current
                      ? { ...current, seatLimit: Math.max(0, Number(event.target.value) || 0) }
                      : current,
                  )
                }
                className="w-full rounded-lg border border-border-light bg-transparent px-3 py-2"
              />
            </label>
          </div>

          <p
            className={`mt-2 text-xs ${
              totalAllocated > editing.seatLimit ? 'text-red-500' : 'text-text-secondary'
            }`}
          >
            {localize('com_admin_entitlements_allocated')}: {totalAllocated} / {editing.seatLimit}
          </p>

          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold">
              {localize('com_admin_entitlements_allocations')}
            </h3>
            <div className="space-y-3">
              {Object.entries(editing.accountTypes).map(([accountType, allocation]) => (
                <div key={accountType} className="rounded-lg border border-border-light p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{accountType}</span>
                    <button
                      type="button"
                      onClick={() => removeAllocation(accountType)}
                      className="text-xs text-text-secondary hover:text-text-primary"
                    >
                      {localize('com_admin_entitlements_remove_allocation')}
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-4">
                    <label className="text-xs">
                      <span className="mr-2 text-text-secondary">
                        {localize('com_admin_entitlements_seat_limit')}
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={allocation.seatLimit}
                        onChange={(event) =>
                          updateAllocation(accountType, {
                            seatLimit: Math.max(0, Number(event.target.value) || 0),
                          })
                        }
                        className="w-24 rounded-lg border border-border-light bg-transparent px-2 py-1"
                      />
                    </label>
                    <fieldset className="flex flex-wrap items-center gap-3">
                      <legend className="sr-only">
                        {localize('com_admin_entitlements_modes')}
                      </legend>
                      {SEMANTIC_MODES.map((mode) => (
                        <label key={mode} className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={allocation.allowedModes.includes(mode)}
                            onChange={(event) =>
                              updateAllocation(accountType, {
                                allowedModes: event.target.checked
                                  ? [...allocation.allowedModes, mode]
                                  : allocation.allowedModes.filter((m) => m !== mode),
                              })
                            }
                          />
                          {mode}
                        </label>
                      ))}
                    </fieldset>
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={allocation.localPrivacyEnabled}
                        onChange={(event) =>
                          updateAllocation(accountType, {
                            localPrivacyEnabled: event.target.checked,
                          })
                        }
                      />
                      {localize('com_admin_entitlements_local_privacy')}
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {TENANT_ACCOUNT_TYPES.filter(
                (accountType) => !(accountType in editing.accountTypes),
              ).map((accountType) => (
                <button
                  key={accountType}
                  type="button"
                  onClick={() => addAllocation(accountType)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border-light px-2 py-1 text-xs hover:bg-surface-hover"
                >
                  <Plus className="h-3 w-3" />
                  {accountType}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-text-secondary">
              {localize('com_admin_entitlements_capabilities_note')}
            </p>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-lg border border-border-light px-4 py-2 text-sm hover:bg-surface-hover"
            >
              {localize('com_admin_entitlements_cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !editing.tenantId.trim()}
              className="rounded-lg bg-text-primary px-4 py-2 text-sm text-surface-primary hover:opacity-90 disabled:opacity-50"
            >
              {saving ? localize('com_admin_entitlements_saving') : localize('com_ui_save')}
            </button>
          </div>
        </div>
      )}

      {!editing && entitlementsQuery.isError && (
        <p className="text-sm text-red-500">{(entitlementsQuery.error as Error).message}</p>
      )}
    </div>
  );
}
