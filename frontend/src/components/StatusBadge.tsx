import type { HoldStatus } from '../api/types';
import { STATUS_LABEL } from '../lib/holds';

export function StatusBadge({ status }: { status: HoldStatus }) {
  return (
    <span className={`badge badge-${status.toLowerCase()}`} title={STATUS_LABEL[status]}>
      {status === 'HELD' ? 'Awaiting payment' : status === 'CONFIRMED' ? 'Confirmed' : status === 'EXPIRED' ? 'Expired' : 'Cancelled'}
    </span>
  );
}
