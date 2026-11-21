// components/VisitHistory.tsx
// WHAT IT'S FOR: a client's visit history with this pro, grouped by month. Each month is a
// collapsible section (the built-in <details> element, so it works with a keyboard and needs no
// JavaScript). The current month starts open; earlier months start closed.
// WHO USES IT: app/pro/clients/[clientId]/page.tsx.
// WHY THE NAME: the visit history; ".tsx" = screen code. A server component (no "use client").

import { APPOINTMENT_STATUS, money, shopDateTime } from "@/lib/format";

type Visit = { id: string; startsAt: string; serviceName: string; priceCents: number; status: string };

// "2026-11" for a visit, in the shop's time zone.
function monthKey(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(new Date(iso));
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}`;
}

export default function VisitHistory({ visits, timeZone }: { visits: Visit[]; timeZone: string }) {
  if (visits.length === 0) return <p>No past visits with you yet.</p>;

  // Visits arrive newest first, so months come out newest first too.
  const months = new Map<string, Visit[]>();
  for (const v of visits) {
    const key = monthKey(v.startsAt, timeZone);
    months.set(key, [...(months.get(key) ?? []), v]);
  }
  const current = monthKey(new Date().toISOString(), timeZone);

  return (
    <div className="flex flex-col gap-2">
      {[...months.entries()].map(([key, list]) => {
        const [y, m] = key.split("-").map(Number);
        const label = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, 1)).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
        const completed = list.filter((v) => v.status === "completed");
        return (
          <details key={key} open={key === current} className="rounded-lg border border-border bg-bg">
            <summary className="flex cursor-pointer flex-wrap justify-between gap-2 p-3 font-semibold text-text">
              <span>{label}</span>
              <span className="text-sm font-normal text-text-muted">
                {list.length} {list.length === 1 ? "visit" : "visits"} · {money(completed.reduce((sum, v) => sum + v.priceCents, 0))}
              </span>
            </summary>
            <ul className="!m-0 !list-none grid gap-2 !px-3 !pb-3">
              {list.map((v) => (
                <li key={v.id} className="flex flex-wrap justify-between gap-2 rounded border border-border bg-surface p-2 text-sm">
                  <span className="text-text">
                    {v.serviceName} · {shopDateTime(v.startsAt, timeZone)}
                  </span>
                  <span>
                    {money(v.priceCents)} · {APPOINTMENT_STATUS[v.status] ?? v.status}
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
