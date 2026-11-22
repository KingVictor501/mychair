// app/api/admin/demo/route.ts
// WHAT IT'S FOR: managing the demo shops on the server it runs on (including production), with
// the admin key or a real Super Admin's login (lib/auth/admin-access.ts). POST /api/admin/demo
// with { action }:
//   "reset"     remove the demo shops and seed them fresh (same as npm run demo:reset)
//   "remove"    remove the demo shops (real data is never touched)
//   "mode_on"   turn demo mode on (demo logins and the /demo page work)
//   "mode_off"  turn demo mode off (demo logins stop working; the demo shops are kept)
// The demo login password comes from DEMO_PASSWORD on the server; it is never sent or returned.
// WHO USES IT: the demo controls on /admin (components/AdminDemoControls.tsx), and curl with the key.
// WHY THE NAME: folder path = URL (/api/admin/demo).
//
// PRIVACY: logs demo_reset / demo_removed / demo_mode_changed with counts and the Super Admin's
// user ID only ("admin_key" when the key was used).

import { z } from "zod";
import { ApiError } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth/admin-access";
import { setDemoMode } from "@/lib/demo/mode";
import { removeDemo, resetDemo } from "@/lib/demo/seed";
import { log } from "@/lib/logger";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";
// Seeding three months of appointments takes a while; allow up to a minute.
export const maxDuration = 60;

const body = z.object({ action: z.enum(["reset", "remove", "mode_on", "mode_off"]) }).strict();

export const POST = withLogging("/api/admin/demo", async (request) => {
  const admin = await requireAdmin(request);
  // Who did it, for the log: the Super Admin's ID, or "admin_key".
  const by = admin.userId ?? "admin_key";
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, "BAD_ACTION", "action must be reset, remove, mode_on or mode_off.");

  switch (parsed.data.action) {
    case "reset": {
      const password = process.env.DEMO_PASSWORD;
      if (!password || password.length < 8) throw new ApiError(503, "NOT_CONFIGURED", "DEMO_PASSWORD isn't set on this server.");
      const result = await resetDemo(password);
      log.info("demo_reset", { shops: result.shops, appointments: result.appointments, by, userId: admin.userId ?? undefined });
      return Response.json({ ok: true, shops: result.shops, appointments: result.appointments });
    }
    case "remove": {
      const result = await removeDemo();
      log.info("demo_removed", { ...result, by });
      return Response.json({ ok: true, ...result });
    }
    default: {
      const enabled = parsed.data.action === "mode_on";
      await setDemoMode(enabled, admin.userId);
      log.info("demo_mode_changed", { enabled, by, userId: admin.userId ?? undefined });
      return Response.json({ ok: true, demoMode: enabled });
    }
  }
});
