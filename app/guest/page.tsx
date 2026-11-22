// app/guest/page.tsx
// WHAT IT'S FOR: "Book without an account", at /guest: every shop a guest can book at, with its
// pros (title, live status, starting price). Each pro links to their schedule and booking page.
// No login needed. Demo shops show only while demo mode is on.
// WHO USES IT: anyone, from the "Book without an account" button on the home page.
// WHY THE NAME: folder path = URL (/guest).

import type { Metadata } from "next";
import Link from "next/link";
import { listGuestShops } from "@/lib/guest/booking";
import { LIVE_STATUS, money } from "@/lib/format";

export const metadata: Metadata = { title: "Book without an account · MyChair" };
export const dynamic = "force-dynamic";

export default async function GuestPage() {
  const shops = await listGuestShops();

  return (
    <main>
      <Link href="/">← Home</Link>
      <h1 className="!mt-2 !mb-1">Book without an account</h1>
      <p className="!mt-0">Pick any pro to see their open times.</p>
      {shops.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-3">No shops are taking bookings right now. Check back soon.</p>
      ) : (
        shops.map(({ shop, pros }) => (
          <section key={shop.id} aria-label={shop.name} className="mb-6">
            <h2>{shop.name}</h2>
            {pros.length === 0 ? (
              <p>No pros are taking bookings here yet.</p>
            ) : (
              <ul className="!list-none !p-0 grid gap-3 sm:grid-cols-2">
                {pros.map((p) => (
                  <li key={p.id}>
                    <Link href={`/guest/${p.id}`} className="block rounded-lg border border-border bg-bg p-4 !no-underline hover:bg-surface">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-text">{p.name}</span>
                        <span className="text-xs text-text-muted">{LIVE_STATUS[p.liveStatus] ?? p.liveStatus}</span>
                      </div>
                      <div className="text-sm text-text-muted">{p.title}</div>
                      {p.fromPriceCents !== null && <div className="mt-2 text-sm text-text">From {money(p.fromPriceCents)}</div>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
    </main>
  );
}
