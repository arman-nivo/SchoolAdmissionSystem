// Shapes of the backend JSON (see the API contract in the assignment).

export type HoldStatus = 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';

export interface SchoolClass {
  id: string;
  name: string;
  totalSeats: number;
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
}

export interface Hold {
  holdId: string;
  classId: string;
  className?: string;
  studentId?: string;
  status: HoldStatus;
  expiresAt: string;
  createdAt?: string;
  confirmedAt?: string;
}

export interface ApiErrorBody {
  error: string;
  message: string;
  details?: Record<string, string[]>;
}
