// app/pro/clients/page.tsx
// WHAT IT'S FOR: the pro's clients page, at /pro/clients: Client search (by full phone number, to
// find and book a client who calls in) and "Your clients": first name, phone, visits, last visit
// and no-show strikes, only for clients who picked this pro as their preferred pro. Never email.
// WHO USES IT: pros.
// WHY THE NAME: folder path = URL (/pro/clients).

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import ClientSearch from "@/components/ClientSearch";
import { HOME_FOR_ROLE } from "@/lib/auth/home";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getShop } from "@/lib/booking/data";
import { listMyClients } from "@/lib/pro/data";
import Breadcrumbs from "@/components/Breadcrumbs";

export const metadata: Metadata = { title: "My clients · MyChair" };

export default async function MyClientsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "pro") redirect(HOME_FOR_ROLE[user.role]);
  const shop = user.shopId ? await getShop(user.shopId) : null;
  if (!shop) redirect("/login");
  const clients = await listMyClients(user.id);

  return (
    <main className="!max-w-3xl">
      <Breadcrumbs items={[{ label: "My schedule", href: "/pro" }, { label: "My clients" }]} />
      <h1 className="!mt-2">My clients</h1>
      <ClientSearch mode="phone" />
      <h2>Your clients</h2>
      {clients.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-3">No clients yet. Clients appear here when they pick you as their preferred pro.</p>
      ) : (
        <ul className="!list-none !p-0 grid gap-2 sm:grid-cols-2">
          {clients.map((c) => (
            <li key={c.id}>
              <Link href={`/pro/clients/${c.id}`} className="block rounded-lg border border-border bg-bg p-3 !no-underline hover:bg-surface">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-text">{c.name}</span>
                  {c.hasCard && <span className="text-xs text-text-muted">Style card</span>}
                </span>
                <span className="block text-sm text-text-muted">{c.phone ?? "No phone"}</span>
                <span className="block text-sm text-text-muted">
                  {c.visits} {c.visits === 1 ? "visit" : "visits"}
                  {c.lastVisit && ` · last ${new Date(c.lastVisit).toLocaleDateString("en-US", { timeZone: shop.timezone, month: "short", day: "numeric" })}`}
                  {c.noShows > 0 && ` · ${c.noShows} no-show${c.noShows === 1 ? "" : "s"}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
