// app/api/pro/clients/[clientId]/route.ts
// WHAT IT'S FOR: GET /api/pro/clients/<id> returns one of the pro's own clients: first name,
// phone, no-show strikes, this pro's style card and the visit history with this pro.
// Someone else's client answers 404.
// WHO USES IT: /pro/clients/<id> and the future mobile app.
// WHY THE NAME: folder path = URL; "[clientId]" is the client's ID from the URL.

import { uuidOr404 } from "@/lib/auth/guards";
import { requirePro } from "@/lib/auth/pro-context";
import { getClientForPro } from "@/lib/pro/data";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const GET = withLogging<{ params: Promise<{ clientId: string }> }>("/api/pro/clients/[clientId]", async (_request, { params }) => {
  const { user, shop } = await requirePro();
  const clientId = uuidOr404((await params).clientId);
  return Response.json(await getClientForPro(user.id, shop, clientId));
});
