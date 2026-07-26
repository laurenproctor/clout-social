import { SocialPlatform } from '@/types';

/**
 * Scheduling helpers for the Zernio publishing workflow.
 *
 * All preset builders return a Date in the user's LOCAL time zone. The picker
 * displays local wall-clock time; `localInputToUtcISO` performs the single,
 * explicit conversion to a UTC ISO-8601 string right before it is sent to
 * Zernio as `scheduledAt`.
 */

interface OptimalSlot {
  /** Hour of day (0-23), local time. */
  hour: number;
  /**
   * Restrict to specific weekdays (0 = Sun … 6 = Sat). When omitted, the next
   * available day is used. The soonest future day matching the constraint wins.
   */
  weekdays?: number[];
  /** Human-readable summary shown next to the preset button. */
  label: string;
}

// Platform-specific "best time to post" heuristics (local time).
const PLATFORM_OPTIMAL: Record<SocialPlatform, OptimalSlot> = {
  linkedin: { hour: 10, weekdays: [2, 4], label: 'Tue/Thu 10 AM' }, // B2B mid-morning
  blog: { hour: 10, weekdays: [2], label: 'Tue 10 AM' },
  twitter: { hour: 9, label: '9 AM' },
  instagram: { hour: 11, label: '11 AM' },
  tiktok: { hour: 19, label: '7 PM' }, // evening prime time
  youtube: { hour: 15, weekdays: [5, 6], label: 'Fri/Sat 3 PM' }, // weekend afternoon
};

/**
 * Find the soonest future Date at `hour`:00 local time. When `weekdays` is set,
 * only days matching one of those weekdays are considered. Scans up to 14 days
 * ahead so any weekday constraint is guaranteed to resolve.
 */
function nextSlot(hour: number, weekdays?: number[]): Date {
  const now = new Date();
  for (let i = 0; i <= 14; i++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + i);
    candidate.setHours(hour, 0, 0, 0);
    if (candidate <= now) continue;
    if (weekdays && !weekdays.includes(candidate.getDay())) continue;
    return candidate;
  }
  // Unreachable in practice; fall back to the next day at `hour`.
  const fallback = new Date(now);
  fallback.setDate(now.getDate() + 1);
  fallback.setHours(hour, 0, 0, 0);
  return fallback;
}

/** Preset: current moment + `hours`. */
export function getPlusHours(hours: number): Date {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d;
}

/** current moment + `days` (same clock time, `days` later). */
export function getPlusDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

/** Preset: the next calendar day at `hour`:00 local (default 9 AM). */
export function getTomorrowMorning(hour = 9): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** Preset: the next optimal engagement slot for the given platform. */
export function getOptimalTime(platform: SocialPlatform): Date {
  const slot = PLATFORM_OPTIMAL[platform] ?? PLATFORM_OPTIMAL.linkedin;
  return nextSlot(slot.hour, slot.weekdays);
}

/**
 * The upcoming peak posting slots for a platform within the next `withinDays`
 * days (default 7). Returns up to `count` distinct future slots at the
 * platform's optimal hour, honoring any weekday constraint — used to spread
 * multiple accounts on the same platform across the week. Falls back to daily
 * peak-hour slots if there aren't enough constrained days in the window.
 */
export function getPeakTimes(platform: SocialPlatform, count: number, withinDays = 7): Date[] {
  const slot = PLATFORM_OPTIMAL[platform] ?? PLATFORM_OPTIMAL.linkedin;
  const now = new Date();
  const out: Date[] = [];

  // Pass 1: honor weekday constraints within the window.
  for (let i = 0; i <= withinDays && out.length < count; i++) {
    const cand = new Date(now);
    cand.setDate(now.getDate() + i);
    cand.setHours(slot.hour, 0, 0, 0);
    if (cand <= now) continue;
    if (slot.weekdays && !slot.weekdays.includes(cand.getDay())) continue;
    out.push(cand);
  }

  // Pass 2: if still short (e.g. only 2 constrained days but more accounts),
  // fill with any remaining peak-hour days in the window.
  for (let i = 0; i <= withinDays && out.length < count; i++) {
    const cand = new Date(now);
    cand.setDate(now.getDate() + i);
    cand.setHours(slot.hour, 0, 0, 0);
    if (cand <= now) continue;
    if (out.some((d) => d.getTime() === cand.getTime())) continue;
    out.push(cand);
  }

  return out.sort((a, b) => a.getTime() - b.getTime());
}

/** Short label describing a platform's optimal slot (for the button subtitle). */
export function getOptimalLabel(platform: SocialPlatform): string {
  return (PLATFORM_OPTIMAL[platform] ?? PLATFORM_OPTIMAL.linkedin).label;
}

/**
 * Serialize a Date into the `YYYY-MM-DDTHH:mm` format that an
 * `<input type="datetime-local">` expects, using LOCAL time components.
 */
export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/**
 * Convert a `datetime-local` value (interpreted as LOCAL wall-clock time) into a
 * UTC ISO-8601 timestamp for Zernio's `scheduledAt` field. Returns null when the
 * value is empty or unparseable.
 */
export function localInputToUtcISO(localValue: string): string | null {
  if (!localValue) return null;
  const date = new Date(localValue); // no offset in the string => parsed as local
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** True when the local value parses to a moment strictly in the future. */
export function isFutureLocal(localValue: string): boolean {
  const date = new Date(localValue);
  return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
}

/** Friendly local-time label, e.g. "Tue, Jul 28, 10:00 AM". */
export function formatLocalReadable(localValue: string): string {
  const date = new Date(localValue);
  if (Number.isNaN(date.getTime())) return '';
  return formatDateReadable(date);
}

/** Friendly local-time label from a Date, e.g. "Tue, Jul 28, 10:00 AM". */
export function formatDateReadable(date: Date): string {
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
