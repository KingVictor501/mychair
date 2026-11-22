// app/book/page.tsx
// WHAT IT'S FOR: the client home, shown at /book: the pros in the client's shop, with their
// title, live status and starting price. Each links to that pro's booking page.
// WHO USES IT: clients (anyone else is sent to their own home page; logged-out visitors to /login).
// WHY THE NAME: folder name = URL ("app/book" -> /book).

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HOME_FOR_ROLE } from "@/lib/auth/home";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getShop, listPros } from "@/lib/booking/data";
import { getPreferredProId } from "@/lib/clients/preferred";
import { LIVE_STATUS, money } from "@/lib/format";
import Breadcrumbs from "@/components/Breadcrumbs";

export const metadata: Metadata = { title: "Book · MyChair" };

export default async function BookPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "client") redirect(HOME_FOR_ROLE[user.role]);
  const shop = user.shopId ? await getShop(user.shopId) : null;
  if (!shop) redirect("/login");
  // The client's preferred pro (if they picked one) is listed first, with a label.
  const [all, preferredProId] = await Promise.all([listPros(shop.id), getPreferredProId(user.id)]);
  const pros = [...all.filter((p) => p.id === preferredProId), ...all.filter((p) => p.id !== preferredProId)];

  return (
    <main>
      <Breadcrumbs items={[{ label: shop.name }]} />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="!mb-1">{shop.name}</h1>
        <Link href="/book/mine">My appointments</Link>
      </div>
      <p>Pick a pro to see their services and open times. You can book with any pro, and make one your preferred pro on their page.</p>
      {pros.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-3">No pros are taking bookings yet. Check back soon.</p>
      ) : (
        <ul className="!list-none !p-0 grid gap-3 sm:grid-cols-2">
          {pros.map((p) => (
            <li key={p.id}>
              <Link href={`/book/${p.id}`} className="block rounded-lg border border-border bg-bg p-4 !no-underline hover:bg-surface">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-text">
                    {p.name}
                    {/* A gold star marks the client's preferred pro. */}
                    {p.id === preferredProId && (
                      <span className="ml-1 text-star" role="img" aria-label="Your preferred pro">
                        ★
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-text-muted">{LIVE_STATUS[p.liveStatus] ?? p.liveStatus}</span>
                </div>
                <div className="text-sm text-text-muted">{p.title}</div>
                {p.bio && <p className="!mt-2 !mb-0 text-sm">{p.bio}</p>}
                {p.fromPriceCents !== null && <div className="mt-2 text-sm text-text">From {money(p.fromPriceCents)}</div>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
