// lib/auth/pro-context.ts
// WHAT IT'S FOR: the first lines of every pro route: "is this a logged-in pro, and which shop
// are they in?" Stops with 401 (not logged in), 403 (not a pro) or 404 (no shop access).
// WHO USES IT: app/api/pro/* routes and the /pro pages.
// WHY THE NAME: the pro's context; ".ts" = no screen code.

import { getShop, type ShopRow } from "../booking/data";
import type { CurrentUser } from "../types";
import { getCurrentUser } from "./current-user";
import { assertShopAccess, requireRole } from "./permissions";

export async function requirePro(): Promise<{ user: CurrentUser; shop: ShopRow }> {
  const user = requireRole(await getCurrentUser(), "pro");
  const shop = user.shopId ? await getShop(user.shopId) : null;
  assertShopAccess(user, shop);
  return { user, shop };
}
