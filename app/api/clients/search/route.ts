// app/api/clients/search/route.ts
// WHAT IT'S FOR: client search. GET /api/clients/search?q=...
//   - a pro: q must be the client's full phone number; searches the pro's own shop
//   - an owner: any part of a name or phone, in their shop
//   - the Super Admin: any part of a name or phone, in every shop (a demo Super Admin: demo shops only)
// Clients can't search.
// WHO USES IT: the Client search box (pros, owners, Super Admin) and the future mobile app.
// WHY THE NAME: folder path = URL (/api/clients/search).
//
// RATE LIMIT: 60 searches per 10 minutes per account (429).
//
// PRIVACY: logs client_search with the role and result count only, never the search text.

import { eq } from "drizzle-orm";
import { ApiError } from "@/lib/api-error";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requireRole } from "@/lib/auth/permissions";
import { parseClientSearch, searchClients } from "@/lib/clients/search";
import { getDb } from "@/lib/db/client";
import { shops } from "@/lib/db/schema";
import { log } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/rate-limit";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const GET = withLogging("/api/clients/search", async (request) => {
  const user = requireRole(await getCurrentUser(), "pro", "owner", "super_admin");
  // Rate limit per account (lib/rate-limit.ts), so nobody can walk through every phone number.
  await enforceRateLimit("client_search_user", user.id);
  const parsed = parseClientSearch(user.role, new URL(request.url).searchParams.get("q") ?? "");
  if (!parsed.ok) throw new ApiError(400, "BAD_SEARCH", parsed.reason);

  // Which shops this user may search.
  let shopIds: string[];
  if (user.role === "super_admin") {
    const rows = user.isDemo ? await getDb().select({ id: shops.id }).from(shops).where(eq(shops.isDemo, true)) : await getDb().select({ id: shops.id }).from(shops);
    shopIds = rows.map((r) => r.id);
  } else {
    shopIds = user.shopId ? [user.shopId] : [];
  }

  const results = await searchClients(user, parsed.search, shopIds);
  log.info("client_search", { userId: user.id, role: user.role, kind: parsed.search.kind, results: results.length });
  return Response.json({ clients: results });
});
