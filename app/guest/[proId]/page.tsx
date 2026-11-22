// app/guest/[proId]/page.tsx
// WHAT IT'S FOR: one pro's schedule and booking page for someone without an account, at
// /guest/<pro ID>: the pro's profile, services and prices, open times, and the booking form,
// which asks for first name and phone. A made-up ID, or a shop a guest can't see, shows the
// "not found" page.
// WHO USES IT: anyone, from /guest.
// WHY THE NAME: "[proId]" is the pro's ID from the URL.

import { notFound } from "next/navigation";
import BookingForm from "@/components/BookingForm";
import { ApiError } from "@/lib/api-error";
import { bookableDates, listProServices } from "@/lib/booking/data";
import { loadGuestPro } from "@/lib/guest/booking";
import Breadcrumbs from "@/components/Breadcrumbs";

export const dynamic = "force-dynamic";

export default async function GuestProPage({ params }: { params: Promise<{ proId: string }> }) {
  const { proId } = await params;
  let found: Awaited<ReturnType<typeof loadGuestPro>>;
  try {
    found = await loadGuestPro(proId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const { pro, shop } = found;
  const services = await listProServices(pro.id, pro.priceMode);
  const dates = bookableDates(shop).map((d) => `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`);

  return (
    <main>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Book without an account", href: "/guest" }, { label: pro.name }]} />
      <h1 className="!mt-2 !mb-1">{pro.name}</h1>
      <p className="!mt-0">
        {pro.title} at {shop.name}
      </p>
      {pro.bio && <p>{pro.bio}</p>}
      <BookingForm guest proId={pro.id} services={services} dates={dates} timeZone={shop.timezone} cancellationWindowHours={shop.cancellationWindowHours} />
    </main>
  );
}
