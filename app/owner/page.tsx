// app/owner/page.tsx
// WHAT IT'S FOR: the owner's dashboard, at /owner (or /owner?date=YYYY-MM-DD for another day):
//   - revenue: completed appointments today, this week and this month
//   - the day: every appointment across all pros, with steps (check in, complete, no-show)
//   - the team: each pro's live status, station, pay structure (owner only), price mode, and a
//     link to set their prices
//   - Client search by name or phone
// Only the shop's owner can open it; the server checks role and shop.
// WHO USES IT: owners.
// WHY THE NAME: folder path = URL (/owner).

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AppointmentActions from "@/components/AppointmentActions";
import ClientSearch from "@/components/ClientSearch";
import { HOME_FOR_ROLE } from "@/lib/auth/home";
import LogoutButton from "@/components/LogoutButton";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getShop } from "@/lib/booking/data";
import { parseLocalDate } from "@/lib/booking/slots";
import { addDays, localDateParts, type LocalDate } from "@/lib/demo/time";
import { APPOINTMENT_STATUS, LIVE_STATUS, money, shopTime } from "@/lib/format";
import { listShopDay, listTeam, shopRevenue } from "@/lib/owner/data";
import { payLabel } from "@/lib/owner/rules";

export const metadata: Metadata = { title: "My shop · MyChair" };
export const dynamic = "force-dynamic";

// "2026-11-24" from a LocalDate.
const ymd = (d: LocalDate) => `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;

export default async function OwnerHome({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "owner") redirect(HOME_FOR_ROLE[user.role]);
  const shop = user.shopId ? await getShop(user.shopId) : null;
  if (!shop) redirect("/login");

  const today = localDateParts(new Date(), shop.timezone);
  const asked = parseLocalDate((await searchParams).date ?? "");
  const date = asked ?? today;
  const isToday = ymd(date) === ymd(today);
  const [day, team, revenue] = await Promise.all([listShopDay(shop, date), listTeam(shop, today), shopRevenue(shop)]);
  const booked = day.filter((a) => a.status !== "cancelled");
  const dayTitle = isToday
    ? "Today"
    : new Date(Date.UTC(date.year, date.month - 1, date.day)).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "short", day: "numeric" });

  return (
    <main className="!max-w-4xl">
      <h1 className="!mb-1">{shop.name}</h1>
      <p className="!mt-0">Hi, {user.name}. Here&apos;s your shop.</p>

      <section aria-label="Revenue" className="grid grid-cols-3 gap-2">
        {[
          ["Today", revenue.todayCents],
          ["This week", revenue.weekCents],
          ["This month", revenue.monthCents],
        ].map(([label, cents]) => (
          <div key={label} className="rounded-lg border border-border bg-surface p-3">
            <div className="text-xs text-text-muted">{label}</div>
            <div className="text-lg font-semibold text-text">{money(Number(cents))}</div>
          </div>
        ))}
      </section>
      <p className="!mt-1 text-xs">Revenue is completed appointments, at the price they were booked at.</p>

      <section aria-label="Appointments" className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="!mb-1">{dayTitle}</h2>
          <nav aria-label="Change day" className="flex gap-3 text-sm">
            <Link href={`/owner?date=${ymd(addDays(date, -1))}`}>← Previous</Link>
            {!isToday && <Link href="/owner">Today</Link>}
            <Link href={`/owner?date=${ymd(addDays(date, 1))}`}>Next →</Link>
          </nav>
        </div>
        <p className="!mt-0 text-sm">
          {booked.length} booked · {money(booked.reduce((sum, a) => sum + a.priceCents, 0))} scheduled
        </p>
        {day.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface p-3">No appointments on this day.</p>
        ) : (
          <ul className="!list-none !p-0 grid gap-2">
            {day.map((a) => (
              <li key={a.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 ${a.status === "cancelled" || a.status === "no_show" ? "bg-surface opacity-70" : "bg-bg"}`}>
                <span>
                  <span className="block font-semibold text-text">
                    {shopTime(a.startsAt, shop.timezone)} · {a.proName}
                  </span>
                  <span className="block text-sm text-text-muted">
                    {a.clientName} · {a.serviceName} · {money(a.priceCents)} · {APPOINTMENT_STATUS[a.status] ?? a.status}
                  </span>
                </span>
                <AppointmentActions appointmentId={a.id} status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Team" className="mt-6">
        <h2>Team</h2>
        {team.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface p-3">No pros yet. Pros appear here once they join your shop.</p>
        ) : (
          <ul className="!list-none !p-0 grid gap-2 sm:grid-cols-3">
            {team.map((p) => (
              <li key={p.id} className="rounded-lg border border-border bg-bg p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-text">{p.name}</span>
                  <span className="text-xs text-text-muted">{LIVE_STATUS[p.liveStatus] ?? p.liveStatus}</span>
                </div>
                <div className="text-sm text-text-muted">
                  {p.title}
                  {p.station ? ` · Station ${p.station}` : ""}
                </div>
                <div className="mt-2 text-sm">
                  <div>Pay: {payLabel(p.payType, p.payAmount)}</div>
                  <div>Prices: {p.priceMode === "custom" ? "Custom" : "Standard"}</div>
                  <div>
                    Today: {p.todayCount} {p.todayCount === 1 ? "appointment" : "appointments"}
                  </div>
                  <div>Other pros can book for them: {p.allowOthersToBook ? "Yes" : "No"}</div>
                </div>
                <Link href={`/owner/pros/${p.id}`} className="mt-2 inline-block text-sm">
                  Set {p.name}&apos;s prices
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="!mt-1 text-xs">Pay is visible only to you and the Super Admin.</p>
      </section>

      <div className="mt-6">
        <ClientSearch mode="any" />
      </div>

      <section aria-label="Account" className="mt-8 border-t border-border pt-4">
        <LogoutButton />
      </section>
    </main>
  );
}
