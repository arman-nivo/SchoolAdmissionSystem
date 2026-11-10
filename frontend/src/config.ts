declare global {
  interface Window {
    __APP_CONFIG__?: { apiUrl?: string };
  }
}

/**
 * Backend base URL, in priority order:
 * 1. window.__APP_CONFIG__.apiUrl  -> set at container start from env API_URL (no rebuild needed)
 * 2. VITE_API_URL                  -> set at build time / in .env for `npm run dev`
 * 3. http://localhost:8080         -> default from the spec
 */
export const API_URL: string = (
  window.__APP_CONFIG__?.apiUrl ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:8080'
).replace(/\/+$/, '');

/** How often seat counts and application status refresh without reloading (ms). */
export const POLL_INTERVAL_MS = 3000;
