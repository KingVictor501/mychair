// lib/auth/permissions.ts
// WHAT IT'S FOR: the ONE shared permission helper every protected route uses, following
// docs/permissions.md. Plain functions with no database, so they're easy to test:
//   requireUser      not logged in -> 401
//   requireRole      wrong kind of account -> 403
//   assertShopAccess the user may only touch their own shop; the Super Admin may touch any shop;
//                    a DEMO account may only ever touch demo shops ("boxed in"), even a demo
//                    Super Admin. Wrong shop -> 404, so the route doesn't even confirm it exists.
// Hiding a button is not security: these run on the server for every request.
// WHO USES IT: every app/api route that reads or changes shop data. Tested by lib/auth/auth.test.ts.
// WHY THE NAME: the permission rules; ".ts" = no screen code.

import { ApiError } from "../api-error";
import type { CurrentUser, Role, ShopRef } from "../types";

// Stops the request with 401 unless someone is logged in.
export function requireUser(user: CurrentUser | null): CurrentUser {
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "Please log in.");
  return user;
}

// Stops the request with 403 unless the user has one of the allowed roles.
export function requireRole(user: CurrentUser | null, ...roles: Role[]): CurrentUser {
  const u = requireUser(user);
  if (!roles.includes(u.role)) throw new ApiError(403, "FORBIDDEN", "You don't have access to that.");
  return u;
}

// True if the user may see or change data in this shop.
export function canAccessShop(user: CurrentUser, shop: ShopRef): boolean {
  // Demo accounts never reach a real shop, whatever their role.
  if (user.isDemo && !shop.isDemo) return false;
  if (user.role === "super_admin") return true;
  return user.shopId === shop.id;
}

// Stops the request with 404 unless the user may access this shop.
export function assertShopAccess(user: CurrentUser, shop: ShopRef | null | undefined): asserts shop is ShopRef {
  if (!shop || !canAccessShop(user, shop)) throw new ApiError(404, "NOT_FOUND", "Not found.");
}

// True if a pro may see a client: only their own clients (someone they have an appointment or
// a style card with). Owners and the Super Admin may see every client in a shop they can access.
export function canSeeClient(user: CurrentUser, clientProIds: string[]): boolean {
  if (user.role === "owner" || user.role === "super_admin") return true;
  if (user.role === "pro") return clientProIds.includes(user.id);
  return false;
}
