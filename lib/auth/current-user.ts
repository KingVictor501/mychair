// lib/auth/current-user.ts
// WHAT IT'S FOR: "who is making this request?" Reads the session cookie, checks its signature
// (lib/auth/session.ts), then loads the user fresh from the database. Returns null when:
//   - there is no cookie, or it was tampered with or has expired,
//   - the account no longer exists (for example demo data was removed),
//   - it's a demo account and demo mode is switched off.
// WHO USES IT: every protected route and page, together with lib/auth/permissions.ts.
// WHY THE NAME: gets the "current user"; ".ts" = no screen code.

import { eq } from "drizzle-orm";
// cookies() (from Next.js) reads the cookies the browser sent with this request.
import { cookies } from "next/headers";
import { getDb } from "../db/client";
import { users } from "../db/schema";
import { isDemoModeOn } from "../demo/mode";
import type { CurrentUser, Role } from "../types";
import { readSessionToken, SESSION_COOKIE } from "./session";

// Returns the logged-in user, or null.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const claims = await readSessionToken(store.get(SESSION_COOKIE)?.value);
  if (!claims) return null;

  const [row] = await getDb()
    .select({ id: users.id, role: users.role, shopId: users.shopId, name: users.name, isDemo: users.isDemo })
    .from(users)
    .where(eq(users.id, claims.userId));
  if (!row) return null;

  // Demo accounts only work while demo mode is on.
  if (row.isDemo && !(await isDemoModeOn())) return null;

  return { id: row.id, role: row.role as Role, shopId: row.shopId, name: row.name, isDemo: row.isDemo };
}
