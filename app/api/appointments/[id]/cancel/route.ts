// app/api/appointments/[id]/cancel/route.ts
// WHAT IT'S FOR: POST /api/appointments/<id>/cancel lets a client cancel their OWN appointment,
// up to the shop's cancellation window. Someone else's appointment answers 404.
// WHO USES IT: the "My appointments" page and the future mobile app.
// WHY THE NAME: folder path = URL (/api/appointments/<id>/cancel).
//
// PRIVACY: logs appointment_cancelled with IDs only.

import { getCurrentUser } from "@/lib/auth/current-user";
import { uuidOr404 } from "@/lib/auth/guards";
import { assertShopAccess, requireRole } from "@/lib/auth/permissions";
import { cancelAppointment, getShop } from "@/lib/booking/data";
import { log } from "@/lib/logger";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const POST = withLogging<{ params: Promise<{ id: string }> }>("/api/appointments/[id]/cancel", async (_request, { params }) => {
  const user = requireRole(await getCurrentUser(), "client");
  const shop = user.shopId ? await getShop(user.shopId) : null;
  assertShopAccess(user, shop);
  const id = uuidOr404((await params).id);
  const result = await cancelAppointment(id, user.id, shop);
  log.info("appointment_cancelled", { appointmentId: id, shopId: shop.id, userId: user.id, by: "client" });
  return Response.json({ appointment: result });
});
