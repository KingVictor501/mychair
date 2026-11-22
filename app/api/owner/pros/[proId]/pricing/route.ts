// app/api/owner/pros/[proId]/pricing/route.ts
// WHAT IT'S FOR: PUT /api/owner/pros/<pro ID>/pricing with { priceMode, prices: [{ serviceId,
// priceCents }] } lets the shop's owner switch a pro between "Standard price" and custom prices,
// and set the custom prices (null = use the standard price). The input is checked
// (lib/owner/rules.ts pricingInput). A pro from another shop, or a made-up ID, is 404. Pros can
// never change prices.
// WHO USES IT: the pricing editor on /owner/pros/<pro ID>.
// WHY THE NAME: folder path = URL.
//
// PRIVACY: logs pro_pricing_changed with IDs and counts only.

import { ApiError } from "@/lib/api-error";
import { uuidOr404 } from "@/lib/auth/guards";
import { requireOwner } from "@/lib/auth/owner-context";
import { log } from "@/lib/logger";
import { setProPricing } from "@/lib/owner/data";
import { pricingInput } from "@/lib/owner/rules";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const PUT = withLogging<{ params: Promise<{ proId: string }> }>("/api/owner/pros/[proId]/pricing", async (request, { params }) => {
  const { user, shop } = await requireOwner();
  const proId = uuidOr404((await params).proId);
  const parsed = pricingInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, "BAD_PRICES", parsed.error.issues[0]?.message ?? "Check the prices.");
  const { changed } = await setProPricing(shop, proId, parsed.data);
  log.info("pro_pricing_changed", { userId: user.id, shopId: shop.id, proId, priceMode: parsed.data.priceMode, pricesChanged: changed });
  return Response.json({ ok: true });
});
