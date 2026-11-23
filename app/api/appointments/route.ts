// app/api/appointments/route.ts
// WHAT IT'S FOR: POST /api/appointments with { proId, serviceIds, startsAt } books one appointment
// (one or more services, back to back) for the logged-in client. The server re-checks that the time is open (and the database refuses
// any overlap), uses the pro's real price, and only allows pros in the client's own shop.
// WHO USES IT: the booking form and the future mobile app.
// WHY THE NAME: folder path = URL (app/api/appointments -> /api/appointments).
//
// RATE LIMIT: 20 bookings an hour per account (429).
//
// PRIVACY: logs appointment_booked with IDs only.

import { z } from "zod";
import { ApiError } from "@/lib/api-error";
import { getCurrentUser } from "@/lib/auth/current-user";
import { loadProFor } from "@/lib/auth/guards";
import { requireRole } from "@/lib/auth/permissions";
import { createAppointment } from "@/lib/booking/data";
import { MAX_SERVICES } from "@/lib/booking/slots";
import { log } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/rate-limit";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

const body = z.object({
  proId: z.string().uuid(),
  serviceIds: z.array(z.string().uuid()).min(1).max(MAX_SERVICES),
  startsAt: z.string().datetime(),
});

export const POST = withLogging("/api/appointments", async (request) => {
  const user = requireRole(await getCurrentUser(), "client");
  // Rate limit per account (lib/rate-limit.ts).
  await enforceRateLimit("client_booking_user", user.id);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, "BAD_INPUT", "Pick a pro, up to 4 services and a time.");
  const { pro, shop } = await loadProFor(user, parsed.data.proId);
  const appointment = await createAppointment({ shop, proId: pro.id, priceMode: pro.priceMode, clientId: user.id, serviceIds: parsed.data.serviceIds, startsAt: new Date(parsed.data.startsAt) });
  log.info("appointment_booked", { appointmentId: appointment.id, shopId: shop.id, proId: pro.id, userId: user.id });
  return Response.json({ appointment }, { status: 201 });
});
