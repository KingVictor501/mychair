// app/pro/page.tsx
// WHAT IT'S FOR: the pro home, at /pro: live status buttons and the pro's own schedule, as a day
// view (default) or a week view (?view=week), with buttons to check clients in, complete,
// cancel or mark a no-show. Use ?date=YYYY-MM-DD to look at another day.
// WHO USES IT: pros (anyone else is sent to their own home page).
// WHY THE NAME: folder name = URL ("app/pro" -> /pro).

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AppointmentActions from "@/components/AppointmentActions";
import LiveStatusPicker from "@/components/LiveStatusPicker";
import { HOME_FOR_ROLE } from "@/lib/auth/home";
import { worksAsPro } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPro, getShop } from "@/lib/booking/data";
import { parseLocalDate } from "@/lib/booking/slots";
import { addDays, localDateParts, type LocalDate } from "@/lib/demo/time";
import { money, shopTime } from "@/lib/format";
import { listSchedule, type ScheduleItem } from "@/lib/pro/data";
import Breadcrumbs from "@/components/Breadcrumbs";
import ShopBanner from "@/components/ShopBanner";
import StatusPill from "@/components/StatusPill";

export const metadata: Metadata = { title: "My schedule · MyChair" };

// "2026-11-24" from a LocalDate.
const ymd = (d: LocalDate) => `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;

export default async function ProHome({ searchParams }: { searchParams: Promise<{ date?: string; view?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Pros, and owners who also take appointments (lib/auth/permissions.ts).
  if (!worksAsPro(user)) redirect(HOME_FOR_ROLE[user.role]);
  const [shop, pro] = await Promise.all([user.shopId ? getShop(user.shopId) : null, getPro(user.id)]);
  if (!shop || !pro) redirect("/login");

  const params = await searchParams;
  const week = params.view === "week";
  const today = localDateParts(new Date(), shop.timezone);
  const date = (params.date && parseLocalDate(params.date)) || today;
  const days = week ? 7 : 1;
  const items = await listSchedule(user.id, shop, date, days);

  // Day headings for the week view.
  const byDay = new Map<string, ScheduleItem[]>();
  for (const it of items) {
    const key = new Date(it.startsAt).toLocaleDateString("en-US", { timeZone: shop.timezone, weekday: "long", month: "short", day: "numeric" });
    byDay.set(key, [...(byDay.get(key) ?? []), it]);
  }
  const booked = items.filter((i) => i.status !== "cancelled" && i.status !== "no_show");
  const link = (d: LocalDate, v = week) => `/pro?date=${ymd(d)}${v ? "&view=week" : ""}`;
  const title = week
    ? `Week of ${new Date(Date.UTC(date.year, date.month - 1, date.day)).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })}`
    : ymd(date) === ymd(today)
      ? "Today"
      : new Date(Date.UTC(date.year, date.month - 1, date.day)).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "short", day: "numeric" });

  return (
    <main className="!max-w-3xl">
      <Breadcrumbs items={user.role === "owner" ? [{ label: shop.name, href: "/owner" }, { label: "My schedule" }] : [{ label: "My schedule" }]} />
      <ShopBanner businessType={shop.businessType} title={`Hi, ${pro.name}`} subtitle={`${pro.title} at ${shop.name}`} />

      <section aria-label="Live status" className="mb-6">
        <LiveStatusPicker initial={pro.liveStatus} />
      </section>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="!m-0">{title}</h2>
        <nav aria-label="Change day" className="flex flex-wrap gap-2 text-sm">
          <Link href={link(addDays(date, -days))}>← Previous</Link>
          <Link href={link(today)}>Today</Link>
          <Link href={link(addDays(date, days))}>Next →</Link>
          <Link href={link(date, !week)}>{week ? "Day view" : "Week view"}</Link>
        </nav>
      </div>
      <p className="!mt-0 text-sm">
        {booked.length} booked · {money(booked.reduce((sum, i) => sum + i.priceCents, 0))} scheduled
      </p>

      {items.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-3">No appointments {week ? "this week" : "on this day"}.</p>
      ) : (
        [...byDay.entries()].map(([day, list]) => (
          <section key={day} className="mb-4">
            {week && <h3 className="!mb-2 text-base font-semibold text-text">{day}</h3>}
            <ul className="!list-none !p-0 grid gap-2">
              {list.map((a) => (
                <li key={a.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 ${a.status === "cancelled" || a.status === "no_show" ? "bg-surface opacity-70" : "bg-bg"}`}>
                  <span>
                    <span className="block font-semibold text-text">
                      {shopTime(a.startsAt, shop.timezone)} · {a.serviceName}
                    </span>
                    <span className="block text-sm text-text-muted">
                      <Link href={`/pro/clients/${a.clientId}`}>{a.clientName}</Link> · {money(a.priceCents)} <StatusPill status={a.status} />
                    </span>
                  </span>
                  <AppointmentActions appointmentId={a.id} status={a.status} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
