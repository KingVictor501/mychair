// app/api/admin/view-as/route.ts
// WHAT IT'S FOR: "view as". POST /api/admin/view-as with { userId } lets a real Super Admin see
// the app exactly as that owner or pro does, to help with support. The session switches to that
// person for up to an hour, marked with the Super Admin's ID, and a banner on every page offers
// "Stop viewing as". Starting is logged (view_as_started); stopping is logged too.
// WHO USES IT: the "View as" buttons on /admin.
// WHY THE NAME: folder path = URL.
//
// PRIVACY: logs IDs and the role only.

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";
import { ApiError } from "@/lib/api-error";
import { canViewAs, requireAdminUser } from "@/lib/auth/admin-access";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions, VIEW_AS_HOURS } from "@/lib/auth/session";
import { HOME_FOR_ROLE } from "@/lib/auth/home";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { isDemoModeOn } from "@/lib/demo/mode";
import { log } from "@/lib/logger";
import type { Role } from "@/lib/types";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

const body = z.object({ userId: z.string().uuid() }).strict();

export const POST = withLogging("/api/admin/view-as", async (request) => {
  const admin = await requireAdminUser();
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, "BAD_INPUT", "Pick someone to view as.");
  const [target] = await getDb()
    .select({ id: users.id, role: users.role, shopId: users.shopId, isDemo: users.isDemo })
    .from(users)
    .where(eq(users.id, parsed.data.userId));
  const role = target?.role as Role | undefined;
  if (!target || !role || !canViewAs({ role, isDemo: target.isDemo }, await isDemoModeOn())) throw new ApiError(404, "NOT_FOUND", "Not found.");

  const token = await createSessionToken({ userId: target.id, role, shopId: target.shopId, demo: target.isDemo, actorId: admin.id });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(VIEW_AS_HOURS * 60 * 60));
  log.info("view_as_started", { userId: admin.id, targetUserId: target.id, targetRole: role, shopId: target.shopId });
  return Response.json({ ok: true, home: HOME_FOR_ROLE[role] });
});
