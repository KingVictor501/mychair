// app/api/pro/status/route.ts
// WHAT IT'S FOR: PATCH /api/pro/status with { liveStatus } sets the logged-in pro's own live
// status: available, with_client or unavailable. Clients see it on the pros list.
// WHO USES IT: the status buttons on /pro.
// WHY THE NAME: folder path = URL (/api/pro/status).

import { z } from "zod";
import { ApiError } from "@/lib/api-error";
import { requirePro } from "@/lib/auth/pro-context";
import { log } from "@/lib/logger";
import { setLiveStatus } from "@/lib/pro/data";
import { LIVE_STATUSES } from "@/lib/pro/lifecycle";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

const body = z.object({ liveStatus: z.enum(LIVE_STATUSES) }).strict();

export const PATCH = withLogging("/api/pro/status", async (request) => {
  const { user, shop } = await requirePro();
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, "BAD_STATUS", "Pick Available, With a client or Unavailable.");
  await setLiveStatus(user.id, parsed.data.liveStatus);
  log.info("live_status_changed", { userId: user.id, shopId: shop.id, liveStatus: parsed.data.liveStatus });
  return Response.json({ liveStatus: parsed.data.liveStatus });
});
