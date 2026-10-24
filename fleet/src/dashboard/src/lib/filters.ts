import type { PlanTier, TenantStatus, TenantSummary } from '../api/types';

/** Filter state for the tenant table, matching design §1A. */
export type StatusFilter = TenantStatus | 'ALL';
export type PlanFilter = PlanTier | 'ALL';
export type ExpiryFilter = 'any' | '7' | '30' | 'expired';

export interface Filters {
  status: StatusFilter;
  plan: PlanFilter;
  expiry: ExpiryFilter;
  query: string;
}

export const INITIAL_FILTERS: Filters = {
  status: 'ALL',
  plan: 'ALL',
  expiry: 'any',
  query: '',
};

const DAY = 86_400_000;

/**
 * Pure filter over the tenant list. Lives apart from the component so the
 * rules are testable on their own and the UI stays a rendering concern.
 */
export function applyFilters(tenants: TenantSummary[], filters: Filters, now: number): TenantSummary[] {
  const query = filters.query.trim().toLowerCase();
  const window = filters.expiry === 'any' ? null : Number(filters.expiry) * DAY;

  return tenants.filter((tenant) => {
    if (filters.status !== 'ALL' && tenant.status !== filters.status) {
      return false;
    }
    if (filters.plan !== 'ALL' && tenant.plan !== filters.plan) {
      return false;
    }
    if (query && !`${tenant.name} ${tenant.subdomain}`.toLowerCase().includes(query)) {
      return false;
    }

    const remaining = Date.parse(tenant.licenceExpiresAt) - now;

    if (filters.expiry === 'expired') {
      return remaining <= 0;
    }
    /* A licence inside the window must still be live: "expiring in 7 days"
       must never sweep in tenants that expired last month. */
    if (window !== null) {
      return remaining > 0 && remaining <= window;
    }
    return true;
  });
}
