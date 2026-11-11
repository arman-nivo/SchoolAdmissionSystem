import { api } from '../api/client';
import type { HoldStatus } from '../api/types';
import { Alert } from '../components/Alert';
import { Icon } from '../components/Icon';
import { StatusBadge } from '../components/StatusBadge';
import { POLL_INTERVAL_MS } from '../config';
import { navigate } from '../hooks/useHashRoute';
import { useNow } from '../hooks/useNow';
import { usePolling } from '../hooks/usePolling';
import { useStudentId } from '../hooks/useStudentId';
import { effectiveStatus, formatDuration, secondsLeft } from '../lib/holds';

const STATUS_ORDER: Record<HoldStatus, number> = {
  HELD: 0,
  CONFIRMED: 1,
  EXPIRED: 2,
  CANCELLED: 3,
};

/** Applications come from the server, so they survive a refresh or browser restart. */
export function MyHoldsPage() {
  const { studentId } = useStudentId();
  const now = useNow();
  const { data: holds, error, loading } = usePolling(
    () => api.myHolds(studentId), POLL_INTERVAL_MS, [studentId], !!studentId,
  );
  const heldCount = holds?.filter((hold) => effectiveStatus(hold, now) === 'HELD').length ?? 0;
  const confirmedCount = holds?.filter((hold) => effectiveStatus(hold, now) === 'CONFIRMED').length ?? 0;

  // Put the applications that need payment first, with the nearest deadline on top.
  const orderedHolds = [...(holds ?? [])].sort((a, b) => {
    const firstStatus = effectiveStatus(a, now);
    const secondStatus = effectiveStatus(b, now);
    if (firstStatus !== secondStatus) return STATUS_ORDER[firstStatus] - STATUS_ORDER[secondStatus];
    if (firstStatus === 'HELD') return Date.parse(a.expiresAt) - Date.parse(b.expiresAt);
    return Date.parse(b.createdAt ?? b.expiresAt) - Date.parse(a.createdAt ?? a.expiresAt);
  });

  return (
    <section>
      <div className="page-heading">
        <span className="eyebrow">STUDENT APPLICATIONS</span>
        <h1>My applications</h1>
        <p className="hint">Reserved seats, payment deadlines, and confirmed admissions for the selected student.</p>
      </div>
      {!studentId && <Alert kind="info">Enter the student's birth registration number at the top to see their applications.</Alert>}
      {error && <Alert>{error.message} (retrying automatically)</Alert>}
      {studentId && loading && !holds && (
        <div className="loading-state" role="status"><span className="loading-spinner" />Loading your applications…</div>
      )}
      {studentId && holds && holds.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon"><Icon name="file" /></span>
          <h3>No applications yet</h3>
          <p>Browse available classes to reserve a seat for this student.</p>
          <button type="button" onClick={() => navigate('/classes')}>
            Browse classes <Icon name="arrow" />
          </button>
        </div>
      )}

      {studentId && holds && holds.length > 0 && (
        <>
          <div className="application-summary" role="group" aria-label="Application summary">
            <div><span>Awaiting payment</span><strong>{heldCount}</strong></div>
            <div><span>Confirmed</span><strong>{confirmedCount}</strong></div>
            <div><span>Total applications</span><strong>{holds.length}</strong></div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Status</th>
                  <th>Time left</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {orderedHolds.map((hold) => {
                  const status = effectiveStatus(hold, now);
                  const timeLeft = secondsLeft(hold.expiresAt, now);
                  return (
                    <tr key={hold.holdId}>
                      <td data-label="Class"><strong>{hold.className ?? hold.classId}</strong></td>
                      <td data-label="Status"><StatusBadge status={status} /></td>
                      <td data-label="Time left" className={status === 'HELD' && timeLeft <= 60 ? 'urgent' : ''}>
                        {status === 'HELD' ? formatDuration(timeLeft) : '—'}
                      </td>
                      <td data-label="Action">
                        <button
                          type="button"
                          className={status === 'HELD' ? '' : 'secondary'}
                          onClick={() => navigate(`/holds/${hold.holdId}`)}
                        >
                          {status === 'HELD' ? 'Pay / cancel' : 'Details'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
