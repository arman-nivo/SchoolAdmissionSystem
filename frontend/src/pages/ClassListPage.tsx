import { useState } from 'react';
import { api, ApiError } from '../api/client';
import { Alert } from '../components/Alert';
import { Icon } from '../components/Icon';
import { POLL_INTERVAL_MS } from '../config';
import { navigate } from '../hooks/useHashRoute';
import { usePolling } from '../hooks/usePolling';
import { useStudentId } from '../hooks/useStudentId';

/** Screen 2: every class with total / held / confirmed / free seats and an Apply button. Auto-refreshes. */
export function ClassListPage() {
  const { studentId } = useStudentId();
  const { data: classes, error, loading, refresh } = usePolling(api.listClasses, POLL_INTERVAL_MS, []);
  const [applying, setApplying] = useState<string>();
  const [actionError, setActionError] = useState<ApiError>();
  const [query, setQuery] = useState('');
  const [availability, setAvailability] = useState('all');
  const visibleClasses = classes?.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()) && (availability !== 'available' || c.availableSeats > 0));
  const totalAvailable = classes?.reduce((sum, c) => sum + c.availableSeats, 0);
  const totalConfirmed = classes?.reduce((sum, c) => sum + c.confirmedSeats, 0);

  const apply = async (classId: string) => {
    setActionError(undefined);
    setApplying(classId);
    try {
      const hold = await api.createHold(classId, studentId);
      navigate(`/holds/${hold.holdId}`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Could not apply.'));
      void refresh();
    } finally {
      setApplying(undefined);
    }
  };

  return (
    <section aria-labelledby="classes-heading">
      <div className="welcome-panel">
        <div><span className="eyebrow">A NEW CHAPTER AWAITS</span><h1 id="classes-heading">Small steps today.<br /><span>Bright futures tomorrow.</span></h1><p>Find the right class, reserve a seat, and take the first step<br className="desktop-break" /> in your child's next learning adventure.</p><a className="welcome-link" href="#class-catalog" onClick={(e) => { e.preventDefault(); document.getElementById('class-catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>Find a class <Icon name="arrow" /></a></div>
        <div className="welcome-art" aria-hidden="true"><div className="art-orbit" /><span className="art-spark spark-one">✦</span><span className="art-spark spark-two">✧</span><div className="art-book"><Icon name="book" /></div><span className="art-caption">ROOM TO GROW</span></div>
      </div>

      <div className="stats-grid" aria-label="Admission overview">
        <div className="stat-card"><span className="stat-icon mint"><Icon name="book" /></span><div><span className="stat-label">Classes to explore</span><strong>{classes?.length ?? '—'}</strong><span className="stat-description">Find their next classroom</span></div></div>
        <div className="stat-card"><span className="stat-icon peach"><Icon name="people" /></span><div><span className="stat-label">Seats available</span><strong>{totalAvailable ?? '—'}</strong><span className="stat-description">Opportunities to get started</span></div></div>
        <div className="stat-card"><span className="stat-icon lavender"><Icon name="check" /></span><div><span className="stat-label">Admissions confirmed</span><strong>{totalConfirmed ?? '—'}</strong><span className="stat-description">Ready for a new beginning</span></div></div>
      </div>

      <div className="section-heading" id="class-catalog"><div><h2>Explore our classes</h2><p className="hint">Choose a class that’s right for your child.</p></div><span className={`live-label ${error ? 'offline' : ''}`}><span className="status-dot" />{error ? 'Reconnecting…' : loading ? 'Checking seats…' : 'Seats update automatically'}</span></div>

      <div className="catalog-toolbar"><label className="search-field"><Icon name="search" /><input aria-label="Search classes" type="search" placeholder="Search by class name or shift…" value={query} onChange={(e) => setQuery(e.target.value)} /></label><select aria-label="Filter by availability" value={availability} onChange={(e) => setAvailability(e.target.value)}><option value="all">All classes</option><option value="available">Available seats only</option></select></div>

      {!studentId && <Alert kind="info">Ready to apply? Enter the student's birth registration number above to reserve a seat.</Alert>}
      {actionError && (
        <Alert onClose={() => setActionError(undefined)}>
          {actionError.message}{' '}
          {actionError.code === 'ALREADY_APPLIED' && (
            <button type="button" className="link" onClick={() => navigate('/me')}>
              Open my applications
            </button>
          )}
        </Alert>
      )}
      {error && <Alert>{error.message} (retrying automatically)</Alert>}

      {loading && !classes && <div className="loading-state" role="status"><span className="loading-spinner" />Finding your next classroom…</div>}
      {classes && classes.length === 0 && (
        <div className="empty-state"><span className="empty-icon"><Icon name="book" /></span><h3>A new beginning is on its way</h3><p>No classes have been added yet. Check back soon, or add the first class as an administrator.</p>
          <button type="button" className="link" onClick={() => navigate('/admin')}>
            Create a class <Icon name="arrow" />
          </button>
        </div>
      )}

      {!!classes?.length && <p className="result-count" aria-live="polite">Showing {visibleClasses?.length} of {classes.length} classes</p>}
      {!!classes?.length && visibleClasses?.length === 0 && <div className="empty-state"><Icon name="search" /><h3>No matching classes</h3><p>Try a different class name or include classes with no available seats.</p><button type="button" className="secondary" onClick={() => { setQuery(''); setAvailability('all'); }}>Clear filters</button></div>}
      {!!visibleClasses?.length && (
        <div className="class-grid">
              {visibleClasses.map((c) => (
                <article key={c.id} className="class-card">
                  <div className="class-card-top"><span className={`class-icon ${c.availableSeats === 0 ? 'class-icon-full' : ''}`}><Icon name="book" /></span><span className={`availability-badge ${c.availableSeats === 0 ? 'is-full' : ''}`}><span className="status-dot" />{c.availableSeats === 0 ? 'Currently full' : 'Seats available'}</span></div>
                  <h3>{c.name}</h3><p className="class-subtitle">A new place to learn, discover, and grow.</p>
                  <div className="seat-summary"><span><strong>{c.availableSeats}</strong> seats available</span><span>of {c.totalSeats} total</span></div>
                  <div className="seat-track" role="img" aria-label={`${c.confirmedSeats} confirmed, ${c.heldSeats} on hold, ${c.availableSeats} available out of ${c.totalSeats} seats`}><span className="seat-confirmed" style={{ width: `${c.totalSeats > 0 ? c.confirmedSeats / c.totalSeats * 100 : 0}%` }} /><span className="seat-held" style={{ width: `${c.totalSeats > 0 ? c.heldSeats / c.totalSeats * 100 : 0}%` }} /></div>
                  <div className="seat-legend"><span><i className="legend-confirmed" />{c.confirmedSeats} confirmed</span><span><i className="legend-held" />{c.heldSeats} on hold</span></div>
                  <div className="class-card-bottom"><span><Icon name="clock" /> First come, first served</span>
                    <button
                      type="button"
                      onClick={() => apply(c.id)}
                      disabled={!studentId || c.availableSeats === 0 || applying !== undefined}
                      title={!studentId ? 'Enter birth registration number first' : c.availableSeats === 0 ? 'Class is full' : ''}
                    >
                      {applying === c.id ? 'Applying…' : c.availableSeats === 0 ? 'Full' : 'Apply'}<Icon name="arrow" />
                    </button>
                  </div>
                </article>
              ))}
        </div>
      )}
      <div className="process-strip"><span className="process-title"><Icon name="info" /> Your admission journey</span><span><b>1</b> Select your student</span><Icon name="arrow" /><span><b>2</b> Reserve a seat</span><Icon name="arrow" /><span><b>3</b> Pay before the deadline</span></div>
    </section>
  );
}
