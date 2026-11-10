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
  ShieldCheck,
  FolderLock,
  Landmark,
} from 'lucide-react';
import { useReconciliationLedgerQuery } from '~/data-provider/admin/reconciliation';
import { useGroupsQuery } from '~/data-provider/admin/groups';
import { useUsersQuery } from '~/data-provider/admin/users';
import ReconciliationPanel from './ReconciliationPanel';
import EntitlementsPanel from './EntitlementsPanel';
import AdminOverview from './AdminOverview';
import AuditLogPanel from './AuditLogPanel';
import GroupsPanel from './GroupsPanel';
import VaultsPanel from './VaultsPanel';
import { useLocalize } from '~/hooks';
import UsersList from './UsersList';
import RolesList from './RolesList';

type AdminTab =
  | 'overview'
  | 'users'
  | 'roles'
  | 'groups'
  | 'vaults'
  | 'entitlements'
  | 'reconciliation'
  | 'audit';

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
  const reconciliationQuery = useReconciliationLedgerQuery({
    page: 1,
    limit: 1,
    status: 'pending',
  });

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
      id: 'entitlements' as const,
      name: localize('com_admin_entitlements_title') || 'Entitlements',
      icon: Landmark,
      badge: undefined,
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
      <aside className="hidden w-64 select-none flex-col border-r border-border-light bg-surface-secondary/80 backdrop-blur-sm md:flex">
        {/* Brand / Header */}
        <div className="flex h-16 items-center justify-between border-b border-border-light px-6">
          <div className="flex items-center gap-2.5">
            <div className="bg-primary rounded-xl p-2 text-white shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <span className="text-sm font-extrabold tracking-tight text-text-primary">
                {localize('com_admin_dashboard_title')}
              </span>
              <span className="block text-[10px] font-medium text-text-tertiary">
                {localize('com_admin_dashboard_subtitle')}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          <div>
            <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
              {localize('com_admin_dashboard_section')}
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
                          isActive
                            ? 'text-white'
                            : 'text-text-tertiary group-hover:text-text-primary'
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
        <div className="flex items-center justify-between border-t border-border-light p-4 text-[11px] text-text-tertiary">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>{localize('com_admin_dashboard_tunnel')}</span>
          </div>
          <span className="font-mono text-[10px]">v0.8.8</span>
        </div>
      </aside>

      {/* ----------------------------------------------------------------- */}
      {/* Mobile Header & Responsive Drawer                                 */}
      {/* ----------------------------------------------------------------- */}
      <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border-light bg-surface-secondary px-4 md:hidden">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-primary h-5 w-5" />
          <span className="text-sm font-bold text-text-primary">
            {localize('com_admin_dashboard_title')}
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-lg p-2 text-text-secondary hover:bg-surface-tertiary"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 pt-14 md:hidden">
          <div className="space-y-1 border-b border-border-light bg-surface-secondary p-4">
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
      <main className="flex h-full flex-1 flex-col overflow-hidden pt-14 md:pt-0">
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
            <div className="mx-auto w-full max-w-7xl p-6 md:p-8">
              <ReconciliationPanel />
            </div>
          )}

          {activeTab === 'entitlements' && (
            <div className="mx-auto w-full max-w-7xl p-6 md:p-8">
              <EntitlementsPanel />
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="mx-auto w-full max-w-7xl p-6 md:p-8">
              <AuditLogPanel />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
