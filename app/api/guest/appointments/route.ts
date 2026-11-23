// app/api/guest/appointments/route.ts
// WHAT IT'S FOR: POST /api/guest/appointments with { proId, serviceIds, startsAt, name, phone }
// books an appointment without an account. Public (no login). The input is checked
// (lib/guest/booking.ts guestBookingInput), the shop must be one a guest may see, the time must
// be open, and the database refuses overlaps. The booking goes on the shop's client with that
// phone number, or on a new client (first name and phone).
// WHO USES IT: the booking form on /guest/<pro ID>.
// WHY THE NAME: folder path = URL.
//
// RATE LIMIT: 10 bookings an hour per IP, and 5 an hour per phone number (429).
//
// PRIVACY: logs appointment_booked with IDs only (never the name or phone). The reply never says
// whether the phone number already had a client record.

import { ApiError } from "@/lib/api-error";
import { createAppointment, pickServices } from "@/lib/booking/data";
import { findOrAddGuestClient, guestBookingInput, loadGuestPro } from "@/lib/guest/booking";
import { log } from "@/lib/logger";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const POST = withLogging("/api/guest/appointments", async (request) => {
  // Rate limits (lib/rate-limit.ts): no account is needed here, so cap by IP and by phone number,
  // so nobody can fill a pro's calendar with fake bookings.
  await enforceRateLimit("guest_booking_ip", clientIp(request.headers));
  const parsed = guestBookingInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, "BAD_INPUT", parsed.error.issues[0]?.message ?? "Check your booking and try again.");
  await enforceRateLimit("guest_booking_phone", parsed.data.phone);
  const { pro, shop } = await loadGuestPro(parsed.data.proId);
  // Check the services first, so a bad pick never adds a client record.
  await pickServices(pro.id, pro.priceMode, parsed.data.serviceIds);
  const clientId = await findOrAddGuestClient(shop, parsed.data.name, parsed.data.phone);
  const appointment = await createAppointment({ shop, proId: pro.id, priceMode: pro.priceMode, clientId, serviceIds: parsed.data.serviceIds, startsAt: new Date(parsed.data.startsAt) });
  log.info("appointment_booked", { appointmentId: appointment.id, shopId: shop.id, proId: pro.id, by: "guest" });
  // Only what the confirmation needs: not the client ID.
  return Response.json({ appointment: { id: appointment.id, startsAt: appointment.startsAt } }, { status: 201 });
});
