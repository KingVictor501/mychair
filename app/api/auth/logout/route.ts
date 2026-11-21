// app/api/auth/logout/route.ts
// WHAT IT'S FOR: POST /api/auth/logout clears the session cookie. Safe to call when not logged in.
// WHO USES IT: the Log out button (components/LogoutButton.tsx).
// WHY THE NAME: folder path = URL (app/api/auth/logout -> /api/auth/logout).

import { cookies } from "next/headers";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const POST = withLogging("/api/auth/logout", async () => {
  // An empty value with maxAge 0 tells the browser to delete the cookie now.
  (await cookies()).set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return Response.json({ ok: true });
});
