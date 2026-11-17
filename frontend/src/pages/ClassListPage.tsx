import { useState } from 'react';
import { api, ApiError } from '../api/client';
import type { Hold } from '../api/types';
import { Alert } from '../components/Alert';
import { Icon } from '../components/Icon';
import { POLL_INTERVAL_MS } from '../config';
import { navigate } from '../hooks/useHashRoute';
import { useNow } from '../hooks/useNow';
import { usePolling } from '../hooks/usePolling';
import { useStudentId } from '../hooks/useStudentId';
import { effectiveStatus } from '../lib/holds';

/** Browse live seat counts and reopen applications for the selected student. */
export function ClassListPage() {
  const { studentId } = useStudentId();
  const now = useNow();
  const { data: classes, error, loading, refresh } = usePolling(api.listClasses, POLL_INTERVAL_MS, []);
  const { data: applications, refresh: refreshApplications } = usePolling(
    () => api.myHolds(studentId), POLL_INTERVAL_MS, [studentId], !!studentId,
  );
  const [applying, setApplying] = useState<string>();
  const [actionError, setActionError] = useState<ApiError>();
  const [query, setQuery] = useState('');
  const [availability, setAvailability] = useState('all');
  const visibleClasses = classes?.filter((schoolClass) =>
    schoolClass.name.toLowerCase().includes(query.trim().toLowerCase()) &&
    (availability !== 'available' || schoolClass.availableSeats > 0),
  );

  // The server can still report HELD for a few seconds after its deadline.
  // Use the same live status calculation as the application detail page.
  const activeByClass = new Map<string, Hold>();
  for (const application of applications ?? []) {
    if (application.studentId !== studentId) continue;
    const status = effectiveStatus(application, now);
    if (status === 'HELD' || status === 'CONFIRMED') {
      activeByClass.set(application.classId, application);
    }
  }

  const apply = async (classId: string) => {
    setActionError(undefined);
    setApplying(classId);
    try {
      const hold = await api.createHold(classId, studentId);
      navigate(`/holds/${hold.holdId}`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Could not apply.'));
      void refresh();
      void refreshApplications();
    } finally {
      setApplying(undefined);
    }
  };

  return (
    <section aria-labelledby="classes-heading">
      <div className="welcome-panel">
        <div className="welcome-copy">
          <span className="hero-kicker"><Icon name="sparkle" /> ADMISSIONS MADE SIMPLE</span>
          <h1 id="classes-heading">A brighter start<br />begins <em>here.</em></h1>
          <p>Explore classes, reserve a seat, and follow every step of your child's admission in one place.</p>
          <div className="hero-actions">
            <a
              className="hero-primary"
              href="#class-catalog"
              onClick={(event) => {
                event.preventDefault();
                document.getElementById('class-catalog')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Explore classes <Icon name="arrow" />
            </a>
            <a className="hero-secondary" href="#/me">Track an application</a>
          </div>
        </div>
        <div className="welcome-visual">
          <img src="/images/school-campus.webp" alt="Students walking toward a school building" />
          <span className="photo-caption"><Icon name="graduate" /> Every journey starts with a seat</span>
        </div>
      </div>

      <div className="process-strip" aria-label="How to apply">
        <div className="journey-step">
          <span className="journey-icon"><Icon name="user" /></span>
          <div><small>STEP 01</small><strong>Enter student ID</strong><span>Use the 17-digit birth registration number.</span></div>
        </div>
        <div className="journey-step">
          <span className="journey-icon"><Icon name="book" /></span>
          <div><small>STEP 02</small><strong>Choose a class</strong><span>Check live seats and reserve a place.</span></div>
        </div>
        <div className="journey-step">
          <span className="journey-icon"><Icon name="wallet" /></span>
          <div><small>STEP 03</small><strong>Confirm admission</strong><span>Complete the demo payment before time runs out.</span></div>
        </div>
      </div>

      <div className="section-heading" id="class-catalog">
        <div><h2>Browse classes</h2><p className="hint">Seat counts refresh automatically.</p></div>
        <span className={`live-label ${error ? 'offline' : ''}`}>
          <span className="status-dot" />
          {error ? 'Reconnecting…' : loading ? 'Checking seats…' : 'Live seat counts'}
        </span>
      </div>

      <div className="catalog-toolbar">
        <label className="search-field">
          <Icon name="search" />
          <input
            aria-label="Search classes"
            type="search"
            placeholder="Search class or shift"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select aria-label="Filter by availability" value={availability} onChange={(event) => setAvailability(event.target.value)}>
          <option value="all">All classes</option>
          <option value="available">Available seats only</option>
        </select>
      </div>

      {!studentId && <Alert kind="info">Ready to apply? Enter the student's birth registration number above to reserve a seat.</Alert>}
      {actionError && (
        <Alert onClose={() => setActionError(undefined)}>
          {actionError.message}{' '}
          {(actionError.code === 'ALREADY_APPLIED' || actionError.code === 'ALREADY_ADMITTED') && (
            <button type="button" className="link" onClick={() => navigate('/me')}>
              Open my applications
            </button>
          )}
        </Alert>
      )}
      {error && <Alert>{error.message} (retrying automatically)</Alert>}

      {loading && !classes && (
        <div className="loading-state" role="status"><span className="loading-spinner" />Loading classes…</div>
      )}
      {classes && classes.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon"><Icon name="book" /></span>
          <h3>No classes yet</h3>
          <p>An administrator can add the first class and its available seats.</p>
          <button type="button" className="link" onClick={() => navigate('/admin')}>
            Create a class <Icon name="arrow" />
          </button>
        </div>
      )}

      {!!classes?.length && (
        <p className="result-count" aria-live="polite">Showing {visibleClasses?.length} of {classes.length} classes</p>
      )}
      {!!classes?.length && visibleClasses?.length === 0 && (
        <div className="empty-state">
          <Icon name="search" />
          <h3>No matching classes</h3>
          <p>Try a different class name or include classes with no available seats.</p>
          <button type="button" className="secondary" onClick={() => { setQuery(''); setAvailability('all'); }}>
            Clear filters
          </button>
        </div>
      )}
      {!!visibleClasses?.length && (
        <div className="class-grid">
          {visibleClasses.map((schoolClass) => {
            const application = activeByClass.get(schoolClass.id);
            const isFull = schoolClass.availableSeats === 0;
            const isConfirmed = application?.status === 'CONFIRMED';
            let buttonLabel = 'Apply';
            if (isFull) buttonLabel = 'Full';
            if (applying === schoolClass.id) buttonLabel = 'Applying…';
            if (application) buttonLabel = isConfirmed ? 'View admission' : 'View application';
            let availabilityLabel = isFull ? 'Currently full' : 'Seats available';
            if (application) availabilityLabel = isConfirmed ? 'Admission confirmed' : 'Seat reserved';
            let description = 'Check the seat count before applying.';
            if (application) {
              description = isConfirmed
                ? 'This student is admitted to this class.'
                : 'A seat is held for this student. Pay before the deadline.';
            }

            return (
              <article key={schoolClass.id} className="class-card">
                <div className="class-card-top">
                  <span className={`class-icon ${isFull ? 'class-icon-full' : ''}`}><Icon name="book" /></span>
                  <span className={`availability-badge ${isFull && !application ? 'is-full' : ''}`}>
                    <span className="status-dot" />
                    {availabilityLabel}
                  </span>
                </div>
                <h3>{schoolClass.name}</h3>
                <p className="class-subtitle">{description}</p>
                <div className="seat-summary">
                  <span><strong>{schoolClass.availableSeats}</strong> seats available</span>
                  <span>of {schoolClass.totalSeats} total</span>
                </div>
                <div
                  className="seat-track"
                  role="img"
                  aria-label={`${schoolClass.confirmedSeats} confirmed, ${schoolClass.heldSeats} on hold, ${schoolClass.availableSeats} available out of ${schoolClass.totalSeats} seats`}
                >
                  <span className="seat-confirmed" style={{ width: `${schoolClass.confirmedSeats / schoolClass.totalSeats * 100}%` }} />
                  <span className="seat-held" style={{ width: `${schoolClass.heldSeats / schoolClass.totalSeats * 100}%` }} />
                </div>
                <div className="seat-legend">
                  <span><i className="legend-confirmed" />{schoolClass.confirmedSeats} confirmed</span>
                  <span><i className="legend-held" />{schoolClass.heldSeats} on hold</span>
                </div>
                <div className="class-card-bottom">
                  <span><Icon name="clock" /> First come, first served</span>
                  <button
                    type="button"
                    onClick={() => application ? navigate(`/holds/${application.holdId}`) : apply(schoolClass.id)}
                    disabled={!application && (!studentId || isFull || applying !== undefined)}
                    title={!application && !studentId ? 'Enter a birth registration number first' : undefined}
                  >
                    {buttonLabel}<Icon name="arrow" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
