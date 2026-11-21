// app/api/pros/[id]/slots/route.ts
// WHAT IT'S FOR: GET /api/pros/<id>/slots?date=YYYY-MM-DD&serviceId=<id> returns the open start
// times for that service with that pro on that day (lib/booking/slots.ts decides).
// WHO USES IT: the booking form and the future mobile app.
// WHY THE NAME: folder path = URL (/api/pros/<id>/slots).

import { ApiError } from "@/lib/api-error";
import { getCurrentUser } from "@/lib/auth/current-user";
import { loadProFor } from "@/lib/auth/guards";
import { requireUser } from "@/lib/auth/permissions";
import { getSlots, listProServices } from "@/lib/booking/data";
import { parseLocalDate } from "@/lib/booking/slots";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const GET = withLogging<{ params: Promise<{ id: string }> }>("/api/pros/[id]/slots", async (request, { params }) => {
  const user = requireUser(await getCurrentUser());
  const { pro, shop } = await loadProFor(user, (await params).id);
  const search = new URL(request.url).searchParams;
  const date = parseLocalDate(search.get("date") ?? "");
  if (!date) throw new ApiError(400, "BAD_DATE", "Pick a date.");
  const service = (await listProServices(pro.id, pro.priceMode, user.role === "client" ? user.id : undefined)).find((s) => s.id === search.get("serviceId"));
  if (!service) throw new ApiError(400, "BAD_SERVICE", "Pick a service this pro offers.");
  return Response.json({ slots: await getSlots(pro.id, shop, date, service.durationMin), durationMin: service.durationMin });
});
