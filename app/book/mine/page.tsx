// app/book/mine/page.tsx
// WHAT IT'S FOR: the client's appointments, at /book/mine: upcoming first, then past, each with
// its status. Upcoming ones can be cancelled until the shop's cancellation window.
// WHO USES IT: clients.
// WHY THE NAME: folder path = URL (/book/mine).

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import CancelButton from "@/components/CancelButton";
import { HOME_FOR_ROLE } from "@/lib/auth/home";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getShop, listClientAppointments, type ClientAppointment } from "@/lib/booking/data";
import { APPOINTMENT_STATUS, money, shopDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "My appointments · MyChair" };

export default async function MyAppointmentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "client") redirect(HOME_FOR_ROLE[user.role]);
  const shop = user.shopId ? await getShop(user.shopId) : null;
  if (!shop) redirect("/login");
  const all = await listClientAppointments(user.id, shop);
  const now = Date.now();
  const upcoming = all.filter((a) => new Date(a.startsAt).getTime() > now);
  const past = all.filter((a) => new Date(a.startsAt).getTime() <= now);

  // One appointment in the list.
  const row = (a: ClientAppointment) => (
    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-bg p-3">
      <span>
        <span className="block font-semibold text-text">
          {a.serviceName} with {a.proName}
        </span>
        <span className="block text-sm text-text-muted">
          {shopDateTime(a.startsAt, shop.timezone)} · {money(a.priceCents)} · {APPOINTMENT_STATUS[a.status] ?? a.status}
        </span>
      </span>
      {a.canCancel && <CancelButton appointmentId={a.id} />}
    </li>
  );

  return (
    <main>
      <Link href="/book">← Book another</Link>
      <h1 className="!mt-2">My appointments</h1>
      <h2>Upcoming</h2>
      {upcoming.length === 0 ? (
        <p>
          Nothing booked. <Link href="/book">Book an appointment</Link>.
        </p>
      ) : (
        <ul className="!list-none !p-0 grid gap-2">{upcoming.map(row)}</ul>
      )}
      <h2>Past</h2>
      {past.length === 0 ? <p>No past visits yet.</p> : <ul className="!list-none !p-0 grid gap-2">{past.slice(0, 20).map(row)}</ul>}
    </main>
  );
}
