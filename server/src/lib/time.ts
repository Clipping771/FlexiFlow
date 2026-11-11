// Usage days follow Asia/Dhaka (UTC+6, no daylight saving), so quotas reset at local midnight.
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

/** The Asia/Dhaka calendar day for `now`, as 'YYYY-MM-DD'. */
export function dhakaDay(now: Date = new Date()): string {
  return new Date(now.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}

/** The next Asia/Dhaka midnight after `now`, e.g. '2026-10-24T00:00:00+06:00'. */
export function nextDhakaMidnight(now: Date = new Date()): string {
  const local = new Date(now.getTime() + DHAKA_OFFSET_MS);
  local.setUTCDate(local.getUTCDate() + 1);
  return `${local.toISOString().slice(0, 10)}T00:00:00+06:00`;
}
