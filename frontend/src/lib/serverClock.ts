/**
 * The countdown must use the server's clock, not the user's computer clock
 * (which may be minutes off). Every API response carries X-Server-Time; we keep
 * the difference and apply it when computing "now".
 */
let offsetMs = 0;

export function recordServerTime(header: string | null): void {
  if (!header) return;
  const server = Date.parse(header);
  if (!Number.isNaN(server)) offsetMs = server - Date.now();
}

export function serverNow(): number {
  return Date.now() + offsetMs;
}
