// app/pro/clients/[clientId]/page.tsx
// WHAT IT'S FOR: one of the pro's clients, at /pro/clients/<id>: first name, phone, no-show
// strikes, the style card editor, other pros' cards for the client (read-only, at any time),
// and visit history with this pro grouped by month. Another pro's client (or a
// made-up ID) shows the "not found" page.
// WHO USES IT: pros.
// WHY THE NAME: "[clientId]" is the client's ID from the URL.

import { notFound, redirect } from "next/navigation";
import { HOME_FOR_ROLE } from "@/lib/auth/home";
import StyleCardEditor from "@/components/StyleCardEditor";
import VisitHistory from "@/components/VisitHistory";
import { ApiError } from "@/lib/api-error";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getShop } from "@/lib/booking/data";
import { shopDateTime } from "@/lib/format";
import { photoStorageReady } from "@/lib/photos/data";
import { getClientForPro, type ClientDetail } from "@/lib/pro/data";
import Breadcrumbs from "@/components/Breadcrumbs";

export default async function ClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "pro") redirect(HOME_FOR_ROLE[user.role]);
  const shop = user.shopId ? await getShop(user.shopId) : null;
  if (!shop) redirect("/login");
  const { clientId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(clientId)) notFound();

  let detail: ClientDetail;
  try {
    detail = await getClientForPro(user.id, shop, clientId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const { client, card, visits, services, otherCards } = detail;

  return (
    <main className="!max-w-3xl">
      <Breadcrumbs items={[{ label: "My schedule", href: "/pro" }, { label: "My clients", href: "/pro/clients" }, { label: client.name }]} />
      <h1 className="!mt-2 !mb-1">{client.name}</h1>
      <p className="!mt-0">
        {client.phone ?? "No phone"}
        {client.noShows > 0 && ` · ${client.noShows} no-show${client.noShows === 1 ? "" : "s"}`}
      </p>

      <h2>Style card</h2>
      {card && <p className="!mt-0 text-sm">Last updated {shopDateTime(card.updatedAt, shop.timezone)}</p>}
      <StyleCardEditor clientId={client.id} clientName={client.name} photos={card?.photos ?? []} storageReady={photoStorageReady()} initial={card} services={services} />

      {otherCards.length > 0 && (
        <section aria-label="Style cards from other pros" className="mt-6">
          <h2>From other pros</h2>
          <p className="!mt-0 text-sm">
            Other pros&apos; cards for {client.name}. They&apos;re read-only.
          </p>
          <div className="grid gap-3">
            {otherCards.map((c) => (
              <article key={c.proName + c.updatedAt} className="rounded-lg border border-border bg-surface p-3">
                <h3 className="!m-0 text-base font-semibold text-text">{c.proName}&apos;s card</h3>
                <p className="!mt-0 text-xs">Updated {shopDateTime(c.updatedAt, shop.timezone)}</p>
                {Object.keys(c.preferences).length > 0 && (
                  <dl className="!my-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    {Object.entries(c.preferences).map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="font-semibold text-text">{k}</dt>
                        <dd className="m-0">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {c.usualServiceName && (
                  <p className="!my-1 text-sm">
                    Usual: {c.usualServiceName}
                    {c.timeEstimateMin ? ` · about ${c.timeEstimateMin} min` : ""}
                  </p>
                )}
                {c.notes && <p className="!my-1 text-sm">{c.notes}</p>}
                {c.photos.length > 0 && (
                  <ul className="!m-0 !mt-2 !list-none !p-0 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {c.photos.map((p, i) => (
                      <li key={p.id}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/photos/${p.id}`} alt={p.caption ? `${client.name}: ${p.caption}` : `Photo ${i + 1} on ${c.proName}'s card for ${client.name}`} loading="lazy" className="aspect-square w-full rounded object-cover" />
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      <h2>Visit history</h2>
      <VisitHistory visits={visits} timeZone={shop.timezone} />
    </main>
  );
}
