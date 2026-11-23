// app/api/guest/shops/route.ts
// WHAT IT'S FOR: the predictive shop search. GET /api/guest/shops?q=fade returns up to 6 shops
// whose names are closest to what was typed, closest first: { shops: [{ slug, name, businessType }] }.
// With no "q", the first shops A to Z. Public (no login), and only shops a guest may book at
// (demo shops only while demo mode is on).
// WHO USES IT: components/ShopPicker.tsx on /guest, and the future mobile app.
// WHY THE NAME: folder path = URL (/api/guest/shops).
//
// RATE LIMIT: 300 searches per 10 minutes per IP (429).
// PRIVACY: nothing is logged about what was typed, only its length and the result count.

import { ApiError } from "@/lib/api-error";
import { searchGuestShops } from "@/lib/guest/booking";
import { log } from "@/lib/logger";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const GET = withLogging("/api/guest/shops", async (request) => {
  await enforceRateLimit("shop_search_ip", clientIp(request.headers));
  const typed = (new URL(request.url).searchParams.get("q") ?? "").trim();
  // A shop name is never this long, so anything longer is a mistake or abuse.
  if (typed.length > 80) throw new ApiError(400, "BAD_SEARCH", "Type a shorter shop name.");
  const shops = await searchGuestShops(typed);
  log.debug("guest_shop_search", { queryLength: typed.length, results: shops.length });
  return Response.json({ shops });
});
