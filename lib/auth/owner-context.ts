// lib/auth/owner-context.ts
// WHAT IT'S FOR: the first lines of every owner route: "is this a logged-in owner, and which shop
// do they run?" Stops with 401 (not logged in), 403 (not an owner) or 404 (no shop access, which
// also keeps demo owners inside demo shops).
// WHO USES IT: app/api/owner/* routes and the /owner pages.
// WHY THE NAME: the owner's context; ".ts" = no screen code.

import { getShop, type ShopRow } from "../booking/data";
import type { CurrentUser } from "../types";
import { getCurrentUser } from "./current-user";
import { assertShopAccess, requireRole } from "./permissions";

export async function requireOwner(): Promise<{ user: CurrentUser; shop: ShopRow }> {
  const user = requireRole(await getCurrentUser(), "owner");
  const shop = user.shopId ? await getShop(user.shopId) : null;
  assertShopAccess(user, shop);
  return { user, shop };
}
