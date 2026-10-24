import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchOverview, FleetError } from '../api/fleet';
import type { FleetErrorCode } from '../api/fleet';
import type { FleetOverview } from '../api/types';

type Phase =
  | { status: 'loading' }
  | { status: 'ready'; data: FleetOverview }
  | { status: 'error'; code: FleetErrorCode; message: string };

export interface FleetOverviewState {
  phase: Phase;
  refresh: () => void;
}

export function useFleetOverview(): FleetOverviewState {
  const [phase, setPhase] = useState<Phase>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setPhase({ status: 'loading' });

    fetchOverview(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setPhase({ status: 'ready', data });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
          return;
        }
        if (error instanceof FleetError) {
          setPhase({ status: 'error', code: error.code, message: error.message });
          return;
        }
        /* Anything unrecognised is still reported as a transport failure; the
         * original error text is never rendered. */
        setPhase({
          status: 'error',
          code: 'server',
          message: 'The fleet overview could not be loaded.',
        });
      });

    return () => controller.abort();
  }, [nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return { phase, refresh };
}
