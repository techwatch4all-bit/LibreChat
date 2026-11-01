import { useState } from 'react';
import {
  FolderLock,
  Search,
  FileText,
  Shield,
  Layers,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Clock,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAdminVaultsQuery } from '~/data-provider/admin/vaults';
import { useGroupsQuery } from '~/data-provider/admin/groups';
import { Spinner } from '@librechat/client';

export default function VaultsPanel() {
  const [search, setSearch] = useState('');
  const vaultsQuery = useAdminVaultsQuery();
  const groupsQuery = useGroupsQuery();

  const vaults = vaultsQuery.data?.vaults ?? [];
  const groups = groupsQuery.data?.groups ?? [];

  const filteredVaults = vaults.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.slug.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex h-full flex-col overflow-auto p-6 md:p-8 bg-surface-primary text-text-primary max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              Knowledge Vaults & Workspaces
            </h1>
            <span className="rounded-full bg-surface-secondary border border-border-light px-2.5 py-0.5 text-xs font-semibold text-text-secondary">
              {vaults.length} Vaults
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Enterprise document isolation and LanceDB vector partitions managed by the headless AnythingLLM engine.
          </p>
        </div>

        <button
          onClick={() => vaultsQuery.refetch()}
          disabled={vaultsQuery.isRefetching}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-border-light bg-surface-secondary hover:bg-surface-tertiary transition-colors"
        >
          <RefreshCw size={14} className={vaultsQuery.isRefetching ? 'animate-spin' : ''} />
          Sync Vaults
        </button>
      </div>

      {/* Search Input */}
      <div className="mb-6 flex items-center gap-2 max-w-md rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs">
        <Search size={14} className="text-text-secondary" />
        <input
          type="text"
          placeholder="Filter vaults by name or slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-transparent focus:outline-none text-text-primary placeholder:text-text-secondary"
        />
      </div>

      {/* Vaults Grid */}
      {vaultsQuery.isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      ) : filteredVaults.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-light p-12 text-center">
          <FolderLock className="h-10 w-10 text-text-secondary mb-3 opacity-60" />
          <h3 className="text-sm font-bold text-text-primary">No Knowledge Vaults Found</h3>
          <p className="text-xs text-text-secondary mt-1 max-w-sm">
            Workspaces will appear automatically as LibreChat users generate documents or as corporate shared vaults are provisioned.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVaults.map((vault) => {
            const isUserVault = vault.slug.startsWith('vault-user-');
            const isShared = !isUserVault;

            // Find groups that have access to this vault
            const assignedGroups = groups.filter(
              (g) => Array.isArray(g.assignedKnowledgeVaults) && g.assignedKnowledgeVaults.includes(vault.slug),
            );

            return (
              <div
                key={vault.slug}
                className="flex flex-col justify-between rounded-2xl border border-border-light bg-surface-secondary/70 p-5 hover:border-primary/40 transition-all shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isUserVault
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                          : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                      }`}
                    >
                      {isUserVault ? '👤 User Private Vault' : '🏢 Corporate Shared'}
                    </span>
                    <span className="text-[11px] font-medium text-text-secondary flex items-center gap-1">
                      <FileText size={12} /> {vault.documentCount} Doc{vault.documentCount === 1 ? '' : 's'}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-text-primary tracking-tight">{vault.name}</h3>
                  <code className="text-[11px] font-mono text-text-secondary block mt-0.5">{vault.slug}</code>

                  <div className="mt-4 pt-3 border-t border-border-light/60">
                    <div className="flex items-center gap-1 text-[11px] text-text-secondary mb-1 font-semibold">
                      <Users size={12} /> Assigned Policy Groups:
                    </div>
                    {assignedGroups.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {assignedGroups.map((g) => (
                          <span
                            key={g._id}
                            className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-primary border border-border-light text-text-primary"
                          >
                            {g.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] text-text-tertiary italic">
                        {isUserVault ? 'Dedicated exclusively to owning user' : 'Available to all authorized roles'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-border-light/60 flex items-center justify-between text-[11px] text-text-secondary">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-emerald-500" /> Vector Partition Active
                  </span>
                  <span>LanceDB</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
