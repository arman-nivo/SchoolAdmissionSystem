import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudentIdProvider, useStudentId } from '../hooks/useStudentId';
import { MyHoldsPage } from './MyHoldsPage';

const firstStudent = '20152691234567890';
const secondStudent = '20152691234567891';

function SwitchablePage() {
  const { setStudentId } = useStudentId();
  return <>
    <button type="button" onClick={() => setStudentId(secondStudent)}>Switch student</button>
    <MyHoldsPage />
  </>;
}

describe('MyHoldsPage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('does not show a previous student’s applications when responses arrive out of order', async () => {
    localStorage.setItem('school-admission.studentId', firstStudent);
    const pending = new Map<string, (response: Response) => void>();
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => new Promise((resolve) => {
      const studentId = (init?.headers as Record<string, string>)['X-Student-Id'];
      pending.set(studentId, resolve);
    }));

    render(<StudentIdProvider><SwitchablePage /></StudentIdProvider>);
    expect(pending.has(firstStudent)).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Switch student' }));
    expect(pending.has(secondStudent)).toBe(true);

    const hold = (className: string, studentId: string) => [{
      holdId: className, classId: className, className,
      studentId, status: 'CONFIRMED', expiresAt: '2026-12-01T00:00:00Z',
    }];
    const response = (body: unknown) => new Response(JSON.stringify(body), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

    await act(async () => pending.get(secondStudent)!(response(hold('Second student class', secondStudent))));
    expect(screen.getByText('Second student class')).toBeInTheDocument();

    await act(async () => pending.get(firstStudent)!(response(hold('First student class', firstStudent))));
    expect(screen.queryByText('First student class')).not.toBeInTheDocument();
    expect(screen.getByText('Second student class')).toBeInTheDocument();
  });
});
