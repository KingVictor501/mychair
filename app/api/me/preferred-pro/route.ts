// app/api/me/preferred-pro/route.ts
// WHAT IT'S FOR: PUT /api/me/preferred-pro with { proId } sets the logged-in client's preferred
// pro; { proId: null } clears it. The pro must be in the client's own shop (404 otherwise).
// WHO USES IT: the "Make … my preferred pro" button on /book/<pro ID> (and the future mobile app).
// WHY THE NAME: folder path = URL; "me" = the logged-in user's own settings.
//
// PRIVACY: logs preferred_pro_changed with IDs only.

import { ApiError } from "@/lib/api-error";
import { getCurrentUser } from "@/lib/auth/current-user";
import { assertShopAccess, requireRole } from "@/lib/auth/permissions";
import { getShop } from "@/lib/booking/data";
import { preferredProInput, setPreferredPro } from "@/lib/clients/preferred";
import { log } from "@/lib/logger";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const PUT = withLogging("/api/me/preferred-pro", async (request) => {
  const user = requireRole(await getCurrentUser(), "client");
  const shop = user.shopId ? await getShop(user.shopId) : null;
  assertShopAccess(user, shop);
  const parsed = preferredProInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, "BAD_INPUT", "Pick a pro.");
  await setPreferredPro({ id: user.id, shopId: shop.id }, parsed.data.proId);
  log.info("preferred_pro_changed", { userId: user.id, shopId: shop.id, proId: parsed.data.proId });
  return Response.json({ preferredProId: parsed.data.proId });
});
