// app/api/pro/settings/route.ts
// WHAT IT'S FOR: PATCH /api/pro/settings with { allowOthersToBook } saves the logged-in pro's own
// settings. "allowOthersToBook" lets other pros in the shop book callers onto this pro's calendar.
// The input is checked (lib/pro/lifecycle.ts proSettingsInput); a pro can only change their own.
// WHO USES IT: the toggles on /pro/settings.
// WHY THE NAME: folder path = URL (/api/pro/settings).

import { ApiError } from "@/lib/api-error";
import { requirePro } from "@/lib/auth/pro-context";
import { log } from "@/lib/logger";
import { setProSettings } from "@/lib/pro/data";
import { proSettingsInput } from "@/lib/pro/lifecycle";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const PATCH = withLogging("/api/pro/settings", async (request) => {
  const { user, shop } = await requirePro();
  const parsed = proSettingsInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, "BAD_SETTINGS", "Check the settings and try again.");
  await setProSettings(user.id, parsed.data);
  log.info("pro_settings_changed", { userId: user.id, shopId: shop.id, allowOthersToBook: parsed.data.allowOthersToBook });
  return Response.json({ settings: parsed.data });
});
