import { useEffect, useState } from 'react';
import { serverNow } from '../lib/serverClock';

/** Server-corrected current time, re-rendering every second (drives countdowns). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const id = window.setInterval(() => setNow(serverNow()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
