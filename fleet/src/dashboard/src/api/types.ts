/** Fleet overview contract, matching satchida-dashboard-design.md §1A. */

export type TenantStatus = 'ACTIVE' | 'EXPIRED' | 'BLOCKED' | 'SUSPENDED';

export type PlanTier = 'basic' | 'pro' | 'family' | 'enterprise';

export interface TenantSummary {
  id: string;
  name: string;
  subdomain: string;
  status: TenantStatus;
  plan: PlanTier;
  activeSeats: number;
  allowedSeats: number;
  licenceExpiresAt: string;
  /** Absent until the node has ever checked in. */
  lastHeartbeatAt: string | null;
  nodeIp: string | null;
  tokenSpendToday: number;
  tokenSpendThisMonth: number;
}

export interface FleetTotals {
  active: number;
  expired: number;
  blocked: number;
  suspended: number;
  activeSeats: number;
  allowedSeats: number;
  tokenSpendToday: number;
  /** Nodes whose last heartbeat is older than the 6-hour cycle. */
  staleHeartbeatCount: number;
}

export interface FleetOverview {
  generatedAt: string;
  totals: FleetTotals;
  tenants: TenantSummary[];
}

export const PLAN_LABEL: Record<PlanTier, string> = {
  basic: 'Basic',
  pro: 'Pro',
  family: 'Family',
  enterprise: 'Enterprise',
};

export const STATUS_LABEL: Record<TenantStatus, string> = {
  ACTIVE: 'Active',
  EXPIRED: 'Expired',
  BLOCKED: 'Blocked',
  SUSPENDED: 'Suspended',
};
