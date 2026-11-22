// app/api/guest/pros/[id]/slots/route.ts
// WHAT IT'S FOR: GET /api/guest/pros/<pro ID>/slots?date=YYYY-MM-DD&serviceIds=<ID>,<ID> lists a
// pro's open times for those services, back to back, for someone booking without an account. Public (no login), but only for shops a
// guest may see (lib/guest/booking.ts guestCanSeeShop). Shows open times only, never who booked.
// WHO USES IT: the booking form on /guest/<pro ID>.
// WHY THE NAME: folder path = URL.

import { ApiError } from "@/lib/api-error";
import { getSlots, pickServices } from "@/lib/booking/data";
import { parseLocalDate, parseServiceIds } from "@/lib/booking/slots";
import { loadGuestPro } from "@/lib/guest/booking";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const GET = withLogging<{ params: Promise<{ id: string }> }>("/api/guest/pros/[id]/slots", async (request, { params }) => {
  const { pro, shop } = await loadGuestPro((await params).id);
  const search = new URL(request.url).searchParams;
  const date = parseLocalDate(search.get("date") ?? "");
  if (!date) throw new ApiError(400, "BAD_DATE", "Pick a date.");
  const picked = await pickServices(pro.id, pro.priceMode, parseServiceIds(search.get("serviceIds")));
  return Response.json({ slots: await getSlots(pro.id, shop, date, picked.durationMin), durationMin: picked.durationMin });
});
