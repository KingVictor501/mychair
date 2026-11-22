// app/api/admin/super-admin/route.ts
// WHAT IT'S FOR: POST /api/admin/super-admin creates (or updates) the real Super Admin account on
// the server it runs on, including the live site, from SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD
// and SUPER_ADMIN_NAME in that server's settings (Vercel). Needs the admin key, because there's
// no Super Admin to log in as yet. Nothing is sent in the request, and the email and password are
// never returned or logged.
// WHO USES IT: me, once, with curl (the key read from .env.local). Same code as npm run admin:create.
// WHY THE NAME: folder path = URL.
//
// PRIVACY: logs super_admin_saved with the user ID only.

import { requireAdminKey } from "@/lib/admin-auth";
import { ApiError } from "@/lib/api-error";
import { ensureSuperAdmin, superAdminSettings } from "@/lib/auth/super-admin";
import { log } from "@/lib/logger";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const POST = withLogging("/api/admin/super-admin", async (request) => {
  requireAdminKey(request);
  const read = superAdminSettings(process.env);
  if (!read.ok) throw new ApiError(503, "NOT_CONFIGURED", read.reason);
  try {
    const result = await ensureSuperAdmin(read.settings);
    log.info("super_admin_saved", { userId: result.id, created: result.created });
    return Response.json({ ok: true, created: result.created });
  } catch (error) {
    throw new ApiError(409, "EMAIL_TAKEN", error instanceof Error ? error.message : "That email is taken.");
  }
});
