// lib/pro/visits.ts
// WHAT IT'S FOR: turns a client's appointments with a pro into VISITS for the visit history.
// Everything the client had with that pro on the same day counts as one visit, so a fade at
// 10:00 and a beard trim at 10:45 show as one line, not two. No database, so it's tested exactly.
//   groupVisits  appointments (newest first) -> visits (newest first), each with the date, the
//                start time, every service, the total and whether it was completed
// WHO USES IT: components/VisitHistory.tsx. Tested by lib/pro/pro.test.ts.
// WHY THE NAME: visits; ".ts" = no screen code.

export type VisitAppointment = { id: string; startsAt: string; services: string[]; priceCents: number; status: string };

// How a visit turned out. There are only three:
//   completed    the client showed up (an appointment was completed, or is in the chair now)
//   no_show      they didn't come, and nothing that day was completed
//   rescheduled  everything that day was cancelled
// Appointments not marked yet ("waiting") aren't a visit outcome; they stay on the schedule.
export type VisitOutcome = "completed" | "no_show" | "rescheduled";

export type Visit = {
  key: string; // the local day, "2026-11-18"
  startsAt: string; // the earliest appointment that day
  services: string[]; // every service, in time order (an appointment with several shows each one)
  totalCents: number | null; // what the visit cost (the appointments they showed up for); null if they didn't come
  outcome: VisitOutcome;
};

// "2026-11-18" for a moment, in the shop's time zone.
export function localDay(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function groupVisits(appointments: VisitAppointment[], timeZone: string): Visit[] {
  const byDay = new Map<string, VisitAppointment[]>();
  for (const a of appointments) {
    if (a.status === "waiting") continue;
    const key = localDay(a.startsAt, timeZone);
    byDay.set(key, [...(byDay.get(key) ?? []), a]);
  }
  const visits: Visit[] = [];
  for (const [key, list] of byDay) {
    // Earliest first within the day, so services read in the order they were done.
    const inOrder = [...list].sort((x, y) => x.startsAt.localeCompare(y.startsAt));
    // "Showed up" = completed, or in the chair right now.
    const showedUp = inOrder.filter((a) => a.status === "completed" || a.status === "in_chair");
    const outcome: VisitOutcome = showedUp.length > 0 ? "completed" : inOrder.some((a) => a.status === "no_show") ? "no_show" : "rescheduled";
    visits.push({
      key,
      startsAt: inOrder[0]!.startsAt,
      // The services they came for; if they didn't come, the services that were booked.
      services: (outcome === "completed" ? showedUp : inOrder).flatMap((a) => a.services),
      // No cost for a no-show or a rescheduled visit.
      totalCents: outcome === "completed" ? showedUp.reduce((sum, a) => sum + a.priceCents, 0) : null,
      outcome,
    });
  }
  // Newest visit first.
  return visits.sort((x, y) => y.startsAt.localeCompare(x.startsAt));
}
