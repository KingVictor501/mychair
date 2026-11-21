// app/api/appointments/[id]/status/route.ts
// WHAT IT'S FOR: POST /api/appointments/<id>/status with { status, paymentStatus? } moves an
// appointment along: in_chair, completed (needs a payment status), no_show (adds a strike) or
// cancelled. Allowed for the appointment's own pro, an owner of that shop, or the Super Admin.
// The order of steps is enforced (lib/pro/lifecycle.ts).
// WHO USES IT: the pro schedule and the owner dashboard.
// WHY THE NAME: folder path = URL (/api/appointments/<id>/status).
//
// PRIVACY: logs appointment_status_changed with IDs and the new status only.

import { ApiError } from "@/lib/api-error";
import { getCurrentUser } from "@/lib/auth/current-user";
import { uuidOr404 } from "@/lib/auth/guards";
import { assertShopAccess, requireRole } from "@/lib/auth/permissions";
import { getShop } from "@/lib/booking/data";
import { log } from "@/lib/logger";
import { appointmentShopId, changeAppointmentStatus } from "@/lib/pro/data";
import { statusChangeInput } from "@/lib/pro/lifecycle";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const POST = withLogging<{ params: Promise<{ id: string }> }>("/api/appointments/[id]/status", async (request, { params }) => {
  const user = requireRole(await getCurrentUser(), "pro", "owner", "super_admin");
  const id = uuidOr404((await params).id);
  const parsed = statusChangeInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, "BAD_INPUT", parsed.error.issues[0]?.message ?? "Pick a status.");

  // The shop check first (this also keeps demo accounts inside demo shops), then the role and step rules.
  const shopId = await appointmentShopId(id);
  const shop = shopId ? await getShop(shopId) : null;
  assertShopAccess(user, shop);

  const row = await changeAppointmentStatus(user, id, parsed.data.status, parsed.data.paymentStatus);
  log.info("appointment_status_changed", { appointmentId: id, shopId: row.shopId, userId: user.id, status: row.status });
  return Response.json({ appointment: { id: row.id, status: row.status } });
});
