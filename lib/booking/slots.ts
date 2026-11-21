// lib/booking/slots.ts
// WHAT IT'S FOR: the booking rules that don't need a database, so they can be tested exactly:
//   openSlots       the start times a client can book with a pro on one day: inside the pro's
//                   working hours, outside breaks, not overlapping another active appointment,
//                   not in the past, and not beyond the shop's booking window.
//   effectivePrice  the price a client pays: the pro's custom price when the pro is on custom
//                   pricing and has one for that service, otherwise the shop's standard price.
//   canClientCancel whether it's still early enough for a client to cancel.
// WHO USES IT: lib/booking/data.ts and the booking routes. Tested by lib/booking/booking.test.ts.
// WHY THE NAME: booking "slots"; ".ts" = no screen code.

import { addDays, localDateParts, minutesToTime, timeToMinutes, zonedToUtc, type LocalDate } from "../demo/time";

// Start times are offered every 15 minutes.
export const SLOT_STEP_MIN = 15;

export type Rule = { kind: "work" | "break"; startTime: string; endTime: string };
export type Busy = { startsAt: Date; endsAt: Date };
export type Slot = { startsAt: string; time: string }; // ISO in UTC, and "HH:MM" local

// The bookable start times for one pro on one local date.
export function openSlots(args: {
  date: LocalDate;
  timeZone: string;
  rules: Rule[]; // this pro's rules for this weekday
  busy: Busy[]; // this pro's active appointments that day
  durationMin: number;
  now: Date;
  bookingWindowDays: number;
}): Slot[] {
  const { date, timeZone, rules, busy, durationMin, now, bookingWindowDays } = args;

  // Outside the booking window (in the past, or too far ahead): nothing to offer.
  const today = localDateParts(now, timeZone);
  const last = addDays(today, bookingWindowDays);
  const key = (d: LocalDate) => d.year * 10000 + d.month * 100 + d.day;
  if (key(date) < key(today) || key(date) > key(last)) return [];

  const work = rules.filter((r) => r.kind === "work");
  const breaks = rules.filter((r) => r.kind === "break").map((r) => [timeToMinutes(r.startTime), timeToMinutes(r.endTime)] as const);
  const slots: Slot[] = [];

  for (const shift of work) {
    const start = timeToMinutes(shift.startTime);
    const end = timeToMinutes(shift.endTime);
    for (let t = start; t + durationMin <= end; t += SLOT_STEP_MIN) {
      const finish = t + durationMin;
      // Skip anything that touches a break.
      if (breaks.some(([b0, b1]) => t < b1 && finish > b0)) continue;
      const startsAt = zonedToUtc(date, minutesToTime(t), timeZone);
      const endsAt = new Date(startsAt.getTime() + durationMin * 60000);
      // Not in the past, and not overlapping an existing appointment.
      if (startsAt.getTime() <= now.getTime()) continue;
      if (busy.some((b) => startsAt < b.endsAt && endsAt > b.startsAt)) continue;
      slots.push({ startsAt: startsAt.toISOString(), time: minutesToTime(t) });
    }
  }
  return slots;
}

// The price for a service with a pro, in cents.
export function effectivePrice(priceMode: string, customPriceCents: number | null, standardPriceCents: number): number {
  return priceMode === "custom" && customPriceCents !== null ? customPriceCents : standardPriceCents;
}

// True if a client may still cancel: at least "windowHours" before the start.
export function canClientCancel(startsAt: Date, windowHours: number, now: Date): boolean {
  return startsAt.getTime() - now.getTime() >= windowHours * 60 * 60 * 1000;
}

// "2026-11-24" -> a LocalDate, or null if it isn't a real date.
export function parseLocalDate(text: string): LocalDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return { year: y, month: mo, day: d, weekday: check.getUTCDay() };
}
