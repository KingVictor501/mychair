// app/api/pro/clients/route.ts
// WHAT IT'S FOR: GET /api/pro/clients lists the logged-in pro's OWN clients (people they have an
// appointment or style card with): first name, phone, visit count, last visit, no-show strikes.
// Never email, never another pro's clients.
// WHO USES IT: /pro/clients and the future mobile app.
// WHY THE NAME: folder path = URL (/api/pro/clients).

import { requirePro } from "@/lib/auth/pro-context";
import { listMyClients } from "@/lib/pro/data";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const GET = withLogging("/api/pro/clients", async () => {
  const { user } = await requirePro();
  return Response.json({ clients: await listMyClients(user.id) });
});
