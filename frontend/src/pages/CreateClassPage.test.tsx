import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreateClassPage } from './CreateClassPage';

const response = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

describe('CreateClassPage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('updates the admin overview after creating a class', async () => {
    const firstClass = {
      id: 'c_1', name: 'Class 5 - Morning Shift', totalSeats: 30,
      heldSeats: 2, confirmedSeats: 8, availableSeats: 20,
    };
    const newClass = {
      id: 'c_2', name: 'Class 6 - Day Shift', totalSeats: 40,
      heldSeats: 0, confirmedSeats: 0, availableSeats: 40,
    };
    let created = false;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (init?.method === 'POST') {
        created = true;
        return response(201, newClass);
      }
      return response(200, created ? [firstClass, newClass] : [firstClass]);
    });

    render(<CreateClassPage />);
    expect(await screen.findByText('Class 5 - Morning Shift')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Class and shift name'), newClass.name);
    await userEvent.type(screen.getByLabelText('Total seats'), '40');
    await userEvent.click(screen.getByRole('button', { name: 'Create class' }));

    expect(await screen.findByText('Class 6 - Day Shift')).toBeInTheDocument();
    expect(screen.getByText('40 of 40 seats open')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('is ready with 40 seats');
  });
});
