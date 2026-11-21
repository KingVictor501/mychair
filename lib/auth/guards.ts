// lib/auth/guards.ts
// WHAT IT'S FOR: short helpers that routes use at the top to load what they're allowed to see:
//   uuidOr404     a malformed ID in a URL is treated as "not found" (never a server error)
//   loadProFor    the pro and their shop, but only if the logged-in user may access that shop
// They combine lib/auth/current-user.ts and lib/auth/permissions.ts so every route checks the
// same way.
// WHO USES IT: app/api/pros/* and app/api/appointments/*.
// WHY THE NAME: route "guards"; ".ts" = no screen code.

import { z } from "zod";
import { ApiError } from "../api-error";
import { getPro, getShop } from "../booking/data";
import type { CurrentUser } from "../types";
import { assertShopAccess } from "./permissions";

const uuid = z.string().uuid();

// Returns the ID if it's a valid UUID; otherwise stops the request with 404.
export function uuidOr404(value: string | null | undefined): string {
  const parsed = uuid.safeParse(value);
  if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "Not found.");
  return parsed.data;
}

// Loads a pro and their shop for a user who may access that shop; otherwise 404.
export async function loadProFor(user: CurrentUser, proId: string) {
  const pro = await getPro(uuidOr404(proId));
  const shop = pro?.shopId ? await getShop(pro.shopId) : null;
  assertShopAccess(user, shop);
  return { pro: pro!, shop: shop! };
}
