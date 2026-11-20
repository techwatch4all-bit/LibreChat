/* eslint-disable i18next/no-literal-string */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState } from 'react';
import { Spinner } from '@librechat/client';
import {
  Building2,
  Coins,
  Cpu,
  Users,
  Calendar,
  Activity,
  Layers,
  BarChart3,
  RefreshCw,
  Search,
  Sparkles,
  ShieldCheck,
  Wrench,
  Rocket,
  CheckCircle2,
  AlertTriangle,
  Code2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Terminal,
  FileUp,
} from 'lucide-react';
import TenantContractModal from './TenantContractModal';
import {
  useTenantConsumptionQuery,
  useFleetOpsQuery,
  type TenantConsumptionRecord,
  type FleetIncident,
} from '~/data-provider/admin/tenants';
import { adminFetch } from '~/data-provider/admin/client';
import { cn } from '~/utils';

export default function TenantDashboard(): JSX.Element {
  const [activeSubTab, setActiveSubTab] = useState<'consumption' | 'fleet_healing'>(
    'fleet_healing',
  );
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [expandedIncidentFp, setExpandedIncidentFp] = useState<string | null>(null);
  const [launchingVibecodingFp, setLaunchingVibecodingFp] = useState<string | null>(null);
  const [deployingPatchFp, setDeployingPatchFp] = useState<string | null>(null);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [deployStatusMsg, setDeployStatusMsg] = useState<{ [key: string]: string }>({});

  const { data, isLoading, isFetching, refetch } = useTenantConsumptionQuery(periodDays);
  const { data: fleetData, isLoading: isFleetLoading, refetch: refetchFleet } = useFleetOpsQuery();

  const tenants = data?.tenants ?? [];
  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      t.tenantId.toLowerCase().includes(searchFilter.toLowerCase()),
  );

  const activeTenant: TenantConsumptionRecord | undefined =
    tenants.find((t) => t.tenantId === selectedTenantId) ?? tenants[0];

  // Aggregate fleet totals
  const totalTokensFleet = tenants.reduce((acc, t) => acc + (t.totalTokens || 0), 0);
  const totalCostCreditsFleet = tenants.reduce((acc, t) => acc + (t.totalCostCredits || 0), 0);
  const totalActiveUsersFleet = tenants.reduce((acc, t) => acc + (t.activeUsersCount || 0), 0);
  const totalTransactionsFleet = tenants.reduce((acc, t) => acc + (t.transactionCount || 0), 0);

  // Fleet ops & incidents
  const incidents = fleetData?.incidents ?? [];
  const edgeNodes = fleetData?.tenants ?? [];
  const activeIncidents = incidents.filter((i) => i.status !== 'resolved');

  // Trigger OpenHands Vibecoding session
  const handleLaunchOpenHands = async (inc: FleetIncident) => {
    setLaunchingVibecodingFp(inc.fingerprint);
    try {
      const res = await adminFetch('/api/admin/tenants/launch-openhands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fingerprint: inc.fingerprint,
          tenantId: inc.affectedTenants?.[0] || 'operator-local',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDeployStatusMsg((prev) => ({
          ...prev,
          [inc.fingerprint]: `Worktree ready: ${data.branchName}. OpenHands available at ${data.openhandsUrl}`,
        }));
        window.open(data.openhandsUrl || 'http://localhost:3001', '_blank');
      }
    } catch (e: any) {
      alert('Failed to launch OpenHands: ' + e.message);
    } finally {
      setLaunchingVibecodingFp(null);
    }
  };

  // Deploy patch to tenant
  const handleDeployPatch = async (inc: FleetIncident) => {
    setDeployingPatchFp(inc.fingerprint);
    try {
      const res = await adminFetch('/api/admin/tenants/deploy-patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fingerprint: inc.fingerprint,
          targetTenant: inc.affectedTenants?.[0] || 'all',
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setDeployStatusMsg((prev) => ({
          ...prev,
          [inc.fingerprint]:
            'Patch queued. Remote tenant will apply with safety backup & local verification.',
        }));
        refetchFleet();
      }
    } catch (e: any) {
      alert('Deploy failed: ' + e.message);
    } finally {
      setDeployingPatchFp(null);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface-primary p-6 text-text-primary">
      {/* Top Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Tenant Fleet Operations & AI Healing Center
            </h1>
            <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-semibold">
              Live One-API Identity Binding
            </span>
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            Unified telemetry from remote edge nodes, SRE AI error analysis, OpenHands vibecoding
            integration, and isolated consumption analytics.
          </p>
        </div>

        {/* Sub-tab Switcher & Refresh */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-border-light bg-surface-secondary p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveSubTab('fleet_healing')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors',
                activeSubTab === 'fleet_healing'
                  ? 'bg-primary shadow-xs text-white'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Autonomous Healing ({activeIncidents.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('consumption')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors',
                activeSubTab === 'consumption'
                  ? 'bg-primary shadow-xs text-white'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Token Consumption
            </button>
          </div>

          <button
            type="button"
            onClick={() => setContractModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border-light bg-surface-secondary px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-tertiary"
          >
            <FileUp className="h-3.5 w-3.5" />
            Upload Contract
          </button>

          <button
            type="button"
            onClick={() => {
              refetch();
              refetchFleet();
            }}
            disabled={isFetching || isFleetLoading}
            className="flex items-center gap-1.5 rounded-lg border border-border-light bg-surface-secondary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', (isFetching || isFleetLoading) && 'animate-spin')}
            />
            Refresh
          </button>
        </div>
      </div>

      <TenantContractModal
        open={contractModalOpen}
        onClose={() => setContractModalOpen(false)}
        tenants={tenants.map((t) => ({ tenantId: t.tenantId, displayName: t.displayName }))}
        defaultTenantId={activeTenant?.tenantId}
        onApplied={() => {
          refetch();
        }}
      />

      {activeSubTab === 'fleet_healing' ? (
        /* FLEET HEALING & OPENHANDS VIBECODING TAB */
        <div className="space-y-6">
          {/* Edge Fleet Summary KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="shadow-xs rounded-xl border border-border-light bg-surface-secondary/70 p-4">
              <div className="flex items-center justify-between text-text-secondary">
                <span className="text-xs font-medium uppercase tracking-wider">
                  Connected Tenants
                </span>
                <Building2 className="text-primary h-4 w-4" />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-text-primary">
                {edgeNodes.length || tenants.length}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-500">
                <ShieldCheck className="h-3.5 w-3.5" /> Real-time CGNAT Tunnels
              </div>
            </div>

            <div className="shadow-xs rounded-xl border border-border-light bg-surface-secondary/70 p-4">
              <div className="flex items-center justify-between text-text-secondary">
                <span className="text-xs font-medium uppercase tracking-wider">
                  Active Incidents
                </span>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-amber-500">
                {activeIncidents.length}
              </div>
              <div className="mt-1 text-[11px] text-text-tertiary">
                Requiring review or vibecoding fix
              </div>
            </div>

            <div className="shadow-xs rounded-xl border border-border-light bg-surface-secondary/70 p-4">
              <div className="flex items-center justify-between text-text-secondary">
                <span className="text-xs font-medium uppercase tracking-wider">
                  OpenHands Engine
                </span>
                <Code2 className="h-4 w-4 text-indigo-400" />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-indigo-400">Ready</div>
              <div className="mt-1 text-[11px] text-text-tertiary">
                Isolated git worktree sandbox
              </div>
            </div>

            <div className="shadow-xs rounded-xl border border-border-light bg-surface-secondary/70 p-4">
              <div className="flex items-center justify-between text-text-secondary">
                <span className="text-xs font-medium uppercase tracking-wider">Brand Immunity</span>
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-500">100%</div>
              <div className="mt-1 text-[11px] text-text-tertiary">
                Zero red error badges visible to users
              </div>
            </div>
          </div>

          {/* Active Incidents & OpenHands Vibecoding Section */}
          <div className="shadow-xs space-y-4 rounded-xl border border-border-light bg-surface-secondary/50 p-5">
            <div className="flex items-center justify-between border-b border-border-light pb-3">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
                  <Activity className="text-primary h-4 w-4" /> Active Telemetry & Autonomous Repair
                  Queue
                </h2>
                <p className="mt-0.5 text-xs text-text-secondary">
                  Captured from all edge nodes. Click &quot;Deploy Fix&quot; for instant 1-line
                  hotfixes or &quot;Launch OpenHands&quot; for multi-file vibecoding.
                </p>
              </div>
            </div>

            {activeIncidents.length === 0 ? (
              <div className="py-10 text-center text-text-tertiary">
                <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-emerald-500 opacity-80" />
                <p className="text-sm font-medium text-text-primary">
                  All Tenant Nodes Healthy & Operational
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  Zero unhandled exceptions or broken tools across the fleet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeIncidents.map((inc) => {
                  const ai = inc.aiAnalysis || {};
                  const isExpanded = expandedIncidentFp === inc.fingerprint;
                  const isSafe = ai.safetyLevel === 'safe_auto_deploy';
                  const statusMsg = deployStatusMsg[inc.fingerprint];

                  return (
                    <div
                      key={inc.fingerprint}
                      className="shadow-xs space-y-3 rounded-xl border border-border-light bg-surface-primary p-4 transition hover:border-border-medium"
                    >
                      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                isSafe
                                  ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
                                  : 'border border-amber-500/20 bg-amber-500/10 text-amber-500',
                              )}
                            >
                              {isSafe ? 'Safe Hotfix' : 'Requires Vibecoding'}
                            </span>
                            <span className="rounded-md bg-surface-tertiary px-2 py-0.5 font-mono text-[11px] text-text-secondary">
                              Tenant:{' '}
                              {inc.tenantDisplayName || inc.affectedTenants?.[0] || 'Global'}
                            </span>
                            <span className="text-xs text-text-tertiary">
                              {inc.count} user(s) impacted
                            </span>
                          </div>
                          <h3 className="pt-0.5 text-sm font-bold text-text-primary">
                            {ai.plainEnglishTitle || inc.message}
                          </h3>
                          <p className="text-xs text-text-secondary">
                            {ai.plainEnglishDescription ||
                              'An error was captured during runtime tool execution.'}
                          </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex shrink-0 items-center gap-2">
                          {/* 1. Launch OpenHands Vibecoding */}
                          <button
                            type="button"
                            onClick={() => handleLaunchOpenHands(inc)}
                            disabled={launchingVibecodingFp === inc.fingerprint}
                            className="shadow-xs flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-600/15 px-3 py-1.5 text-xs font-semibold text-indigo-400 transition hover:bg-indigo-600/25"
                          >
                            <Code2 className="h-3.5 w-3.5" />
                            {launchingVibecodingFp === inc.fingerprint
                              ? 'Preparing...'
                              : 'Vibecode in OpenHands'}
                          </button>

                          {/* 2. Direct Deploy Patch */}
                          <button
                            type="button"
                            onClick={() => handleDeployPatch(inc)}
                            disabled={deployingPatchFp === inc.fingerprint}
                            className="shadow-xs flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
                          >
                            <Rocket className="h-3.5 w-3.5" />
                            {deployingPatchFp === inc.fingerprint ? 'Deploying...' : 'Deploy Fix'}
                          </button>
                        </div>
                      </div>

                      {statusMsg && (
                        <div className="bg-primary/10 border-primary/20 text-primary rounded-lg border p-2 text-xs font-medium">
                          {statusMsg}
                        </div>
                      )}

                      {/* Technical Breakdown Accordion */}
                      <button
                        type="button"
                        onClick={() => setExpandedIncidentFp(isExpanded ? null : inc.fingerprint)}
                        className="flex items-center gap-1 text-[11px] font-medium text-text-tertiary transition hover:text-text-primary"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        {isExpanded ? 'Hide' : 'View'} Technical Diagnosis & Patch Diff (
                        {ai.affectedFile || 'repo'})
                      </button>

                      {isExpanded && (
                        <div className="mt-2 space-y-2 rounded-lg border border-border-light bg-surface-secondary p-3 text-xs">
                          <p>
                            <strong className="text-text-primary">Root Cause:</strong>{' '}
                            <span className="text-text-secondary">
                              {ai.rootCause || inc.message}
                            </span>
                          </p>
                          {ai.suggestedPatch && (
                            <div>
                              <strong className="mb-1 block text-text-primary">
                                Suggested Change ({ai.suggestedPatch.targetFile || ai.affectedFile}
                                ):
                              </strong>
                              <pre className="overflow-x-auto rounded border border-border-light bg-surface-tertiary p-2 font-mono text-[11px] text-emerald-400">
                                {ai.suggestedPatch.replacementString ||
                                  JSON.stringify(ai.suggestedPatch, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Connected Tenant Edge Nodes Grid */}
          <div className="shadow-xs space-y-4 rounded-xl border border-border-light bg-surface-secondary/50 p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
              <Building2 className="text-primary h-4 w-4" /> Connected Tenant Deployment Nodes
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {tenants.map((t) => {
                const node = edgeNodes.find((n) => n.tenantId === t.tenantId);
                const isOnline = node ? node.status === 'online' : true;

                return (
                  <div
                    key={t.tenantId}
                    className="space-y-2 rounded-xl border border-border-light bg-surface-primary p-3.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'h-2.5 w-2.5 rounded-full',
                            isOnline ? 'bg-emerald-400' : 'bg-rose-400',
                          )}
                        />
                        <h4 className="text-sm font-bold text-text-primary">{t.name}</h4>
                      </div>
                      <span className="rounded-md bg-surface-tertiary px-2 py-0.5 text-[10px] font-semibold uppercase text-text-secondary">
                        {t.plan || 'Standard'}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-text-secondary">
                      <div className="flex justify-between">
                        <span>Tenant ID:</span>
                        <span className="font-mono text-text-primary">{t.tenantId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Active Users:</span>
                        <span className="text-text-primary">
                          {t.activeUsersCount} / {t.totalUsers}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tokens Consumed:</span>
                        <span className="text-text-primary">{t.totalTokens.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* EXISTING TOKEN CONSUMPTION & BREAKDOWN TAB */
        <>
          {/* Top Fleet Aggregate Cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="shadow-xs rounded-xl border border-border-light bg-surface-secondary/70 p-4">
              <div className="flex items-center justify-between text-text-secondary">
                <span className="text-xs font-medium uppercase tracking-wider">
                  Fleet Total Tokens
                </span>
                <Coins className="h-4 w-4 text-amber-500" />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-text-primary">
                {totalTokensFleet.toLocaleString()}
              </div>
              <div className="mt-1 text-[11px] text-text-tertiary">
                Past {periodDays} days across {tenants.length} tenant
                {tenants.length === 1 ? '' : 's'}
              </div>
            </div>

            <div className="shadow-xs rounded-xl border border-border-light bg-surface-secondary/70 p-4">
              <div className="flex items-center justify-between text-text-secondary">
                <span className="text-xs font-medium uppercase tracking-wider">
                  Credits Consumed
                </span>
                <Coins className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-text-primary">
                {totalCostCreditsFleet.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <div className="mt-1 text-[11px] text-text-tertiary">
                Rate-weighted credit settlement
              </div>
            </div>

            <div className="shadow-xs rounded-xl border border-border-light bg-surface-secondary/70 p-4">
              <div className="flex items-center justify-between text-text-secondary">
                <span className="text-xs font-medium uppercase tracking-wider">Active Users</span>
                <Users className="h-4 w-4 text-blue-500" />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-text-primary">
                {totalActiveUsersFleet}
              </div>
              <div className="mt-1 text-[11px] text-text-tertiary">
                Distinct user accounts generating traffic
              </div>
            </div>

            <div className="shadow-xs rounded-xl border border-border-light bg-surface-secondary/70 p-4">
              <div className="flex items-center justify-between text-text-secondary">
                <span className="text-xs font-medium uppercase tracking-wider">
                  Total LLM Calls
                </span>
                <Activity className="h-4 w-4 text-purple-500" />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-text-primary">
                {totalTransactionsFleet.toLocaleString()}
              </div>
              <div className="mt-1 text-[11px] text-text-tertiary">
                Prompt & completion generation events
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
