import { useEffect, useState } from 'react';

/**
 * A tiny router using the URL hash (#/classes, #/holds/h_123 ...).
 * The page you are on survives a refresh, and no extra library is needed.
 */
export function useHashRoute(): string {
  const read = () => window.location.hash.replace(/^#/, '') || '/classes';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(path: string): void {
  window.location.hash = path;
}
