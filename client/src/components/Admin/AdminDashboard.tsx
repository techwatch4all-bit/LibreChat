import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Shield,
  Layers,
  ReceiptIndianRupee,
  History,
  Menu,
  X,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Search,
  FolderLock,
} from 'lucide-react';
import { useLocalize } from '~/hooks';
import { useUsersQuery } from '~/data-provider/admin/users';
import { useGroupsQuery } from '~/data-provider/admin/groups';
import { useRolesQuery } from '~/data-provider/admin/roles';
import { useReconciliationLedgerQuery } from '~/data-provider/admin/reconciliation';

import AdminOverview from './AdminOverview';
import UsersList from './UsersList';
import RolesList from './RolesList';
import GroupsPanel from './GroupsPanel';
import AuditLogPanel from './AuditLogPanel';
import ReconciliationPanel from './ReconciliationPanel';
import VaultsPanel from './VaultsPanel';

type AdminTab = 'overview' | 'users' | 'roles' | 'groups' | 'vaults' | 'reconciliation' | 'audit';

export default function AdminDashboard(): JSX.Element {
  const localize = useLocalize();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Deep-link intent state from overview quick-action buttons
  const [initialCreateUserOpen, setInitialCreateUserOpen] = useState(false);
  const [initialCreateGroupOpen, setInitialCreateGroupOpen] = useState(false);

  // Live queries for navigation badge counts
  const usersQuery = useUsersQuery({ limit: 1, offset: 0 });
  const groupsQuery = useGroupsQuery();
  const rolesQuery = useRolesQuery();
  const reconciliationQuery = useReconciliationLedgerQuery({ page: 1, limit: 1, status: 'pending' });

  const userCount = usersQuery.data?.total ?? 0;
  const groupCount = groupsQuery.data?.groups?.length ?? 0;
  const pendingPaymentsCount = reconciliationQuery.data?.total ?? 0;

  const navItems = [
    {
      id: 'overview' as const,
      name: 'Overview',
      icon: LayoutDashboard,
      badge: undefined,
    },
    {
      id: 'users' as const,
      name: localize('com_admin_users_title') || 'User Directory',
      icon: Users,
      badge: userCount > 0 ? userCount : undefined,
    },
    {
      id: 'groups' as const,
      name: 'Policy Groups',
      icon: Layers,
      badge: groupCount > 0 ? groupCount : undefined,
    },
    {
      id: 'roles' as const,
      name: localize('com_admin_roles_title') || 'Roles & Permissions',
      icon: Shield,
      badge: undefined,
    },
    {
      id: 'vaults' as const,
      name: 'Knowledge Vaults',
      icon: FolderLock,
      badge: undefined,
    },
    {
      id: 'reconciliation' as const,
      name: 'Payment Ledger',
      icon: ReceiptIndianRupee,
      badge: pendingPaymentsCount > 0 ? pendingPaymentsCount : undefined,
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      id: 'audit' as const,
      name: 'Audit Trail',
      icon: History,
      badge: undefined,
    },
  ];

  const handleNavigate = (tab: AdminTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-surface-primary text-text-primary antialiased">
      {/* ----------------------------------------------------------------- */}
      {/* Enterprise Left Sidebar (Desktop)                                 */}
      {/* ----------------------------------------------------------------- */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border-light bg-surface-secondary/80 backdrop-blur-sm select-none">
        {/* Brand / Header */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-border-light">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-primary p-2 text-white shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-text-primary">
                Satchida Admin
              </span>
              <span className="block text-[10px] font-medium text-text-tertiary">
                Enterprise Control Plane
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          <div>
            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
              Administration
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`h-4 w-4 transition-colors ${
                          isActive ? 'text-white' : 'text-text-tertiary group-hover:text-text-primary'
                        }`}
                      />
                      <span>{item.name}</span>
                    </div>

                    {item.badge !== undefined && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : item.badgeColor || 'bg-surface-tertiary text-text-secondary'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-border-light text-[11px] text-text-tertiary flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Zero-Trust Tunnel</span>
          </div>
          <span className="font-mono text-[10px]">v0.8.8</span>
        </div>
      </aside>

      {/* ----------------------------------------------------------------- */}
      {/* Mobile Header & Responsive Drawer                                 */}
      {/* ----------------------------------------------------------------- */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-border-light bg-surface-secondary px-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="font-bold text-sm text-text-primary">Admin Control Plane</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-lg p-2 text-text-secondary hover:bg-surface-tertiary"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/60 pt-14">
          <div className="bg-surface-secondary border-b border-border-light p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold ${
                    isActive ? 'bg-primary text-white' : 'text-text-secondary'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={16} />
                    <span>{item.name}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className="rounded-full bg-surface-tertiary px-2 py-0.5 text-[10px]">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Main Content Workspace                                            */}
      {/* ----------------------------------------------------------------- */}
      <main className="flex-1 flex flex-col h-full overflow-hidden pt-14 md:pt-0">
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'overview' && (
            <AdminOverview
              onNavigate={handleNavigate}
              onOpenCreateUser={() => {
                setInitialCreateUserOpen(true);
                setActiveTab('users');
              }}
              onOpenCreateGroup={() => {
                setInitialCreateGroupOpen(true);
                setActiveTab('groups');
              }}
            />
          )}

          {activeTab === 'users' && (
            <UsersList
              initialCreateOpen={initialCreateUserOpen}
              onClearInitialCreate={() => setInitialCreateUserOpen(false)}
            />
          )}

          {activeTab === 'groups' && (
            <GroupsPanel
              initialCreateOpen={initialCreateGroupOpen}
              onClearInitialCreate={() => setInitialCreateGroupOpen(false)}
            />
          )}

          {activeTab === 'roles' && <RolesList />}

          {activeTab === 'vaults' && <VaultsPanel />}

          {activeTab === 'reconciliation' && (
            <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">
              <ReconciliationPanel />
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">
              <AuditLogPanel />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
