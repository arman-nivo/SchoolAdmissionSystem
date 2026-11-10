import { API_URL } from '../config';
import type { ApiErrorBody, Hold, SchoolClass } from './types';
import { recordServerTime } from '../lib/serverClock';

/** Error with a message that is safe and clear enough to show to the user. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Friendlier wording for the error codes the backend can return. */
const FRIENDLY: Record<string, string> = {
  NO_SEATS_AVAILABLE: 'Sorry, this class is full right now. Seats may open again if someone does not pay in time.',
  ALREADY_APPLIED: 'This student already has an active application for this class. See "My applications".',
  ALREADY_ADMITTED: 'This student is already admitted to this class.',
  HOLD_EXPIRED: 'Time to pay has run out, so this seat was released. You can apply again if seats are available.',
  HOLD_CANCELLED: 'This application was cancelled.',
  ALREADY_CONFIRMED: 'The fee is already paid, so this admission cannot be cancelled here.',
  NOT_YOUR_HOLD: 'This application belongs to a different birth registration number.',
  CLASS_NOT_FOUND: 'This class no longer exists.',
  HOLD_NOT_FOUND: 'This application could not be found.',
  CLASS_EXISTS: 'A class with this name already exists.',
  STUDENT_ID_REQUIRED: 'Please enter the birth registration number at the top of the page first.',
  INVALID_STUDENT_ID: 'Birth registration number must be exactly 17 digits.',
  SERVICE_UNAVAILABLE: 'The server cannot reach its database right now. Please try again in a moment.',
};

async function request<T>(method: string, path: string, opts: { body?: unknown; studentId?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.studentId) headers['X-Student-Id'] = opts.studentId;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    // fetch only throws when the request never got an answer (server off, no network, CORS).
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Please check that it is running and try again.');
  }

  recordServerTime(res.headers.get('X-Server-Time'));

  if (res.status === 204) return undefined as T;

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }

  if (!res.ok) {
    const body = data as Partial<ApiErrorBody> | null;
    const code = body?.error ?? `HTTP_${res.status}`;
    const message =
      FRIENDLY[code] ??
      body?.message ??
      (res.status >= 500 ? 'Something went wrong on the server. Please try again.' : `Request failed (${res.status}).`);
    throw new ApiError(res.status, code, message);
  }
  return data as T;
}

export const api = {
  listClasses: () => request<SchoolClass[]>('GET', '/classes'),
  getClass: (classId: string) => request<SchoolClass>('GET', `/classes/${encodeURIComponent(classId)}`),
  createClass: (name: string, totalSeats: number) => request<SchoolClass>('POST', '/classes', { body: { name, totalSeats } }),
  createHold: (classId: string, studentId: string) =>
    request<Hold>('POST', `/classes/${encodeURIComponent(classId)}/holds`, { studentId }),
  getHold: (holdId: string) => request<Hold>('GET', `/holds/${encodeURIComponent(holdId)}`),
  confirmHold: (holdId: string, studentId: string) =>
    request<Hold>('POST', `/holds/${encodeURIComponent(holdId)}/confirm`, { studentId }),
  cancelHold: (holdId: string, studentId: string) =>
    request<void>('DELETE', `/holds/${encodeURIComponent(holdId)}`, { studentId }),
  myHolds: (studentId: string) => request<Hold[]>('GET', '/me/holds', { studentId }),
};
