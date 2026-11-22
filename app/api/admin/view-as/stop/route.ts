// app/api/admin/view-as/stop/route.ts
// WHAT IT'S FOR: POST /api/admin/view-as/stop ends "view as" and switches the session back to
// the Super Admin who started it. The Super Admin's account is re-checked first (it must still
// be a real Super Admin). Logged as view_as_ended.
// WHO USES IT: the "Stop viewing as" button in the banner (components/SessionBanner.tsx).
// WHY THE NAME: folder path = URL.
//
// PRIVACY: logs IDs only.

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { ApiError } from "@/lib/api-error";
import { getSessionClaims } from "@/lib/auth/current-user";
import { createSessionToken, SESSION_COOKIE, SESSION_DAYS, sessionCookieOptions } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { log } from "@/lib/logger";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const POST = withLogging("/api/admin/view-as/stop", async () => {
  const claims = await getSessionClaims();
  if (!claims?.actorId) throw new ApiError(400, "NOT_VIEWING_AS", "You aren't viewing as anyone.");
  const [actor] = await getDb().select({ id: users.id, role: users.role, isDemo: users.isDemo }).from(users).where(eq(users.id, claims.actorId));
  const store = await cookies();
  if (!actor || actor.role !== "super_admin" || actor.isDemo) {
    // The Super Admin account is gone or changed: log out completely instead.
    store.set(SESSION_COOKIE, "", sessionCookieOptions(0));
    throw new ApiError(403, "FORBIDDEN", "Please log in again.");
  }
  const token = await createSessionToken({ userId: actor.id, role: "super_admin", shopId: null, demo: false });
  store.set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_DAYS * 24 * 60 * 60));
  log.info("view_as_ended", { userId: actor.id, targetUserId: claims.userId });
  return Response.json({ ok: true, home: "/admin" });
});
