import { useEffect, useState } from 'react';

/**
 * A clock that re-renders on an interval.
 *
 * Licence countdowns and heartbeat ages are relative to now. Without a tick
 * they freeze at whatever they were when the table first rendered, so a node
 * that goes stale while the operator is reading the page keeps reporting as
 * healthy. Thirty seconds is fine-grained enough for a 6-hour heartbeat cycle
 * and cheap enough to leave running.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
