import type { CSSProperties } from 'react';
import { compactTokens } from '../../lib/format';
import type { FleetTotals } from '../../api/types';

interface Tile {
  key: string;
  label: string;
  value: string;
  detail: string;
  tone: 'neutral' | 'good' | 'warn' | 'bad' | 'info';
}

function tiles(totals: FleetTotals): Tile[] {
  return [
    {
      key: 'tenants',
      label: 'Tenants',
      value: String(totals.active + totals.expired + totals.blocked + totals.suspended),
      detail: `${totals.active} active · ${totals.expired} expired · ${totals.blocked} blocked · ${totals.suspended} suspended`,
      tone: 'neutral',
    },
    {
      key: 'seats',
      label: 'Active seats',
      value: `${totals.activeSeats}`,
      detail: `of ${totals.allowedSeats} licensed across all plans`,
      tone: 'info',
    },
    {
      key: 'spend',
      label: 'Token spend today',
      value: compactTokens(totals.tokenSpendToday),
      detail: 'summed across every provider account',
      tone: 'neutral',
    },
    {
      key: 'alerts',
      label: 'Alerts',
      value: String(totals.staleHeartbeatCount),
      detail:
        totals.staleHeartbeatCount === 0
          ? 'Every node checked in within 6h'
          : 'Node(s) past the 6h heartbeat cycle',
      tone: totals.staleHeartbeatCount === 0 ? 'good' : 'warn',
    },
  ];
}

export function HealthBar({ totals }: { totals: FleetTotals }): JSX.Element {
  return (
    <section className="health" aria-label="Fleet health">
      {tiles(totals).map((tile, index) => (
        <article
          className="health__tile panel"
          key={tile.key}
          data-tone={tile.tone}
          /* Staggered entry so the bar assembles rather than appearing. */
          style={{ '--enter-delay': `${index * 90}ms` } as CSSProperties}
        >
          <p className="health__label">{tile.label}</p>
          <p className="health__value">{tile.value}</p>
          <p className="health__detail">{tile.detail}</p>
          <span className="health__sheen" aria-hidden="true" />
        </article>
      ))}
    </section>
  );
}
