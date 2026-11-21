// lib/demo/time.ts
// WHAT IT'S FOR: small helpers for "a time on a date in the shop's time zone". Appointments are
// stored in UTC; shops think in local time (9:00 in New York). These convert between the two
// using the built-in Intl API, which knows daylight saving time, so no date package is needed.
// WHO USES IT: lib/demo/seed.ts (and later the booking code). Tested by lib/demo/demo.test.ts.
// WHY THE NAME: time helpers; ".ts" = no screen code.

// A calendar date with its weekday (0 = Sunday).
export type LocalDate = { year: number; month: number; day: number; weekday: number };

// The calendar date it is right now in a time zone.
export function localDateParts(at: Date, timeZone: string): LocalDate {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return withWeekday(get("year"), get("month"), get("day"));
}

// The date "days" days after (or before) a date.
export function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return withWeekday(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

function withWeekday(year: number, month: number, day: number): LocalDate {
  return { year, month, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
}

// How many minutes the time zone is ahead of UTC at that moment (New York in winter = -300).
function offsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - at.getTime()) / 60000);
}

// The UTC moment for a local date and "HH:MM" time in a time zone.
export function zonedToUtc(date: LocalDate, time: string, timeZone: string): Date {
  const [h, m] = time.split(":").map(Number);
  const guess = Date.UTC(date.year, date.month - 1, date.day, h ?? 0, m ?? 0);
  // Two passes handle the hour around a daylight-saving change.
  const first = guess - offsetMinutes(new Date(guess), timeZone) * 60000;
  return new Date(guess - offsetMinutes(new Date(first), timeZone) * 60000);
}

// "09:30" -> 570, and back.
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
export function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
