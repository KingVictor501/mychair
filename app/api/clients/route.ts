// app/api/clients/route.ts
// WHAT IT'S FOR: POST /api/clients with { name, phone } adds a new client to the logged-in pro's
// or owner's shop, for someone who calls in to book. The phone must not already belong to an
// account. The new client has no password, so they can't log in until they set one up.
// WHO USES IT: the "Add as a new client" form under Client search.
// WHY THE NAME: folder path = URL (/api/clients).
//
// PRIVACY: logs client_added with IDs only, never the name or phone.

import { ApiError } from "@/lib/api-error";
import { getCurrentUser } from "@/lib/auth/current-user";
import { assertShopAccess, requireRole } from "@/lib/auth/permissions";
import { getShop } from "@/lib/booking/data";
import { addClient, newClientInput } from "@/lib/clients/search";
import { log } from "@/lib/logger";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const POST = withLogging("/api/clients", async (request) => {
  const user = requireRole(await getCurrentUser(), "pro", "owner");
  const shop = user.shopId ? await getShop(user.shopId) : null;
  assertShopAccess(user, shop);
  const parsed = newClientInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, "BAD_INPUT", parsed.error.issues[0]?.message ?? "Enter a first name and phone number.");
  const client = await addClient(shop, parsed.data);
  log.info("client_added", { userId: user.id, shopId: shop.id, clientId: client.id });
  return Response.json({ client }, { status: 201 });
});
