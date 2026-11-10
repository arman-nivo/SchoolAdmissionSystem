import type { Hold, HoldStatus } from '../api/types';

/** Seconds left until the hold expires (never negative). */
export function secondsLeft(expiresAt: string, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
}

/**
 * Status to show right now. A HELD hold whose time is up is shown as EXPIRED
 * immediately, without waiting for the next refresh from the server.
 */
export function effectiveStatus(hold: Pick<Hold, 'status' | 'expiresAt'>, now: number): HoldStatus {
  if (hold.status === 'HELD' && secondsLeft(hold.expiresAt, now) === 0) return 'EXPIRED';
  return hold.status;
}

/** 125 -> "02:05" */
export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const STATUS_LABEL: Record<HoldStatus, string> = {
  HELD: 'Seat held - waiting for payment',
  CONFIRMED: 'Admission confirmed',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

export const STUDENT_ID_PATTERN = /^\d{17}$/;
