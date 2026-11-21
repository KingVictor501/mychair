// app/api/pros/route.ts
// WHAT IT'S FOR: GET /api/pros?shopId=... lists the pros in a shop with their title, live
// status and starting price. shopId defaults to the logged-in user's own shop.
// WHO USES IT: the booking pages and the future mobile app.
// WHY THE NAME: folder path = URL (app/api/pros -> /api/pros).

import { getCurrentUser } from "@/lib/auth/current-user";
import { uuidOr404 } from "@/lib/auth/guards";
import { assertShopAccess, requireUser } from "@/lib/auth/permissions";
import { getShop, listPros } from "@/lib/booking/data";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const GET = withLogging("/api/pros", async (request) => {
  const user = requireUser(await getCurrentUser());
  const shopId = uuidOr404(new URL(request.url).searchParams.get("shopId") ?? user.shopId);
  const shop = await getShop(shopId);
  assertShopAccess(user, shop);
  return Response.json({ shop: { id: shop.id, name: shop.name }, pros: await listPros(shopId) });
});
