// lib/auth/admin-access.ts
// WHAT IT'S FOR: who may use the Super Admin tools (the /admin pages, demo controls, metrics,
// "view as"):
//   canUseAdmin      re-exported from lib/auth/access-rules.ts (the tested rule)
//   requireAdmin     the first line of an admin route: the admin key (for scripts and curl) OR a
//                    real Super Admin's login. Says which one it was, for the log.
//   requireAdminUser the same, but a login only (for actions that must name the Super Admin)
// WHO USES IT: app/api/admin/*, app/admin/*, app/metrics.
// WHY THE NAME: access to the admin tools; ".ts" = no screen code.

import { ApiError } from "../api-error";
import { requireAdminKey } from "../admin-auth";
import type { CurrentUser } from "../types";
import { canUseAdmin } from "./access-rules";
import { getCurrentUser, getSessionClaims } from "./current-user";

export { canUseAdmin, canViewAs } from "./access-rules";

// For admin routes: the admin key in an "x-admin-key" header, or a real Super Admin's login.
// Stops with 401 (nobody logged in) or 403 (logged in, but not allowed).
export async function requireAdmin(request: Request): Promise<{ by: "admin_key" | "session"; userId: string | null }> {
  if (request.headers.get("x-admin-key")) {
    requireAdminKey(request);
    return { by: "admin_key", userId: null };
  }
  return { by: "session", userId: (await requireAdminUser()).id };
}

// For admin actions that must name the Super Admin (like "view as"): a login only, no key.
export async function requireAdminUser(): Promise<CurrentUser> {
  const [user, claims] = await Promise.all([getCurrentUser(), getSessionClaims()]);
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "Please log in.");
  if (!canUseAdmin(user, claims)) throw new ApiError(403, "FORBIDDEN", "You don't have access to that.");
  return user;
}
