import { api } from '../api/client';
import { Alert } from '../components/Alert';
import { StatusBadge } from '../components/StatusBadge';
import { POLL_INTERVAL_MS } from '../config';
import { navigate } from '../hooks/useHashRoute';
import { useNow } from '../hooks/useNow';
import { usePolling } from '../hooks/usePolling';
import { useStudentId } from '../hooks/useStudentId';
import { effectiveStatus, formatDuration, secondsLeft } from '../lib/holds';
import { Icon } from '../components/Icon';

/**
 * Screen 4: every application of this student and its status. Data comes from
 * the server (GET /me/holds), so it is still there after a refresh or a new browser.
 */
export function MyHoldsPage() {
  const { studentId } = useStudentId();
  const now = useNow();
  const { data: holds, error, loading } = usePolling(() => api.myHolds(studentId), POLL_INTERVAL_MS, [studentId], !!studentId);

  return (
    <section>
      <div className="page-heading"><span className="eyebrow">EVERY STEP, IN ONE PLACE</span><h1>My applications</h1><p className="hint">Track reserved seats, check payment deadlines, and see confirmed admissions.</p></div>
      {!studentId && <Alert kind="info">Enter the student's birth registration number at the top to see their applications.</Alert>}
      {error && <Alert>{error.message} (retrying automatically)</Alert>}
      {studentId && loading && !holds && <div className="loading-state" role="status"><span className="loading-spinner" />Loading your applications…</div>}
      {studentId && holds && holds.length === 0 && (
        <div className="empty-state"><span className="empty-icon"><Icon name="file" /></span><h3>Your next chapter starts with a class</h3><p>You haven't applied for a class yet. Explore available seats and find the right fit.</p>
          <button type="button" onClick={() => navigate('/classes')}>
            Browse classes <Icon name="arrow" />
          </button>
        </div>
      )}

      {studentId && holds && holds.length > 0 && (
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
              {holds.map((h) => {
                const status = effectiveStatus(h, now);
                return (
                  <tr key={h.holdId}>
                    <td><strong>{h.className ?? h.classId}</strong></td>
                    <td>
                      <StatusBadge status={status} />
                    </td>
                    <td className={status === 'HELD' && secondsLeft(h.expiresAt, now) <= 60 ? 'urgent' : ''}>{status === 'HELD' ? formatDuration(secondsLeft(h.expiresAt, now)) : '—'}</td>
                    <td>
                      <button type="button" className={status === 'HELD' ? '' : 'secondary'} onClick={() => navigate(`/holds/${h.holdId}`)}>
                        {status === 'HELD' ? 'Pay / cancel' : 'Details'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
