import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudentIdProvider } from '../hooks/StudentIdProvider';
import { HoldPage } from './HoldPage';

describe('HoldPage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('asks before releasing a reserved seat', async () => {
    const studentId = '20152691234567890';
    localStorage.setItem('school-admission.studentId', studentId);
    const hold = {
      holdId: 'h_1', classId: 'c_1', className: 'Class 6 - Morning Shift',
      studentId, status: 'HELD', expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      return new Response(JSON.stringify(hold), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    });

    render(<StudentIdProvider><HoldPage holdId="h_1" /></StudentIdProvider>);
    await screen.findByRole('button', { name: 'Cancel application' });
    await userEvent.click(screen.getByRole('button', { name: 'Cancel application' }));

    expect(screen.getByText('Release this seat?')).toBeInTheDocument();
    expect(fetchSpy.mock.calls.every(([, init]) => init?.method !== 'DELETE')).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Keep my seat' }));
    expect(screen.queryByText('Release this seat?')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel application' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel' }));
    expect(fetchSpy.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true);
  });
});
