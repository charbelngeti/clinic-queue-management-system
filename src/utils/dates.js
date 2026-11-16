import { config } from '../config/env.js';

// All clinic-local calendar logic (appointment slots, "today", ticket days) uses the clinic time zone,
// while timestamps are stored in UTC. This avoids the classic time-zone integration bug (see error analysis).

const partsFormatter = (tz) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  });

function zonedParts(date, tz = config.clinicTz) {
  const parts = Object.fromEntries(partsFormatter(tz).formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: +parts.year,
    month: +parts.month,
    day: +parts.day,
    hour: +parts.hour,
    minute: +parts.minute,
    second: +parts.second,
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday),
  };
}

function offsetMinutes(date, tz) {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Convert a clinic-local date ("2026-11-16") and time ("08:20") to a UTC Date. */
export function clinicDateTimeToUtc(dateStr, timeStr, tz = config.clinicTz) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off = offsetMinutes(new Date(guess), tz);
  return new Date(guess - off * 60000);
}

const pad = (n) => String(n).padStart(2, '0');

/** Clinic-local calendar date "YYYY-MM-DD" for a moment in time. */
export function clinicDate(date = new Date(), tz = config.clinicTz) {
  const p = zonedParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Clinic-local "HH:MM" for a moment in time. */
export function clinicTime(date, tz = config.clinicTz) {
  const p = zonedParts(date, tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Day of week (0 = Sunday) of a "YYYY-MM-DD" calendar date. */
export function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Add whole days to a "YYYY-MM-DD" calendar date. */
export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** UTC start (inclusive) and end (exclusive) of a clinic-local day. */
export function clinicDayRange(dateStr) {
  return { start: clinicDateTimeToUtc(dateStr, '00:00'), end: clinicDateTimeToUtc(addDays(dateStr, 1), '00:00') };
}

export const timeToMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
export const minutesToTime = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

export function ageFrom(dob, now = new Date()) {
  if (!dob) return null;
  const b = new Date(dob);
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age--;
  return age;
}
