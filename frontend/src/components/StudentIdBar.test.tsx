import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { StudentIdProvider } from '../hooks/StudentIdProvider';
import { StudentIdBar } from './StudentIdBar';

const renderBar = () =>
  render(
    <StudentIdProvider>
      <StudentIdBar />
    </StudentIdProvider>,
  );

describe('StudentIdBar', () => {
  it('rejects a number that is not 17 digits', async () => {
    renderBar();
    await userEvent.type(screen.getByLabelText(/birth registration/i), '12345');
    await userEvent.click(screen.getByRole('button', { name: /use this number/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/exactly 17 digits/i);
  });

  it('accepts 17 digits and remembers it in localStorage', async () => {
    renderBar();
    await userEvent.type(screen.getByLabelText(/birth registration/i), '20152691234567890');
    await userEvent.click(screen.getByRole('button', { name: /use this number/i }));
    expect(screen.getByText('20152691234567890')).toBeInTheDocument();
    expect(localStorage.getItem('school-admission.studentId')).toBe('20152691234567890');
  });

  it('clears the selected student and focuses the input when changing students', async () => {
    localStorage.setItem('school-admission.studentId', '20152691234567890');
    renderBar();

    await userEvent.click(screen.getByRole('button', { name: 'Change student' }));

    expect(localStorage.getItem('school-admission.studentId')).toBeNull();
    expect(screen.getByLabelText(/birth registration/i)).toHaveValue('');
    expect(screen.getByLabelText(/birth registration/i)).toHaveFocus();
    expect(screen.queryByText('20152691234567890')).not.toBeInTheDocument();
  });
});
