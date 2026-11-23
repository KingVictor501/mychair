// app/guest/shop/[slug]/page.tsx
// WHAT IT'S FOR: step 2 of booking without an account, at /guest/shop/<shop link name>: the
// shop's pros, each with their title, live status and starting price. Tapping a pro opens their
// open times and booking form (/guest/<pro ID>). An unknown shop, or one a guest can't see,
// shows the "not found" page.
// WHO USES IT: anyone, after choosing a shop in the search on /guest.
// WHY THE NAME: "[slug]" is the shop's link name from the URL, e.g. "fade-factory".

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import ShopBanner from "@/components/ShopBanner";
import { ApiError } from "@/lib/api-error";
import { BUSINESS_TYPE, LIVE_STATUS, money } from "@/lib/format";
import { loadGuestShop } from "@/lib/guest/booking";

export const dynamic = "force-dynamic";

// Loads the shop, or shows "not found" for an unknown or hidden one.
async function load(slug: string) {
  try {
    return await loadGuestShop(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { shop } = await load((await params).slug);
  return { title: `Book at ${shop.name} · MyChair` };
}

export default async function GuestShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { shop, pros } = await load((await params).slug);
  // Pros who are in right now come first, so the quickest choice is at the top.
  const sorted = [...pros].sort((a, b) => Number(b.liveStatus === "available") - Number(a.liveStatus === "available"));

  return (
    <main>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Book without an account", href: "/guest" }, { label: shop.name }]} />
      <ShopBanner businessType={shop.businessType} title={shop.name} subtitle={`${BUSINESS_TYPE[shop.businessType] ?? shop.businessType} · Pick a pro to see their open times`} />
      {sorted.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-3">
          No pros are taking bookings here yet. <Link href="/guest">Find another shop</Link>
        </p>
      ) : (
        <ul className="!list-none !p-0 grid gap-3 sm:grid-cols-2">
          {sorted.map((p) => (
            <li key={p.id}>
              <Link href={`/guest/${p.id}`} className="block rounded-lg border border-border bg-bg p-4 !no-underline hover:bg-surface">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-text">{p.name}</span>
                  <span className="text-xs text-text-muted">{LIVE_STATUS[p.liveStatus] ?? p.liveStatus}</span>
                </div>
                <div className="text-sm text-text-muted">{p.title}</div>
                <div className="mt-2 flex items-center justify-between text-sm text-text">
                  <span>{p.fromPriceCents !== null ? `From ${money(p.fromPriceCents)}` : ""}</span>
                  <span aria-hidden>See times →</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
