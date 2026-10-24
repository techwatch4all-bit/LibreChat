const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Compact token counts for the spend columns — a fleet table is scanned, not
 *  read, so 4.18M beats 4,182,900 at a glance. */
export function compactTokens(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return String(value);
}

/**
 * Every helper here takes `now` explicitly rather than reading the clock.
 * A heartbeat age that silently froze at render time would report a stale node
 * as healthy for as long as the table sat untouched.
 */
export function relativeTime(iso: string | null, now: number): string {
  if (!iso) {
    return 'Never';
  }
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    return 'Unknown';
  }
  const delta = now - parsed;
  if (delta < 0) {
    return 'Just now';
  }
  if (delta < HOUR) {
    return `${Math.max(1, Math.round(delta / 60_000))}m ago`;
  }
  if (delta < DAY) {
    return `${Math.round(delta / HOUR)}h ago`;
  }
  return `${Math.round(delta / DAY)}d ago`;
}

export interface Countdown {
  days: number;
  expired: boolean;
  label: string;
}

export function licenceCountdown(iso: string, now: number): Countdown {
  const delta = Date.parse(iso) - now;
  if (Number.isNaN(delta)) {
    return { days: 0, expired: false, label: 'Unknown' };
  }
  const days = Math.floor(delta / DAY);
  if (delta <= 0) {
    const overdue = Math.abs(days);
    return { days, expired: true, label: overdue === 0 ? 'Expired today' : `Expired ${overdue}d ago` };
  }
  return { days, expired: false, label: `${days}d remaining` };
}

/** True once a node has blown through the 6-hour heartbeat cycle while its
 *  licence is still valid — warning only, per the handover rule that a missed
 *  heartbeat never blocks on its own. */
export function isHeartbeatStale(lastHeartbeatAt: string | null, now: number): boolean {
  if (!lastHeartbeatAt) {
    return true;
  }
  const parsed = Date.parse(lastHeartbeatAt);
  if (Number.isNaN(parsed)) {
    return true;
  }
  return now - parsed > 6 * HOUR;
}

export function clockTime(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    return '—';
  }
  return new Date(parsed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
