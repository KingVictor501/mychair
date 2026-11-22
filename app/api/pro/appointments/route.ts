// app/api/pro/appointments/route.ts
// WHAT IT'S FOR: POST /api/pro/appointments with { clientId, serviceIds, startsAt, proId? } lets
// the logged-in pro book a client who called in. With no proId (or their own), the booking is
// with themselves. With another pro's ID, that pro must be in the same shop and have turned on
// "Let other pros book for me" (lib/pro/lifecycle.ts canBookFor), or it answers 403. Same checks
// as a client booking: the client must be in the shop, the time must be open, the database
// refuses overlaps, and the chosen pro's real price is used.
// WHO USES IT: the "Book for a client" page (/pro/book/<client>).
// WHY THE NAME: folder path = URL (/api/pro/appointments).
//
// PRIVACY: logs appointment_booked with IDs only.

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/lib/api-error";
import { requirePro } from "@/lib/auth/pro-context";
import { createAppointment, getPro } from "@/lib/booking/data";
import { canBookFor } from "@/lib/pro/lifecycle";
import { MAX_SERVICES } from "@/lib/booking/slots";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { log } from "@/lib/logger";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

const body = z.object({ clientId: z.string().uuid(), serviceIds: z.array(z.string().uuid()).min(1).max(MAX_SERVICES), startsAt: z.string().datetime(), proId: z.string().uuid().optional() }).strict();

export const POST = withLogging("/api/pro/appointments", async (request) => {
  const { user, shop } = await requirePro();
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, "BAD_INPUT", "Pick a client, up to 4 services and a time.");

  // The client must be a client of this same shop.
  const [client] = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, parsed.data.clientId), eq(users.role, "client"), eq(users.shopId, shop.id)));
  if (!client) throw new ApiError(404, "NOT_FOUND", "Not found.");

  // Which pro's calendar: their own unless they picked another pro who allows it.
  const pro = await getPro(parsed.data.proId ?? user.id);
  if (!pro || pro.shopId !== shop.id) throw new ApiError(404, "NOT_FOUND", "Not found.");
  if (!canBookFor(user, pro)) throw new ApiError(403, "NOT_ALLOWED", `${pro.name} doesn't take bookings from other pros.`);
  const appointment = await createAppointment({ shop, proId: pro.id, priceMode: pro.priceMode, clientId: client.id, serviceIds: parsed.data.serviceIds, startsAt: new Date(parsed.data.startsAt) });
  log.info("appointment_booked", { appointmentId: appointment.id, shopId: shop.id, proId: pro.id, userId: user.id, by: pro.id === user.id ? "pro" : "other_pro" });
  return Response.json({ appointment }, { status: 201 });
});
