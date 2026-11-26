// lib/clients/preferred.ts
// WHAT IT'S FOR: a client's preferred pro.
//   preferredProInput  what a "set my preferred pro" request may contain: a pro's ID, or null to clear it
//   getPreferredProId  the client's preferred pro's ID, or null
//   setPreferredPro    saves it, after checking the pro is a pro in the client's own shop
// A client is listed under a pro's "Your clients" only when that pro is their preferred pro
// (lib/pro/data.ts listMyClients).
// WHO USES IT: app/api/me/preferred-pro/route.ts and the client booking pages.
// Tested by lib/clients/clients.test.ts.
// WHY THE NAME: the preferred pro; ".ts" = no screen code.

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "../api-error";
import { getDb } from "../db/client";
import { TAKES_APPOINTMENTS } from "../booking/data";
import { clientProfiles, proProfiles, users } from "../db/schema";

export const preferredProInput = z.object({ proId: z.string().uuid().nullable() }).strict();

// The client's preferred pro's ID, or null if they haven't picked one.
export async function getPreferredProId(clientId: string): Promise<string | null> {
  const [row] = await getDb().select({ id: clientProfiles.preferredProId }).from(clientProfiles).where(eq(clientProfiles.userId, clientId));
  return row?.id ?? null;
}

// Saves (or clears, with null) the client's preferred pro. The pro must be a pro in the client's
// own shop; anything else answers 404, so IDs from other shops can't be probed.
export async function setPreferredPro(client: { id: string; shopId: string }, proId: string | null): Promise<void> {
  const db = getDb();
  if (proId) {
    // Anyone who takes appointments in the client's shop: a pro, or an owner with a pro profile.
    const [pro] = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(proProfiles, eq(proProfiles.userId, users.id))
      .where(and(eq(users.id, proId), TAKES_APPOINTMENTS, eq(users.shopId, client.shopId)));
    if (!pro) throw new ApiError(404, "NOT_FOUND", "Not found.");
  }
  // Every client has a profile row (made at sign up); this makes one if it's somehow missing.
  await db
    .insert(clientProfiles)
    .values({ userId: client.id, preferredProId: proId })
    .onConflictDoUpdate({ target: clientProfiles.userId, set: { preferredProId: proId } });
}
