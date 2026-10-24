import type { Filters } from '../../lib/filters';
import type { PlanFilter, StatusFilter, ExpiryFilter } from '../../lib/filters';

interface Props {
  filters: Filters;
  onChange: (next: Filters) => void;
  resultCount: number;
  totalCount: number;
}

export function TenantFilters({ filters, onChange, resultCount, totalCount }: Props): JSX.Element {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]): void => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="filters panel">
      <div className="filters__field filters__field--search">
        <label className="visually-hidden" htmlFor="tenant-search">
          Search tenants by name or subdomain
        </label>
        <input
          id="tenant-search"
          className="filters__input"
          type="search"
          placeholder="Search client or subdomain…"
          value={filters.query}
          onChange={(event) => set('query', event.target.value)}
        />
      </div>

      <div className="filters__field">
        <label className="visually-hidden" htmlFor="filter-status">
          Filter by status
        </label>
        <select
          id="filter-status"
          className="filters__select"
          value={filters.status}
          onChange={(event) => set('status', event.target.value as StatusFilter)}
        >
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="EXPIRED">Expired</option>
          <option value="BLOCKED">Blocked</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </div>

      <div className="filters__field">
        <label className="visually-hidden" htmlFor="filter-plan">
          Filter by plan
        </label>
        <select
          id="filter-plan"
          className="filters__select"
          value={filters.plan}
          onChange={(event) => set('plan', event.target.value as PlanFilter)}
        >
          <option value="ALL">All plans</option>
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
          <option value="family">Family</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      <div className="filters__field">
        <label className="visually-hidden" htmlFor="filter-expiry">
          Filter by licence expiry
        </label>
        <select
          id="filter-expiry"
          className="filters__select"
          value={filters.expiry}
          onChange={(event) => set('expiry', event.target.value as ExpiryFilter)}
        >
          <option value="any">Any expiry</option>
          <option value="7">Expiring in 7 days</option>
          <option value="30">Expiring in 30 days</option>
          <option value="expired">Already expired</option>
        </select>
      </div>

      <p className="filters__count" aria-live="polite">
        {resultCount === totalCount ? `${totalCount} nodes` : `${resultCount} of ${totalCount} nodes`}
      </p>
    </div>
  );
}
