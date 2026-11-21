// app/api/appointments/route.ts
// WHAT IT'S FOR: POST /api/appointments with { proId, serviceId, startsAt } books an appointment
// for the logged-in client. The server re-checks that the time is open (and the database refuses
// any overlap), uses the pro's real price, and only allows pros in the client's own shop.
// WHO USES IT: the booking form and the future mobile app.
// WHY THE NAME: folder path = URL (app/api/appointments -> /api/appointments).
//
// PRIVACY: logs appointment_booked with IDs only.

import { z } from "zod";
import { ApiError } from "@/lib/api-error";
import { getCurrentUser } from "@/lib/auth/current-user";
import { loadProFor } from "@/lib/auth/guards";
import { requireRole } from "@/lib/auth/permissions";
import { createAppointment } from "@/lib/booking/data";
import { log } from "@/lib/logger";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

const body = z.object({
  proId: z.string().uuid(),
  serviceId: z.string().uuid(),
  startsAt: z.string().datetime(),
});

export const POST = withLogging("/api/appointments", async (request) => {
  const user = requireRole(await getCurrentUser(), "client");
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, "BAD_INPUT", "Pick a pro, a service and a time.");
  const { pro, shop } = await loadProFor(user, parsed.data.proId);
  const appointment = await createAppointment({ shop, proId: pro.id, priceMode: pro.priceMode, clientId: user.id, serviceId: parsed.data.serviceId, startsAt: new Date(parsed.data.startsAt) });
  log.info("appointment_booked", { appointmentId: appointment.id, shopId: shop.id, proId: pro.id, userId: user.id });
  return Response.json({ appointment }, { status: 201 });
});
