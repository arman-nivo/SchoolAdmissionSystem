import { useState } from 'react';
import { api, ApiError } from '../api/client';
import { Alert } from '../components/Alert';
import { StatusBadge } from '../components/StatusBadge';
import { POLL_INTERVAL_MS } from '../config';
import { navigate } from '../hooks/useHashRoute';
import { useNow } from '../hooks/useNow';
import { usePolling } from '../hooks/usePolling';
import { useStudentId } from '../hooks/useStudentId';
import { effectiveStatus, formatDuration, secondsLeft, STATUS_LABEL } from '../lib/holds';
import { Icon } from '../components/Icon';

/**
 * Screen 3: one application. Shows status, a live countdown, and the
 * "Pay admission fee" and "Cancel" buttons. When time runs out the page flips to
 * EXPIRED by itself and the pay button is disabled, no reload needed.
 */
export function HoldPage({ holdId }: { holdId: string }) {
  const { studentId } = useStudentId();
  const now = useNow();
  const { data: hold, error, loading, refresh } = usePolling(() => api.getHold(holdId), POLL_INTERVAL_MS, [holdId]);
  const [busy, setBusy] = useState<'pay' | 'cancel'>();
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState('');

  if (loading && !hold) return <div className="loading-state" role="status"><span className="loading-spinner" />Loading application…</div>;
  if (!hold) {
    return (
      <section>
        <h2>Application</h2>
        <Alert>{error?.message ?? 'Application not found.'}</Alert>
        <button type="button" onClick={() => navigate('/classes')}>
          Back to classes
        </button>
      </section>
    );
  }

  const status = effectiveStatus(hold, now);
  const left = secondsLeft(hold.expiresAt, now);
  const isOwner = !hold.studentId || hold.studentId === studentId;
  const canAct = status === 'HELD' && isOwner && !!studentId && busy === undefined;

  const run = async (kind: 'pay' | 'cancel') => {
    setActionError('');
    setMessage('');
    if (kind === 'cancel' && !window.confirm('Cancel this application? The seat will be given to someone else.')) return;
    setBusy(kind);
    try {
      if (kind === 'pay') {
        await api.confirmHold(hold.holdId, studentId);
        setMessage('Payment received. Admission confirmed!');
      } else {
        await api.cancelHold(hold.holdId, studentId);
        setMessage('Application cancelled.');
      }
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(undefined);
      void refresh();
    }
  };

  return (
    <section>
      <div className="page-heading"><span className="eyebrow">ONE STEP CLOSER</span><h1>Application details</h1><p className="hint">{status === 'HELD' ? 'Your seat is reserved. Complete the admission fee before the timer runs out.' : 'All the details of your admission, in one place.'}</p></div>
      {error && <Alert>{error.message} (retrying automatically)</Alert>}
      {actionError && <Alert onClose={() => setActionError('')}>{actionError}</Alert>}
      {message && (
        <Alert kind="success" onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}

      <div className="card hold-card">
        <div className="hold-heading"><span className="class-icon"><Icon name="school" /></span><div><h2>{hold.className ?? 'Your application'}</h2><p className="hint">Student admission</p></div><StatusBadge status={status} /></div>
        {status === 'HELD' && <div className={`payment-timer ${left <= 60 ? 'timer-urgent' : ''}`}><span className="timer-label"><Icon name="clock" /><span>Time left to complete payment<small>Your seat is held until the deadline below.</small></span></span><strong className={`countdown ${left <= 60 ? 'urgent' : ''}`} role="timer" aria-label="Time left to pay">{formatDuration(left)}</strong></div>}
        <dl>
          <dt>Class</dt>
          <dd>{hold.className ?? hold.classId}</dd>
          {hold.studentId && (
            <>
              <dt>Birth registration no.</dt>
              <dd>{hold.studentId}</dd>
            </>
          )}
          <dt>Status</dt>
          <dd>
            <StatusBadge status={status} /> <span className="muted">{STATUS_LABEL[status]}</span>
          </dd>
          <dt>{status === 'HELD' ? 'Deadline' : 'Deadline was'}</dt>
          <dd>{new Date(hold.expiresAt).toLocaleString()}</dd>
        </dl>

        {status === 'EXPIRED' && <Alert kind="info">The time to pay ran out and the seat was released. You can apply again from the class list if seats are free.</Alert>}
        {status === 'CANCELLED' && <Alert kind="info">This application was cancelled and its seat was released. You can browse classes to start a new application.</Alert>}
        {status === 'CONFIRMED' && <Alert kind="success">Admission confirmed! Your child's next chapter is ready to begin.</Alert>}
        {!isOwner && <Alert kind="info">This application belongs to a different birth registration number, so you cannot pay for or cancel it.</Alert>}
        {isOwner && !studentId && status === 'HELD' && <Alert kind="info">Enter the birth registration number at the top to pay or cancel.</Alert>}

        {status === 'HELD' && <div className="actions">
          <button type="button" onClick={() => run('pay')} disabled={!canAct}>
            <Icon name="check" />{busy === 'pay' ? 'Paying…' : 'Pay admission fee'}
          </button>
          <button type="button" className="secondary danger-button" onClick={() => run('cancel')} disabled={!canAct}>
            {busy === 'cancel' ? 'Cancelling…' : 'Cancel application'}
          </button>
        </div>}
        {(status === 'EXPIRED' || status === 'CANCELLED') && <button type="button" onClick={() => navigate('/classes')}>Browse available classes <Icon name="arrow" /></button>}
      </div>

      <p>
        <button type="button" className="link" onClick={() => navigate('/me')}>
          ← My applications
        </button>
      </p>
    </section>
  );
}
