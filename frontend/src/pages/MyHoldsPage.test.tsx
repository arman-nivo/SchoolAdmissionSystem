import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudentIdProvider } from '../hooks/StudentIdProvider';
import { useStudentId } from '../hooks/useStudentId';
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

  it('shows pending applications first, with the nearest deadline at the top', async () => {
    localStorage.setItem('school-admission.studentId', firstStudent);
    const soon = new Date(Date.now() + 5 * 60_000).toISOString();
    const later = new Date(Date.now() + 10 * 60_000).toISOString();
    const applications = [
      { holdId: 'h_confirmed', classId: 'c_1', className: 'Confirmed class', status: 'CONFIRMED', expiresAt: soon },
      { holdId: 'h_later', classId: 'c_2', className: 'Later deadline', status: 'HELD', expiresAt: later },
      { holdId: 'h_soon', classId: 'c_3', className: 'Sooner deadline', status: 'HELD', expiresAt: soon },
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(applications), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));

    render(<StudentIdProvider><MyHoldsPage /></StudentIdProvider>);

    expect(await screen.findByText('Sooner deadline')).toBeInTheDocument();
    expect(screen.getByText('Awaiting payment', { selector: '.application-summary span' }).parentElement).toHaveTextContent('2');
    expect(screen.getByText('Confirmed', { selector: '.application-summary span' }).parentElement).toHaveTextContent('1');
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((row) => row.querySelector('strong')?.textContent)).toEqual([
      'Sooner deadline', 'Later deadline', 'Confirmed class',
    ]);
  });

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
