import type { FleetOverview } from './types';
import { demoOverview } from './demo';

/**
 * Fleet API client.
 *
 * The control service on :8443 is not built yet, so this client talks to a
 * contract rather than to a live server. `VITE_CONSOLE_DEMO=1` is the only way
 * to get fixture data, and it is surfaced in the UI as a labelled state —
 * a design review must never be mistakable for a live fleet reading.
 */

const API_BASE = import.meta.env.VITE_FLEET_API_BASE ?? '/api/v1';
export const DEMO_MODE = import.meta.env.VITE_CONSOLE_DEMO === '1';

export type FleetErrorCode = 'unreachable' | 'unauthorized' | 'server' | 'malformed';

/** Carries a stable code and operator-facing copy, never a raw transport error. */
export class FleetError extends Error {
  readonly code: FleetErrorCode;

  constructor(code: FleetErrorCode, message: string) {
    super(message);
    this.name = 'FleetError';
    this.code = code;
  }
}

const MESSAGES: Record<FleetErrorCode, string> = {
  unreachable: 'The control service is not responding. Check that :8443 is running and the tunnel is up.',
  unauthorized: 'This console session is no longer authorised. Re-authenticate with the service token.',
  server: 'The control service returned an error while assembling the fleet overview.',
  malformed: 'The fleet overview arrived in an unexpected shape and was discarded.',
};

export async function fetchOverview(signal?: AbortSignal): Promise<FleetOverview> {
  if (DEMO_MODE) {
    /* Small deliberate delay so loading and skeleton states are reviewable. */
    await new Promise((resolve) => setTimeout(resolve, 420));
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    return demoOverview();
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/fleet/overview`, {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new FleetError('unreachable', MESSAGES.unreachable);
  }

  if (response.status === 401 || response.status === 403) {
    throw new FleetError('unauthorized', MESSAGES.unauthorized);
  }
  if (!response.ok) {
    throw new FleetError('server', MESSAGES.server);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new FleetError('malformed', MESSAGES.malformed);
  }

  return parseOverview(payload);
}

/** Validates the wire shape before it reaches a component. A console that
 *  renders `undefined` from a drifted contract is worse than one that says
 *  the data was unusable. */
function parseOverview(payload: unknown): FleetOverview {
  if (typeof payload !== 'object' || payload === null) {
    throw new FleetError('malformed', MESSAGES.malformed);
  }
  const candidate = payload as Partial<FleetOverview>;
  if (typeof candidate.generatedAt !== 'string' || !Array.isArray(candidate.tenants)) {
    throw new FleetError('malformed', MESSAGES.malformed);
  }
  return candidate as FleetOverview;
}
