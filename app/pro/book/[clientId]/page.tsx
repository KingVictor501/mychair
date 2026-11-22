// app/pro/book/[clientId]/page.tsx
// WHAT IT'S FOR: "Book for a client", at /pro/book/<client ID>: a pro books a client who called in,
// using the same booking steps clients use. Reached from Client search. The pro books with
// themselves, or with another pro in the shop who turned on "Let other pros book for me"
// (chosen with ?pro=<ID>). A client from another shop, or a made-up ID, shows the "not found" page.
// WHO USES IT: pros.
// WHY THE NAME: "[clientId]" is the client's ID from the URL.

import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import BookingForm from "@/components/BookingForm";
import { HOME_FOR_ROLE } from "@/lib/auth/home";
import { getCurrentUser } from "@/lib/auth/current-user";
import { bookableDates, bookablePros, getPro, getShop, listProServices } from "@/lib/booking/data";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import Breadcrumbs from "@/components/Breadcrumbs";
import ShopBanner from "@/components/ShopBanner";

export default async function BookForClientPage({ params, searchParams }: { params: Promise<{ clientId: string }>; searchParams: Promise<{ pro?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "pro") redirect(HOME_FOR_ROLE[user.role]);
  const shop = user.shopId ? await getShop(user.shopId) : null;
  if (!shop) redirect("/login");

  const { clientId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(clientId)) notFound();
  // Only a client of this pro's own shop.
  const [client] = await getDb()
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.id, clientId), eq(users.role, "client"), eq(users.shopId, shop.id)));
  if (!client) notFound();

  // Who this pro may book with: themselves, plus pros who allow it. A ?pro= that isn't on that
  // list falls back to themselves (the server checks again when booking).
  const choices = await bookablePros(user.id, shop.id);
  const { pro: wanted } = await searchParams;
  const chosenId = choices.some((c) => c.id === wanted) ? wanted! : user.id;
  const pro = await getPro(chosenId);
  if (!pro) redirect("/login");

  const services = await listProServices(pro.id, pro.priceMode, client.id);
  const dates = bookableDates(shop).map((d) => `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`);

  return (
    <main>
      <Breadcrumbs items={[{ label: "My schedule", href: "/pro" }, { label: "My clients", href: "/pro/clients" }, { label: `Book ${client.name}` }]} />
      <ShopBanner businessType={shop.businessType} title={`Book ${client.name}`} subtitle={`With ${pro.id === user.id ? "you" : pro.name} at ${shop.name}`} />
      {choices.length > 1 && (
        <nav aria-label="Book with" className="mb-4 flex flex-wrap gap-2">
          {choices.map((c) => (
            <Link
              key={c.id}
              href={c.id === user.id ? `/pro/book/${client.id}` : `/pro/book/${client.id}?pro=${c.id}`}
              aria-current={c.id === pro.id ? "page" : undefined}
              className={`rounded border border-border px-3 py-1 !no-underline ${c.id === pro.id ? "!bg-text !text-bg" : ""}`}
            >
              {c.id === user.id ? "Me" : c.name}
            </Link>
          ))}
        </nav>
      )}
      {/* "key" makes the form start fresh when a different pro is picked. */}
      <BookingForm key={pro.id} proId={pro.id} services={services} dates={dates} timeZone={shop.timezone} cancellationWindowHours={shop.cancellationWindowHours} bookFor={{ clientId: client.id, clientName: client.name }} />
    </main>
  );
}
