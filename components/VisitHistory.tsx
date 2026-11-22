// components/VisitHistory.tsx
// WHAT IT'S FOR: a client's visit history with this pro, grouped by month. One line per VISIT
// (everything on the same day counts as one visit, lib/pro/visits.ts): the date, the start time,
// the services (in smaller text so they all fit), the cost, and the outcome: Completed (they
// showed up), No-show or Rescheduled. No cost is shown for a no-show or a rescheduled visit. Each
// month is a collapsible section (the built-in <details> element, so it works with a keyboard and
// needs no JavaScript) showing how many visits it had. The current month starts open.
// WHO USES IT: app/pro/clients/[clientId]/page.tsx.
// WHY THE NAME: the visit history; ".tsx" = screen code. A server component (no "use client").

import { money, shopTime } from "@/lib/format";
import { groupVisits, localDay, type VisitAppointment, type VisitOutcome } from "@/lib/pro/visits";

// How each outcome reads: Completed stands out; No-show and Rescheduled are quieter.
const OUTCOME: Record<VisitOutcome, { label: string; style: string }> = {
  completed: { label: "Completed", style: "border-border bg-surface text-text" },
  no_show: { label: "No-show", style: "border-border bg-bg text-text-muted" },
  rescheduled: { label: "Rescheduled", style: "border-border bg-bg text-text-muted" },
};

// "Tue, Nov 18" for a visit's day.
function dayLabel(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleDateString("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" });
}

export default function VisitHistory({ visits: appointments, timeZone }: { visits: VisitAppointment[]; timeZone: string }) {
  if (appointments.length === 0) return <p>No past visits with you yet.</p>;

  // Visits come out newest first, so months do too. Month key = "2026-11".
  const months = new Map<string, ReturnType<typeof groupVisits>>();
  for (const v of groupVisits(appointments, timeZone)) {
    const key = v.key.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), v]);
  }
  const current = localDay(new Date().toISOString(), timeZone).slice(0, 7);

  return (
    <div className="flex flex-col gap-2">
      {[...months.entries()].map(([key, list]) => {
        const [y, m] = key.split("-").map(Number);
        const label = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, 1)).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
        return (
          <details key={key} open={key === current} className="overflow-hidden rounded-lg border border-border bg-bg">
            <summary className="flex cursor-pointer flex-wrap justify-between gap-2 p-3 font-semibold text-text">
              <span>{label}</span>
              <span className="text-sm font-normal text-text-muted">
                {list.length} {list.length === 1 ? "visit" : "visits"}
              </span>
            </summary>
            <ul className="!m-0 !list-none !p-0 divide-y divide-border border-t border-border">
              {list.map((v) => (
                <li key={v.key} className="grid grid-cols-[auto_1fr_auto] items-start gap-x-3 px-3 py-2 text-sm">
                  {/* Date over time, on the left. */}
                  <span className="whitespace-nowrap">
                    <span className="block text-text">{dayLabel(v.startsAt, timeZone)}</span>
                    <span className="block text-xs text-text-muted">{shopTime(v.startsAt, timeZone)}</span>
                  </span>
                  {/* Every service from that visit, small so they all fit (they wrap if needed). */}
                  <span className="min-w-0 text-xs leading-5 text-text-muted">{v.services.join(" · ")}</span>
                  {/* Total over outcome, on the right. */}
                  <span className="flex flex-col items-end gap-1">
                    {/* No cost is shown for a no-show or a rescheduled visit. */}
                    {v.totalCents !== null && <span className="text-text">{money(v.totalCents)}</span>}
                    <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${OUTCOME[v.outcome].style}`}>{OUTCOME[v.outcome].label}</span>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
