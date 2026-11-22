// app/api/demo/enter/route.ts
// WHAT IT'S FOR: the /demo page's one-click buttons. POST /api/demo/enter with { userId } logs
// the visitor in as that DEMO owner or pro, with no sign-up or password, while demo mode is on.
// Only demo accounts in demo shops can be entered this way; a real account, a client, the demo
// Super Admin, or anything while demo mode is off is 404. Demo sessions stay boxed inside the
// demo shops (lib/auth/permissions.ts), and every page shows a "Demo" banner.
// WHO USES IT: app/demo/page.tsx (components/DemoEnterButton.tsx).
// WHY THE NAME: folder path = URL.
//
// PRIVACY: logs demo_entered with IDs and the role only.

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";
import { ApiError } from "@/lib/api-error";
import { HOME_FOR_ROLE } from "@/lib/auth/home";
import { createSessionToken, SESSION_COOKIE, SESSION_DAYS, sessionCookieOptions } from "@/lib/auth/session";
import { getShop } from "@/lib/booking/data";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { canEnterDemo } from "@/lib/auth/access-rules";
import { isDemoModeOn } from "@/lib/demo/mode";
import { log } from "@/lib/logger";
import type { Role } from "@/lib/types";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

const body = z.object({ userId: z.string().uuid() }).strict();

export const POST = withLogging("/api/demo/enter", async (request) => {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, "BAD_INPUT", "Pick a demo view.");
  const [target] = await getDb()
    .select({ id: users.id, role: users.role, shopId: users.shopId, isDemo: users.isDemo })
    .from(users)
    .where(eq(users.id, parsed.data.userId));
  const shop = target?.shopId ? await getShop(target.shopId) : null;
  const role = target?.role as Role | undefined;
  if (!target || !role || !canEnterDemo({ role, isDemo: target.isDemo }, shop, await isDemoModeOn())) throw new ApiError(404, "NOT_FOUND", "Not found.");

  const token = await createSessionToken({ userId: target.id, role, shopId: target.shopId, demo: true });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_DAYS * 24 * 60 * 60));
  log.info("demo_entered", { targetUserId: target.id, role, shopId: target.shopId });
  return Response.json({ ok: true, home: HOME_FOR_ROLE[role] });
});
