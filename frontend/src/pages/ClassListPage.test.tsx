import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudentIdProvider } from '../hooks/useStudentId';
import { ClassListPage } from './ClassListPage';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const classes = [
  { id: 'c_1', name: 'Class 6 - Morning Shift', totalSeats: 120, heldSeats: 15, confirmedSeats: 80, availableSeats: 25 },
  { id: 'c_2', name: 'Class 6 - Day Shift', totalSeats: 10, heldSeats: 4, confirmedSeats: 6, availableSeats: 0 },
];

const renderPage = () =>
  render(
    <StudentIdProvider>
      <ClassListPage />
    </StudentIdProvider>,
  );

describe('ClassListPage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows seat counts and disables Apply for a full class', async () => {
    localStorage.setItem('school-admission.studentId', '20152691234567890');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, classes));

    renderPage();

    expect(await screen.findByText('Class 6 - Morning Shift')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Full' })).toBeDisabled();
  });

  it('shows a readable message when the class is already full (409)', async () => {
    localStorage.setItem('school-admission.studentId', '20152691234567890');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) =>
      init?.method === 'POST'
        ? json(409, { error: 'NO_SEATS_AVAILABLE', message: 'No seats' })
        : json(200, classes),
    );

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Apply' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/class is full/i);
  });

  it('tells the user when the server cannot be reached', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot reach the server/i);
  });

  it('filters classes by name and resets an empty search', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, classes));
    renderPage();
    await screen.findByText('Class 6 - Morning Shift');

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search classes' }), 'morning');
    expect(screen.getByText('Class 6 - Morning Shift')).toBeInTheDocument();
    expect(screen.queryByText('Class 6 - Day Shift')).not.toBeInTheDocument();

    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.type(screen.getByRole('searchbox'), 'no matching class');
    expect(screen.getByText('No matching classes')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('Class 6 - Day Shift')).toBeInTheDocument();
  });

  it('can show only classes with available seats', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, classes));
    renderPage();
    await screen.findByText('Class 6 - Day Shift');

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Filter by availability' }), 'available');
    expect(screen.getByText('Class 6 - Morning Shift')).toBeInTheDocument();
    expect(screen.queryByText('Class 6 - Day Shift')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1 of 2 classes')).toBeInTheDocument();
  });
});
