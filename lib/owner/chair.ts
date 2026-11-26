// lib/owner/chair.ts
// WHAT IT'S FOR: the database side of an owner working as a pro.
//   startChair  "Take appointments myself": gives the owner a pro profile (the same record every
//               pro has), every active shop service at the standard price, and starting hours
//               copied from a teammate. After this the owner shows up on the booking pages and the
//               team list, and can open /pro (their own schedule, clients and settings).
//   stopChair   "Stop taking appointments": removes that profile, the services and the hours.
//               Refused while the owner still has upcoming appointments, so no client is left
//               booked with someone who no longer takes bookings.
// Both stay inside the owner's own shop: the route passes the shop from requireOwner().
// WHO USES IT: app/api/owner/chair/route.ts.
// WHY THE NAME: the owner's chair; ".ts" = no screen code.

import { and, asc, count, eq, gt, inArray } from "drizzle-orm";
import { ApiError } from "../api-error";
import type { ShopRow } from "../booking/data";
import { getDb } from "../db/client";
import { appointments, availabilityRules, proProfiles, proServices, services, users } from "../db/schema";
import { startingHours } from "./rules";

// Starts the owner's chair. Safe to run twice: the second time changes nothing.
export async function startChair(shop: ShopRow, ownerId: string, title: string): Promise<{ created: boolean }> {
  const db = getDb();
  const inserted = await db
    .insert(proProfiles)
    .values({ userId: ownerId, title, priceMode: "standard", liveStatus: "available" })
    .onConflictDoNothing()
    .returning({ userId: proProfiles.userId });
  if (inserted.length === 0) return { created: false };

  // Every active service in this shop, at the standard price (prices can be changed afterwards).
  const offered = await db.select({ id: services.id }).from(services).where(and(eq(services.shopId, shop.id), eq(services.active, true)));
  if (offered.length > 0) {
    await db.insert(proServices).values(offered.map((s) => ({ proId: ownerId, serviceId: s.id }))).onConflictDoNothing();
  }

  // Starting hours: the first pro in the shop (by station) who has hours.
  const [teammate] = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(proProfiles, eq(proProfiles.userId, users.id))
    .innerJoin(availabilityRules, eq(availabilityRules.proId, users.id))
    .where(and(eq(users.shopId, shop.id), eq(users.role, "pro")))
    .orderBy(asc(proProfiles.stationNumber), asc(users.name))
    .limit(1);
  const theirs = teammate
    ? await db
        .select({ weekday: availabilityRules.weekday, startTime: availabilityRules.startTime, endTime: availabilityRules.endTime, kind: availabilityRules.kind })
        .from(availabilityRules)
        .where(eq(availabilityRules.proId, teammate.id))
    : [];
  const [mine] = await db.select({ n: count() }).from(availabilityRules).where(eq(availabilityRules.proId, ownerId));
  if (Number(mine?.n ?? 0) === 0) {
    await db.insert(availabilityRules).values(startingHours(theirs).map((r) => ({ ...r, proId: ownerId })));
  }
  return { created: true };
}

// Stops the owner's chair. 409 while they still have upcoming appointments.
export async function stopChair(shop: ShopRow, ownerId: string, now: Date = new Date()): Promise<{ removed: boolean }> {
  const db = getDb();
  const [upcoming] = await db
    .select({ n: count() })
    .from(appointments)
    .where(and(eq(appointments.proId, ownerId), eq(appointments.shopId, shop.id), inArray(appointments.status, ["waiting", "in_chair"]), gt(appointments.endsAt, now)));
  const n = Number(upcoming?.n ?? 0);
  if (n > 0) throw new ApiError(409, "HAS_APPOINTMENTS", `You still have ${n} upcoming ${n === 1 ? "appointment" : "appointments"}. Cancel or finish ${n === 1 ? "it" : "them"} first.`);
  await db.delete(availabilityRules).where(eq(availabilityRules.proId, ownerId));
  await db.delete(proServices).where(eq(proServices.proId, ownerId));
  const removed = await db.delete(proProfiles).where(eq(proProfiles.userId, ownerId)).returning({ userId: proProfiles.userId });
  return { removed: removed.length > 0 };
}
