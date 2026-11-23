// lib/format.ts
// WHAT IT'S FOR: turning stored values into what people read: cents into dollars, and UTC times
// into the shop's local date and time.
// WHO USES IT: the booking, pro, owner and admin pages.
// WHY THE NAME: formatting helpers; ".ts" = no screen code.

// 5000 -> "$50", 2250 -> "$22.50".
export function money(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

// A UTC time shown in a shop's time zone, e.g. "Tue, Nov 24, 11:30 AM".
export function shopDateTime(iso: string | Date, timeZone: string): string {
  return new Date(iso).toLocaleString("en-US", { timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Just the time, e.g. "11:30 AM".
export function shopTime(iso: string | Date, timeZone: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
}

// "2026-11-24" -> "Tue, Nov 24".
export function dayLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
}

// Live status and appointment status in words.
// The kind of shop, in plain words.
export const BUSINESS_TYPE: Record<string, string> = { barbershop: "Barbershop", nail_salon: "Nail salon", lash_studio: "Lash studio" };
export const LIVE_STATUS: Record<string, string> = { available: "Available", with_client: "With a client", unavailable: "Unavailable" };
export const APPOINTMENT_STATUS: Record<string, string> = {
  waiting: "Booked",
  in_chair: "In the chair",
  completed: "Completed",
  no_show: "No-show",
  cancelled: "Cancelled",
};
