// app/owner/pros/[proId]/page.tsx
// WHAT IT'S FOR: the owner's page for one pro, at /owner/pros/<pro ID>: set "Standard price" or
// custom prices per service. A pro from another shop, or a made-up ID, shows "not found".
// WHO USES IT: owners.
// WHY THE NAME: "[proId]" is the pro's ID from the URL.

import { notFound, redirect } from "next/navigation";
import { HOME_FOR_ROLE } from "@/lib/auth/home";
import ProPricingEditor from "@/components/ProPricingEditor";
import { ApiError } from "@/lib/api-error";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getShop } from "@/lib/booking/data";
import { getProPricing } from "@/lib/owner/data";
import Breadcrumbs from "@/components/Breadcrumbs";

export default async function OwnerProPage({ params }: { params: Promise<{ proId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "owner") redirect(HOME_FOR_ROLE[user.role]);
  const shop = user.shopId ? await getShop(user.shopId) : null;
  if (!shop) redirect("/login");

  const { proId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(proId)) notFound();
  let data: Awaited<ReturnType<typeof getProPricing>>;
  try {
    data = await getProPricing(shop, proId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <main className="!max-w-3xl">
      <Breadcrumbs items={[{ label: shop.name, href: "/owner" }, { label: `${data.pro.name}'s prices` }]} />
      <h1 className="!mt-2 !mb-1">{data.pro.name}&apos;s prices</h1>
      <p className="!mt-0">{data.pro.title}. Only you and the Super Admin can change prices.</p>
      <ProPricingEditor proId={data.pro.id} proName={data.pro.name} initialMode={data.pro.priceMode} services={data.services} />
    </main>
  );
}
