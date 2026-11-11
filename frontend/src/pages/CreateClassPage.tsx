import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api/client';
import { Alert } from '../components/Alert';
import { navigate } from '../hooks/useHashRoute';
import { Icon } from '../components/Icon';

/** Each shift has its own class and seat count. */
export function CreateClassPage() {
  const [name, setName] = useState('');
  const [seats, setSeats] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setCreated('');

    const trimmed = name.trim();
    const total = Number(seats);
    if (!trimmed) return setError('Please enter a class name, e.g. "Class 6 - Morning Shift".');
    if (!Number.isInteger(total) || total < 1) return setError('Seats must be a whole number of at least 1.');

    setBusy(true);
    try {
      const cls = await api.createClass(trimmed, total);
      setCreated(`Created "${cls.name}" with ${cls.totalSeats} seats.`);
      setName('');
      setSeats('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the class.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="page-heading">
        <span className="eyebrow">ADMINISTRATION</span>
        <h1>Create a class</h1>
        <p className="hint">Add a class and shift with the number of seats available for admission.</p>
      </div>

      <div className="form-layout">
        <form className="card form" onSubmit={submit} noValidate>
          <div className="form-heading">
            <span className="stat-icon mint"><Icon name="book" /></span>
            <div><h2>Class details</h2><p className="hint">Each shift needs its own class.</p></div>
          </div>
          <label>
            Class name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Class 6 - Morning Shift" maxLength={200} />
          </label>
          <p className="field-help">Include the class and shift so parents can find the right option.</p>
          <label>
            Total seats
            <input type="number" min={1} step={1} value={seats} onChange={(e) => setSeats(e.target.value)} placeholder="120" />
          </label>
          <p className="field-help">Enter the total number of students this class can accommodate.</p>
          {error && <Alert onClose={() => setError('')}>{error}</Alert>}
          <button type="submit" disabled={busy}>
            <Icon name="plus" />{busy ? 'Creating…' : 'Create class'}
          </button>
        </form>
        <aside className="help-card">
          <Icon name="info" />
          <h3>A class for every shift</h3>
          <p>Each shift has its own class, seat count, and applications. Create them separately to keep admissions organized.</p>
          <div className="example-class"><Icon name="book" /><span>Class 6 - Morning Shift</span></div>
          <div className="example-class"><Icon name="book" /><span>Class 6 - Day Shift</span></div>
          <p>Once created, the class appears in Browse classes and students can start applying.</p>
        </aside>
      </div>
      {created && (
        <Alert kind="success" onClose={() => setCreated('')}>
          {created}{' '}
          <button type="button" className="link" onClick={() => navigate('/classes')}>
            View class list
          </button>
        </Alert>
      )}
    </section>
  );
}
