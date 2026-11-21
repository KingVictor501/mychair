// app/api/pro/schedule/route.ts
// WHAT IT'S FOR: GET /api/pro/schedule?date=YYYY-MM-DD&days=1|7 returns the logged-in pro's
// OWN appointments for that day or week (client first name, service, time, status).
// WHO USES IT: the /pro page and the future mobile app.
// WHY THE NAME: folder path = URL (/api/pro/schedule).

import { ApiError } from "@/lib/api-error";
import { requirePro } from "@/lib/auth/pro-context";
import { parseLocalDate } from "@/lib/booking/slots";
import { localDateParts } from "@/lib/demo/time";
import { listSchedule } from "@/lib/pro/data";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const GET = withLogging("/api/pro/schedule", async (request) => {
  const { user, shop } = await requirePro();
  const search = new URL(request.url).searchParams;
  const dateText = search.get("date");
  const date = dateText ? parseLocalDate(dateText) : localDateParts(new Date(), shop.timezone);
  if (!date) throw new ApiError(400, "BAD_DATE", "Use a date like 2026-11-24.");
  const days = search.get("days") === "7" ? 7 : 1;
  return Response.json({ appointments: await listSchedule(user.id, shop, date, days), timezone: shop.timezone });
});
