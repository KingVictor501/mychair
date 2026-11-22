// lib/auth/access-rules.ts
// WHAT IT'S FOR: the yes/no rules for the Super Admin tools and the demo, with no database, so
// they're tested exactly (lib/auth/auth.test.ts):
//   canUseAdmin   a logged-in, REAL Super Admin acting as themselves: not the demo Super Admin,
//                 and not in the middle of "view as"
//   canViewAs     whom a Super Admin may view the app as: owners and pros only
//   canEnterDemo  whom a /demo visitor may enter as: a demo owner or pro, in a demo shop, while
//                 demo mode is on
// WHO USES IT: lib/auth/admin-access.ts, app/api/admin/view-as, app/api/demo/enter, app/admin/*.
// WHY THE NAME: access rules; ".ts" = no screen code.

import type { CurrentUser, Role } from "../types";
import type { SessionClaims } from "./session";

// True only for a real Super Admin acting as themselves. The demo Super Admin is boxed out, so
// a demo visitor can never flip demo mode, reset data or view as real people.
export function canUseAdmin(user: Pick<CurrentUser, "role" | "isDemo"> | null, claims: Pick<SessionClaims, "actorId"> | null): boolean {
  return Boolean(user && user.role === "super_admin" && !user.isDemo && claims && !claims.actorId);
}

// True if the Super Admin may view the app as this person: owners and pros, in any shop. A demo
// account only while demo mode is on (otherwise the demo account can't be used at all).
export function canViewAs(target: { role: Role; isDemo: boolean } | null, demoModeOn: boolean): boolean {
  if (!target || (target.role !== "owner" && target.role !== "pro")) return false;
  return !target.isDemo || demoModeOn;
}

// True if a /demo visitor may enter as this account.
export function canEnterDemo(target: { role: Role; isDemo: boolean } | null, shop: { isDemo: boolean } | null, demoModeOn: boolean): boolean {
  if (!demoModeOn || !target || !shop) return false;
  if (!target.isDemo || !shop.isDemo) return false;
  return target.role === "owner" || target.role === "pro";
}
