import { useState, type FormEvent } from 'react';
import { useStudentId } from '../hooks/useStudentId';
import { STUDENT_ID_PATTERN } from '../lib/holds';
import { Icon } from './Icon';

/** The box at the top of every page where the birth registration number is entered. No login. */
export function StudentIdBar() {
  const { studentId, setStudentId } = useStudentId();
  const [draft, setDraft] = useState(studentId);
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = draft.trim();
    if (!STUDENT_ID_PATTERN.test(value)) {
      setError('Birth registration number must be exactly 17 digits (numbers only).');
      return;
    }
    setError('');
    setStudentId(value);
  };

  return (
    <form className={`student-bar ${studentId ? 'identity-active' : ''}`} onSubmit={submit} aria-label="Student identity" noValidate>
      <div className="identity-heading"><span className="identity-icon"><Icon name={studentId ? 'check' : 'user'} /></span><div>
        <label htmlFor="student-id">Student birth registration no.</label>
        <p id="student-id-help">{studentId ? 'Applications and class actions now use this student number.' : 'Enter the student’s 17-digit number to apply or check applications.'}</p>
      </div></div>
      <div className="identity-controls">
      <input
        id="student-id"
        inputMode="numeric"
        autoComplete="off"
        placeholder="e.g. 20152691234567890"
        aria-describedby={error ? 'student-id-help student-id-error' : 'student-id-help'}
        aria-invalid={!!error}
        value={draft}
        maxLength={17}
        onChange={(e) => {
          setDraft(e.target.value.replace(/\D/g, ''));
          setError('');
        }}
      />
      <button type="submit">Use this number</button>
      </div>
      {studentId && (
        <span className="student-current">
          <Icon name="check" /> Active student: <strong>{studentId}</strong>{' '}
          <button
            type="button"
            className="link"
            onClick={() => {
              setStudentId('');
              setDraft('');
              setError('');
              document.getElementById('student-id')?.focus();
            }}
          >
            Change student
          </button>
        </span>
      )}
      {error && (
        <p id="student-id-error" className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
