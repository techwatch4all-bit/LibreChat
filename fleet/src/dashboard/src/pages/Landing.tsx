import { useMemo, useState } from 'react';
import { HealthBar } from '../components/landing/HealthBar';
import { TenantTable } from '../components/landing/TenantTable';
import { TenantFilters } from '../components/landing/TenantFilters';
import { applyFilters, INITIAL_FILTERS } from '../lib/filters';
import type { Filters } from '../lib/filters';
import { useFleetOverview } from '../hooks/useFleetOverview';
import { useNow } from '../hooks/useNow';
import { clockTime } from '../lib/format';
import { DEMO_MODE } from '../api/fleet';


function Skeleton(): JSX.Element {
  return (
    <div className="skeleton-wrap" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading fleet overview</span>
      <div className="health">
        {[0, 1, 2, 3].map((i) => (
          <div className="health__tile panel skeleton" key={i} />
        ))}
      </div>
      <div className="filters panel skeleton" />
      <div className="table-scroll panel skeleton table-scroll--tall" />
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }): JSX.Element {
  return (
    <div className="state panel">
      <div className="state__glyph" aria-hidden="true" />
      <h2 className="state__title">No client nodes yet</h2>
      <p className="state__body">
        Once a tenant is provisioned and its node completes its first signed heartbeat, it will appear here.
      </p>
      <button type="button" className="state__action" onClick={onReset}>
        Check again
      </button>
    </div>
  );
}

function NoMatches({ onReset }: { onReset: () => void }): JSX.Element {
  return (
    <div className="state panel">
      <h2 className="state__title">No nodes match these filters</h2>
      <p className="state__body">Widen the status, plan, or expiry window to bring tenants back into view.</p>
      <button type="button" className="state__action" onClick={onReset}>
        Clear filters
      </button>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }): JSX.Element {
  return (
    <div className="state panel" data-tone="bad">
      <h2 className="state__title">Fleet overview unavailable</h2>
      <p className="state__body">{message}</p>
      <button type="button" className="state__action" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

export function Landing(): JSX.Element {
  const { phase, refresh } = useFleetOverview();
  const now = useNow();
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);

  const visible = useMemo(
    () => (phase.status === 'ready' ? applyFilters(phase.data.tenants, filters, now) : []),
    [phase, filters, now],
  );

  const totals = phase.status === 'ready' ? phase.data.totals : null;

  return (
    <main className="landing">
      <header className="masthead">
        <div className="masthead__brand">
          <span className="masthead__mark" aria-hidden="true" />
          <div>
            <h1 className="masthead__title">Fleet overview</h1>
            <p className="masthead__sub">
              Every client node, licence and spend pool across Satchida
              {DEMO_MODE ? <span className="masthead__demo">Demo data</span> : null}
            </p>
          </div>
        </div>
        <div className="masthead__meta">
          {phase.status === 'ready' ? (
            <p className="masthead__stamp">
              Updated <span className="masthead__clock">{clockTime(phase.data.generatedAt)}</span>
            </p>
          ) : null}
          <button type="button" className="masthead__refresh" onClick={refresh}>
            Refresh
          </button>
        </div>
      </header>

      {phase.status === 'loading' ? <Skeleton /> : null}

      {phase.status === 'error' ? <ErrorState message={phase.message} onRetry={refresh} /> : null}

      {phase.status === 'ready' && totals ? (
        <>
          <HealthBar totals={totals} />

          {phase.data.tenants.length === 0 ? (
            <EmptyState onReset={refresh} />
          ) : (
            <>
              <TenantFilters
                filters={filters}
                onChange={setFilters}
                resultCount={visible.length}
                totalCount={phase.data.tenants.length}
              />
              {visible.length === 0 ? (
                <NoMatches onReset={() => setFilters(INITIAL_FILTERS)} />
              ) : (
                <TenantTable tenants={visible} now={now} />
              )}
            </>
          )}
        </>
      ) : null}
    </main>
  );
}
