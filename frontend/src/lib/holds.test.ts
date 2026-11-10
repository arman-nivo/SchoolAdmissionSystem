import { describe, expect, it } from 'vitest';
import { effectiveStatus, formatDuration, secondsLeft } from './holds';

describe('hold helpers', () => {
  const now = Date.parse('2026-11-01T04:00:00Z');

  it('counts seconds left and never goes negative', () => {
    expect(secondsLeft('2026-11-01T04:10:00Z', now)).toBe(600);
    expect(secondsLeft('2026-11-01T03:59:00Z', now)).toBe(0);
  });

  it('shows a HELD hold as EXPIRED as soon as its time is up', () => {
    expect(effectiveStatus({ status: 'HELD', expiresAt: '2026-11-01T04:00:05Z' }, now)).toBe('HELD');
    expect(effectiveStatus({ status: 'HELD', expiresAt: '2026-11-01T04:00:00Z' }, now)).toBe('EXPIRED');
    expect(effectiveStatus({ status: 'CONFIRMED', expiresAt: '2026-11-01T03:00:00Z' }, now)).toBe('CONFIRMED');
  });

  it('formats mm:ss', () => {
    expect(formatDuration(600)).toBe('10:00');
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(0)).toBe('00:00');
  });
});
