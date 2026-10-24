import type { CSSProperties } from 'react';
import { StatusBadge } from './StatusBadge';
import { PLAN_LABEL } from '../../api/types';
import { compactTokens, isHeartbeatStale, licenceCountdown, relativeTime } from '../../lib/format';
import type { TenantSummary } from '../../api/types';

interface Props {
  tenants: TenantSummary[];
  /** Injected so every relative time on the row agrees with one clock. */
  now: number;
}

function seatRatio(active: number, allowed: number): number {
  return allowed === 0 ? 0 : Math.min(1, active / allowed);
}

export function TenantTable({ tenants, now }: Props): JSX.Element {
  return (
    <div className="table-scroll panel">
      <table className="table">
        <caption className="visually-hidden">Client nodes, licence state and token spend</caption>
        <thead>
          <tr>
            <th scope="col">Client</th>
            <th scope="col">Status</th>
            <th scope="col">Plan</th>
            <th scope="col">Seats</th>
            <th scope="col">Licence expiry</th>
            <th scope="col">Last heartbeat</th>
            <th scope="col">Node IP</th>
            <th scope="col" className="table__num">Spend today</th>
            <th scope="col" className="table__num">Spend 30d</th>
            <th scope="col">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((tenant, index) => {
            const countdown = licenceCountdown(tenant.licenceExpiresAt, now);
            const stale = isHeartbeatStale(tenant.lastHeartbeatAt, now);
            const ratio = seatRatio(tenant.activeSeats, tenant.allowedSeats);

            return (
              <tr key={tenant.id} style={{ '--enter-delay': `${Math.min(index, 10) * 55}ms` } as CSSProperties}>
                <td>
                  <div className="cell-client">
                    <span className="cell-client__name">{tenant.name}</span>
                    <span className="cell-client__sub">{tenant.subdomain}</span>
                  </div>
                </td>
                <td>
                  <StatusBadge status={tenant.status} />
                </td>
                <td>
                  <span className="plan" data-plan={tenant.plan}>
                    {PLAN_LABEL[tenant.plan]}
                  </span>
                </td>
                <td>
                  <div className="cell-seats">
                    <span className="cell-seats__count">
                      {tenant.activeSeats}
                      <span className="cell-seats__of"> / {tenant.allowedSeats}</span>
                    </span>
                    <span className="meter" aria-hidden="true">
                      <span
                        className="meter__fill"
                        data-level={ratio > 0.9 ? 'high' : ratio > 0.7 ? 'mid' : 'low'}
                        style={{ '--ratio': ratio } as CSSProperties}
                      />
                    </span>
                  </div>
                </td>
                <td>
                  <span className="cell-countdown" data-expired={countdown.expired}>
                    {countdown.label}
                  </span>
                </td>
                <td>
                  <span className="cell-heartbeat" data-stale={stale}>
                    {relativeTime(tenant.lastHeartbeatAt, now)}
                  </span>
                </td>
                <td>
                  <span className="cell-ip">{tenant.nodeIp ?? '—'}</span>
                </td>
                <td className="table__num">
                  <span className="cell-spend">{compactTokens(tenant.tokenSpendToday)}</span>
                </td>
                <td className="table__num">
                  <span className="cell-spend">{compactTokens(tenant.tokenSpendThisMonth)}</span>
                </td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="row-actions__btn" title={`Renew ${tenant.name}`}>
                      Renew
                    </button>
                    <button type="button" className="row-actions__btn" title={`View ${tenant.name}`}>
                      Details
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
