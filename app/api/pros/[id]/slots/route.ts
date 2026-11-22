// app/api/pros/[id]/slots/route.ts
// WHAT IT'S FOR: GET /api/pros/<id>/slots?date=YYYY-MM-DD&serviceIds=<id>,<id> returns the open
// start times for those services, back to back, with that pro on that day (lib/booking/slots.ts decides).
// WHO USES IT: the booking form and the future mobile app.
// WHY THE NAME: folder path = URL (/api/pros/<id>/slots).

import { ApiError } from "@/lib/api-error";
import { getCurrentUser } from "@/lib/auth/current-user";
import { loadProFor } from "@/lib/auth/guards";
import { requireUser } from "@/lib/auth/permissions";
import { getSlots, pickServices } from "@/lib/booking/data";
import { parseLocalDate, parseServiceIds } from "@/lib/booking/slots";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const GET = withLogging<{ params: Promise<{ id: string }> }>("/api/pros/[id]/slots", async (request, { params }) => {
  const user = requireUser(await getCurrentUser());
  const { pro, shop } = await loadProFor(user, (await params).id);
  const search = new URL(request.url).searchParams;
  const date = parseLocalDate(search.get("date") ?? "");
  if (!date) throw new ApiError(400, "BAD_DATE", "Pick a date.");
  // The total length of the picked services (with a client's own time estimate).
  const picked = await pickServices(pro.id, pro.priceMode, parseServiceIds(search.get("serviceIds")), user.role === "client" ? user.id : undefined);
  return Response.json({ slots: await getSlots(pro.id, shop, date, picked.durationMin), durationMin: picked.durationMin });
});
