// app/book/[proId]/page.tsx
// WHAT IT'S FOR: one pro's booking page, at /book/<pro ID>: their profile, services and prices,
// a "Make … my preferred pro" button, and the booking form. A fake or other-shop ID shows the
// "not found" page.
// WHO USES IT: clients.
// WHY THE NAME: "[proId]" is a dynamic route: the pro's ID comes from the URL.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import BookingForm from "@/components/BookingForm";
import PreferredProButton from "@/components/PreferredProButton";
import { HOME_FOR_ROLE } from "@/components/LoginForm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canAccessShop } from "@/lib/auth/permissions";
import { bookableDates, getPro, getShop, listProServices } from "@/lib/booking/data";
import { getPreferredProId } from "@/lib/clients/preferred";

export default async function ProBookingPage({ params }: { params: Promise<{ proId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "client") redirect(HOME_FOR_ROLE[user.role]);
  const { proId } = await params;
  // A malformed ID is treated like a missing one (never a server error).
  const pro = /^[0-9a-f-]{36}$/i.test(proId) ? await getPro(proId) : null;
  const shop = pro?.shopId ? await getShop(pro.shopId) : null;
  if (!pro || !shop || !canAccessShop(user, shop)) notFound();

  const [services, preferredProId] = await Promise.all([listProServices(pro.id, pro.priceMode, user.id), getPreferredProId(user.id)]);
  const dates = bookableDates(shop).map((d) => `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`);

  return (
    <main>
      <Link href="/book">← All pros</Link>
      <h1 className="!mt-2 !mb-1">
        {pro.name}
        {preferredProId === pro.id && (
          <span className="ml-2 text-star" role="img" aria-label="Your preferred pro">
            ★
          </span>
        )}
      </h1>
      <p className="!mt-0">
        {pro.title} at {shop.name}
      </p>
      {pro.bio && <p>{pro.bio}</p>}
      <PreferredProButton proId={pro.id} proName={pro.name} isPreferred={preferredProId === pro.id} />
      <BookingForm proId={pro.id} services={services} dates={dates} timeZone={shop.timezone} cancellationWindowHours={shop.cancellationWindowHours} />
    </main>
  );
}
