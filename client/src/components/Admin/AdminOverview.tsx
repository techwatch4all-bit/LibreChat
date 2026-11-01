import React, { useState } from 'react';
import {
  Users,
  Shield,
  Layers,
  History,
  FileCheck2,
  Settings,
  ArrowUpRight,
  UserPlus,
  ShieldAlert,
  CreditCard,
  Building2,
  Activity,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { useLocalize } from '~/hooks';
import { useUsersQuery } from '~/data-provider/admin/users';
import { useGroupsQuery } from '~/data-provider/admin/groups';
import { useRolesQuery } from '~/data-provider/admin/roles';
import { useReconciliationLedgerQuery } from '~/data-provider/admin/reconciliation';

interface AdminOverviewProps {
  onNavigate: (tab: 'users' | 'roles' | 'groups' | 'reconciliation' | 'audit') => void;
  onOpenCreateUser: () => void;
  onOpenCreateGroup: () => void;
}

export default function AdminOverview({
  onNavigate,
  onOpenCreateUser,
  onOpenCreateGroup,
}: AdminOverviewProps): JSX.Element {
  const localize = useLocalize();

  // Queries
  const usersQuery = useUsersQuery({ limit: 1, offset: 0 });
  const groupsQuery = useGroupsQuery();
  const rolesQuery = useRolesQuery();
  const pendingReconcileQuery = useReconciliationLedgerQuery({ page: 1, limit: 1, status: 'pending' });

  const totalUsers = usersQuery.data?.total ?? 0;
  const totalGroups = groupsQuery.data?.groups?.length ?? 0;
  const totalRoles = rolesQuery.data?.roles?.length ?? 0;
  const pendingPayments = pendingReconcileQuery.data?.total ?? 0;

  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border-light bg-gradient-to-r from-surface-secondary via-surface-primary to-surface-secondary p-8 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Control Plane Active
              </span>
              <span className="text-xs text-text-tertiary">|</span>
              <span className="text-xs font-medium text-text-secondary">Distributed Tenant Isolation</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
              Enterprise Identity & Access Management
            </h1>
            <p className="mt-2 text-sm text-text-secondary max-w-2xl leading-relaxed">
              Centrally govern organizational policy groups, user lifecycle provisioning, role entitlements,
              and UPI automated plan reconciliation with tamper-evident audit logging.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenCreateUser}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <UserPlus className="h-4 w-4" />
              Provision User
            </button>
            <button
              onClick={onOpenCreateGroup}
              className="inline-flex items-center gap-2 rounded-xl border border-border-medium bg-surface-primary px-4 py-2.5 text-sm font-semibold text-text-primary shadow-sm hover:bg-surface-secondary transition-all"
            >
              <Building2 className="h-4 w-4 text-text-secondary" />
              Create Group
            </button>
          </div>
        </div>

        {/* Subtle Decorative Background Glow */}
        <div className="absolute -right-12 -bottom-12 h-64 w-64 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1: Users */}
        <div
          onClick={() => onNavigate('users')}
          className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border-light bg-surface-secondary/70 p-5 hover:border-primary/50 hover:bg-surface-secondary transition-all shadow-sm hover:shadow"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Users className="h-5 w-5" />
            </div>
            <ArrowUpRight className="h-4 w-4 text-text-tertiary group-hover:text-primary transition-colors" />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-text-primary tracking-tight">
              {usersQuery.isLoading ? '...' : totalUsers}
            </div>
            <div className="text-xs font-medium text-text-secondary mt-1">Identities Provisioned</div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-text-tertiary">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            <span>Active directory syncd</span>
          </div>
        </div>

        {/* Metric 2: Policy Groups */}
        <div
          onClick={() => onNavigate('groups')}
          className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border-light bg-surface-secondary/70 p-5 hover:border-primary/50 hover:bg-surface-secondary transition-all shadow-sm hover:shadow"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-purple-500/10 p-2.5 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Layers className="h-5 w-5" />
            </div>
            <ArrowUpRight className="h-4 w-4 text-text-tertiary group-hover:text-primary transition-colors" />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-text-primary tracking-tight">
              {groupsQuery.isLoading ? '...' : totalGroups}
            </div>
            <div className="text-xs font-medium text-text-secondary mt-1">Commercial Policy Groups</div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-text-tertiary">
            <span>Family & Organization scopes</span>
          </div>
        </div>

        {/* Metric 3: Roles & Permissions */}
        <div
          onClick={() => onNavigate('roles')}
          className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border-light bg-surface-secondary/70 p-5 hover:border-primary/50 hover:bg-surface-secondary transition-all shadow-sm hover:shadow"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Shield className="h-5 w-5" />
            </div>
            <ArrowUpRight className="h-4 w-4 text-text-tertiary group-hover:text-primary transition-colors" />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-text-primary tracking-tight">
              {rolesQuery.isLoading ? '...' : totalRoles}
            </div>
            <div className="text-xs font-medium text-text-secondary mt-1">RBAC Roles & Capabilities</div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-text-tertiary">
            <span>Granular permission sets</span>
          </div>
        </div>

        {/* Metric 4: Pending Reconciliation */}
        <div
          onClick={() => onNavigate('reconciliation')}
          className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border-light bg-surface-secondary/70 p-5 hover:border-amber-500/50 hover:bg-surface-secondary transition-all shadow-sm hover:shadow"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <CreditCard className="h-5 w-5" />
            </div>
            <ArrowUpRight className="h-4 w-4 text-text-tertiary group-hover:text-amber-500 transition-colors" />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-amber-500 tracking-tight">
              {pendingReconcileQuery.isLoading ? '...' : pendingPayments}
            </div>
            <div className="text-xs font-medium text-text-secondary mt-1">Pending UPI Verifications</div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-text-tertiary">
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            <span>{pendingPayments > 0 ? 'Requires operator clearance' : 'All clear'}</span>
          </div>
        </div>
      </div>

      {/* Quick Access & System Health Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Module 1: Governance & Quick Actions */}
        <div className="lg:col-span-2 rounded-2xl border border-border-light bg-surface-primary p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-text-primary">System Administration Workflows</h2>
              <p className="text-xs text-text-secondary">Direct jump to high-impact operator tasks</p>
            </div>
            <span className="rounded-lg bg-surface-tertiary px-2.5 py-1 text-xs font-semibold text-text-secondary">
              Production Safe
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <button
              onClick={() => onNavigate('users')}
              className="flex items-start gap-3.5 rounded-xl border border-border-light bg-surface-secondary/40 p-4 text-left hover:border-primary/40 hover:bg-surface-secondary transition-all"
            >
              <div className="rounded-lg bg-blue-500/10 p-2 text-blue-500">
                <Users className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-text-primary flex items-center justify-between">
                  User Directory
                  <ChevronRight className="h-4 w-4 text-text-tertiary" />
                </div>
                <div className="text-xs text-text-secondary mt-0.5 line-clamp-1">
                  Search, filter, bulk CSV provision, or reset passwords.
                </div>
              </div>
            </button>

            <button
              onClick={() => onNavigate('groups')}
              className="flex items-start gap-3.5 rounded-xl border border-border-light bg-surface-secondary/40 p-4 text-left hover:border-primary/40 hover:bg-surface-secondary transition-all"
            >
              <div className="rounded-lg bg-purple-500/10 p-2 text-purple-500">
                <Layers className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-text-primary flex items-center justify-between">
                  Commercial Groups
                  <ChevronRight className="h-4 w-4 text-text-tertiary" />
                </div>
                <div className="text-xs text-text-secondary mt-0.5 line-clamp-1">
                  Manage seats, supervisor limits, and feature sets.
                </div>
              </div>
            </button>

            <button
              onClick={() => onNavigate('reconciliation')}
              className="flex items-start gap-3.5 rounded-xl border border-border-light bg-surface-secondary/40 p-4 text-left hover:border-amber-500/40 hover:bg-surface-secondary transition-all"
            >
              <div className="rounded-lg bg-amber-500/10 p-2 text-amber-500">
                <CreditCard className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-text-primary flex items-center justify-between">
                  Payment Ledger
                  <ChevronRight className="h-4 w-4 text-text-tertiary" />
                </div>
                <div className="text-xs text-text-secondary mt-0.5 line-clamp-1">
                  Inspect UPI references, bank slips, and issue plan quotas.
                </div>
              </div>
            </button>

            <button
              onClick={() => onNavigate('audit')}
              className="flex items-start gap-3.5 rounded-xl border border-border-light bg-surface-secondary/40 p-4 text-left hover:border-primary/40 hover:bg-surface-secondary transition-all"
            >
              <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500">
                <History className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-text-primary flex items-center justify-between">
                  Audit Chain
                  <ChevronRight className="h-4 w-4 text-text-tertiary" />
                </div>
                <div className="text-xs text-text-secondary mt-0.5 line-clamp-1">
                  Cryptographically verified event trail and CSV exports.
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Module 2: Security & Tenant Isolation Status */}
        <div className="rounded-2xl border border-border-light bg-surface-primary p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-text-primary">Tenant Invariants</h2>
              <Activity className="h-4 w-4 text-emerald-500" />
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-text-primary">Strict Physical Isolation</div>
                  <div className="text-text-secondary">Dedicated native MongoDB edge instance per client node.</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-text-primary">Zero Cloud VPS Directive</div>
                  <div className="text-text-secondary">All transport routed via Cloudflare Zero Trust tunnel.</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-text-primary">Master Key Zero-Knowledge</div>
                  <div className="text-text-secondary">Master LLM credentials never exist on edge nodes.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-border-light bg-surface-secondary/50 p-3.5 text-xs flex items-center justify-between">
            <span className="text-text-secondary">Node Heartbeat:</span>
            <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">15s Polling (HMAC-SHA256)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
