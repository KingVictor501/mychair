// app/api/appointments/mine/route.ts
// WHAT IT'S FOR: GET /api/appointments/mine lists the logged-in client's own appointments,
// upcoming first, with whether each can still be cancelled.
// WHO USES IT: the "My appointments" page and the future mobile app.
// WHY THE NAME: folder path = URL (/api/appointments/mine).

import { getCurrentUser } from "@/lib/auth/current-user";
import { assertShopAccess, requireRole } from "@/lib/auth/permissions";
import { getShop, listClientAppointments } from "@/lib/booking/data";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const GET = withLogging("/api/appointments/mine", async () => {
  const user = requireRole(await getCurrentUser(), "client");
  const shop = user.shopId ? await getShop(user.shopId) : null;
  assertShopAccess(user, shop);
  return Response.json({ appointments: await listClientAppointments(user.id, shop) });
});
