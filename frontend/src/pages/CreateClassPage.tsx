import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api/client';
import { Alert } from '../components/Alert';
import { Icon } from '../components/Icon';
import { POLL_INTERVAL_MS } from '../config';
import { navigate } from '../hooks/useHashRoute';
import { usePolling } from '../hooks/usePolling';

/** School office overview and class creation. Each shift has its own seat count. */
export function CreateClassPage() {
  const { data: classes, error: overviewError, loading, refresh } = usePolling(
    api.listClasses, POLL_INTERVAL_MS, [],
  );
  const [name, setName] = useState('');
  const [seats, setSeats] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState('');

  const available = classes?.reduce((sum, schoolClass) => sum + schoolClass.availableSeats, 0);
  const held = classes?.reduce((sum, schoolClass) => sum + schoolClass.heldSeats, 0);
  const confirmed = classes?.reduce((sum, schoolClass) => sum + schoolClass.confirmedSeats, 0);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setCreated('');

    const className = name.trim();
    const totalSeats = Number(seats);
    if (!className) {
      setError('Enter a class name, such as “Class 6 - Morning Shift”.');
      return;
    }
    if (!Number.isInteger(totalSeats) || totalSeats < 1 || totalSeats > 100000) {
      setError('Enter a whole number between 1 and 100,000 for total seats.');
      return;
    }

    setBusy(true);
    try {
      const schoolClass = await api.createClass(className, totalSeats);
      setCreated(`“${schoolClass.name}” is ready with ${schoolClass.totalSeats} seats.`);
      setName('');
      setSeats('');
      await refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not create the class. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-page" aria-labelledby="admin-title">
      <div className="admin-hero">
        <div className="admin-hero-copy">
          <span className="hero-kicker"><Icon name="building" /> SCHOOL OFFICE</span>
          <h1 id="admin-title">A clear view of every seat.</h1>
          <p>Create classes, see how seats are filling, and keep admissions moving smoothly.</p>
          <a href="#class-form" onClick={(event) => {
            event.preventDefault();
            document.getElementById('class-form')?.scrollIntoView({ behavior: 'smooth' });
          }}>
            Create a class <Icon name="arrow" />
          </a>
        </div>
        <div className="admin-hero-image">
          <img src="/images/classroom-learning.webp" alt="Teacher helping students in a classroom" />
        </div>
      </div>

      <div className="admin-stats" aria-label="Admissions overview">
        <div className="admin-stat"><span className="admin-stat-icon blue"><Icon name="book" /></span><span>Classes</span><strong>{classes?.length ?? '—'}</strong></div>
        <div className="admin-stat"><span className="admin-stat-icon green"><Icon name="check" /></span><span>Open seats</span><strong>{available ?? '—'}</strong></div>
        <div className="admin-stat"><span className="admin-stat-icon amber"><Icon name="clock" /></span><span>On hold</span><strong>{held ?? '—'}</strong></div>
        <div className="admin-stat"><span className="admin-stat-icon lilac"><Icon name="graduate" /></span><span>Confirmed</span><strong>{confirmed ?? '—'}</strong></div>
      </div>

      <div className="admin-layout">
        <section className="card admin-form-panel" id="class-form" aria-labelledby="class-form-title">
          <div className="panel-heading">
            <span className="panel-heading-icon"><Icon name="plus" /></span>
            <div>
              <span className="eyebrow">ADD A NEW OPTION</span>
              <h2 id="class-form-title">Create a class</h2>
              <p>Students will see this class as soon as it is created.</p>
            </div>
          </div>

          <form className="form" onSubmit={submit} noValidate>
            <label htmlFor="class-name">Class and shift name</label>
            <input
              id="class-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Class 6 - Morning Shift"
              maxLength={200}
            />
            <p className="field-help">Use a separate class for each shift so parents can choose correctly.</p>

            <label htmlFor="total-seats">Total seats</label>
            <input
              id="total-seats"
              type="number"
              min={1}
              max={100000}
              step={1}
              value={seats}
              onChange={(event) => setSeats(event.target.value)}
              placeholder="e.g. 120"
            />
            <p className="field-help">The number of students this class can accept.</p>

            {error && <Alert onClose={() => setError('')}>{error}</Alert>}
            {created && (
              <Alert kind="success" onClose={() => setCreated('')}>
                {created}{' '}
                <button type="button" className="link" onClick={() => navigate('/classes')}>View in class list</button>
              </Alert>
            )}
            <button type="submit" disabled={busy}>
              <Icon name="plus" />{busy ? 'Creating class…' : 'Create class'}
            </button>
          </form>
        </section>

        <aside className="admin-side">
          <section className="card admin-classes" aria-labelledby="admin-classes-title">
            <div className="side-heading">
              <div><span className="eyebrow">LIVE OVERVIEW</span><h2 id="admin-classes-title">Current classes</h2></div>
              <Icon name="refresh" />
            </div>
            {overviewError && <Alert>{overviewError.message} (retrying automatically)</Alert>}
            {loading && !classes && <div className="loading-state" role="status"><span className="loading-spinner" />Loading classes…</div>}
            {classes?.length === 0 && <p className="admin-empty">No classes yet. Use the form to add the first one.</p>}
            {!!classes?.length && (
              <div className="admin-class-list">
                {classes.map((schoolClass) => {
                  const occupied = schoolClass.heldSeats + schoolClass.confirmedSeats;
                  const percentage = Math.round(occupied / schoolClass.totalSeats * 100);
                  return (
                    <div className="admin-class-row" key={schoolClass.id}>
                      <div><strong>{schoolClass.name}</strong><span>{schoolClass.availableSeats} of {schoolClass.totalSeats} seats open</span></div>
                      <span className="admin-class-percent">{percentage}% filled</span>
                      <div className="mini-track" aria-label={`${percentage}% of seats filled`}><span style={{ width: `${percentage}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
            <button type="button" className="link admin-view-link" onClick={() => navigate('/classes')}>
              View student class list <Icon name="arrow" />
            </button>
          </section>

          <section className="admin-guide" aria-labelledby="admin-guide-title">
            <span className="eyebrow">THE ADMISSION FLOW</span>
            <h2 id="admin-guide-title">What happens next?</h2>
            <div><span><Icon name="plus" /></span><p><strong>1. Create a class</strong>Give every shift its own name and seat limit.</p></div>
            <div><span><Icon name="user" /></span><p><strong>2. Students apply</strong>They reserve a seat with their birth registration number.</p></div>
            <div><span><Icon name="shield" /></span><p><strong>3. Seats stay accurate</strong>Confirmed admissions stay; unpaid holds expire automatically.</p></div>
          </section>
        </aside>
      </div>
    </section>
  );
}
