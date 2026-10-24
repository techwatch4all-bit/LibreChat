import { STATUS_LABEL } from '../../api/types';
import type { TenantStatus } from '../../api/types';

/**
 * Status badge for the four states in the handover §P2 machine. Each state
 * carries its own token so the colour follows the theme rather than being
 * hard-coded here.
 */
export function StatusBadge({ status }: { status: TenantStatus }): JSX.Element {
  return (
    <span className="badge" data-status={status}>
      <span className="badge__pulse" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}
