// lib/auth/pro-context.ts
// WHAT IT'S FOR: the first lines of every pro route: "is this a logged-in pro, and which shop
// are they in?" Stops with 401 (not logged in), 403 (not a pro) or 404 (no shop access).
// "A pro" here includes an owner who also takes appointments (lib/auth/permissions.ts worksAsPro),
// so the owner's own schedule, clients and settings use the same routes as every other pro.
// WHO USES IT: app/api/pro/* routes and the /pro pages.
// WHY THE NAME: the pro's context; ".ts" = no screen code.

import { getShop, type ShopRow } from "../booking/data";
import type { CurrentUser } from "../types";
import { getCurrentUser } from "./current-user";
import { ApiError } from "../api-error";
import { assertShopAccess, requireUser, worksAsPro } from "./permissions";

export async function requirePro(): Promise<{ user: CurrentUser; shop: ShopRow }> {
  const user = requireUser(await getCurrentUser());
  if (!worksAsPro(user)) throw new ApiError(403, "FORBIDDEN", "You don't have access to that.");
  const shop = user.shopId ? await getShop(user.shopId) : null;
  assertShopAccess(user, shop);
  return { user, shop };
}
