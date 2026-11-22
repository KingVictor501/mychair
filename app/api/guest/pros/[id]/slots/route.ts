// app/api/guest/pros/[id]/slots/route.ts
// WHAT IT'S FOR: GET /api/guest/pros/<pro ID>/slots?date=YYYY-MM-DD&serviceId=<ID> lists a pro's
// open times for someone booking without an account. Public (no login), but only for shops a
// guest may see (lib/guest/booking.ts guestCanSeeShop). Shows open times only, never who booked.
// WHO USES IT: the booking form on /guest/<pro ID>.
// WHY THE NAME: folder path = URL.

import { ApiError } from "@/lib/api-error";
import { getSlots, listProServices } from "@/lib/booking/data";
import { parseLocalDate } from "@/lib/booking/slots";
import { loadGuestPro } from "@/lib/guest/booking";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const GET = withLogging<{ params: Promise<{ id: string }> }>("/api/guest/pros/[id]/slots", async (request, { params }) => {
  const { pro, shop } = await loadGuestPro((await params).id);
  const search = new URL(request.url).searchParams;
  const date = parseLocalDate(search.get("date") ?? "");
  if (!date) throw new ApiError(400, "BAD_DATE", "Pick a date.");
  const service = (await listProServices(pro.id, pro.priceMode)).find((s) => s.id === search.get("serviceId"));
  if (!service) throw new ApiError(400, "BAD_SERVICE", "Pick a service this pro offers.");
  return Response.json({ slots: await getSlots(pro.id, shop, date, service.durationMin), durationMin: service.durationMin });
});
