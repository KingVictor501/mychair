// app/api/auth/me/route.ts
// WHAT IT'S FOR: GET /api/auth/me returns who is logged in (or user: null). Never a password
// hash, email or phone.
// WHO USES IT: pages that need to know the role (and the future mobile app).
// WHY THE NAME: folder path = URL (app/api/auth/me -> /api/auth/me).

import { getCurrentUser } from "@/lib/auth/current-user";
import type { MeResponse } from "@/lib/types";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const GET = withLogging("/api/auth/me", async () => {
  const user = await getCurrentUser();
  const res: MeResponse = { user };
  return Response.json(res);
});
