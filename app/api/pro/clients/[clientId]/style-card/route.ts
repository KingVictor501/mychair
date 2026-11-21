// app/api/pro/clients/[clientId]/style-card/route.ts
// WHAT IT'S FOR: PUT /api/pro/clients/<id>/style-card saves the logged-in pro's style card for
// one of their own clients: preferences, notes, usual service and time estimate. The input is
// checked (lib/pro/lifecycle.ts styleCardInput). Someone else's client answers 404.
// WHO USES IT: the style card editor on /pro/clients/<id>.
// WHY THE NAME: folder path = URL (/api/pro/clients/<id>/style-card).
//
// PRIVACY: logs style_card_saved with IDs only, never the notes or preferences.

import { ApiError } from "@/lib/api-error";
import { uuidOr404 } from "@/lib/auth/guards";
import { requirePro } from "@/lib/auth/pro-context";
import { log } from "@/lib/logger";
import { saveStyleCard } from "@/lib/pro/data";
import { styleCardInput } from "@/lib/pro/lifecycle";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const PUT = withLogging<{ params: Promise<{ clientId: string }> }>("/api/pro/clients/[clientId]/style-card", async (request, { params }) => {
  const { user, shop } = await requirePro();
  const clientId = uuidOr404((await params).clientId);
  const parsed = styleCardInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, "BAD_CARD", parsed.error.issues[0]?.message ?? "Check the style card fields.");
  await saveStyleCard(user.id, shop.id, clientId, parsed.data);
  log.info("style_card_saved", { userId: user.id, shopId: shop.id, clientId });
  return Response.json({ ok: true });
});
