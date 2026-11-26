// lib/demo/entry.ts
// WHAT IT'S FOR: the public /demo page.
//   listDemoViews  the demo shops with their owner and pros, for the buttons
// WHO USES IT: app/demo/page.tsx. (Who may enter is lib/auth/access-rules.ts canEnterDemo.)
// WHY THE NAME: entering the demo; ".ts" = no screen code.

import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client";
import { staffNameSql } from "../db/names";
import { proProfiles, shops, users } from "../db/schema";

export type DemoShopView = { id: string; name: string; businessType: string; owner: { id: string; name: string } | null; pros: Array<{ id: string; name: string; title: string }> };

// The demo shops, each with its demo owner and pros (first names only), for the /demo buttons.
export async function listDemoViews(): Promise<DemoShopView[]> {
  const db = getDb();
  const demoShops = await db.select({ id: shops.id, name: shops.name, businessType: shops.businessType }).from(shops).where(eq(shops.isDemo, true)).orderBy(asc(shops.name));
  if (demoShops.length === 0) return [];
  const people = await db
    .select({ id: users.id, name: staffNameSql(users), role: users.role, shopId: users.shopId, title: proProfiles.title, station: proProfiles.stationNumber })
    .from(users)
    .leftJoin(proProfiles, eq(proProfiles.userId, users.id))
    .where(and(eq(users.isDemo, true), inArray(users.role, ["owner", "pro"]), inArray(users.shopId, demoShops.map((s) => s.id))))
    .orderBy(asc(proProfiles.stationNumber), asc(users.name));
  return demoShops.map((s) => {
    const owner = people.find((p) => p.shopId === s.id && p.role === "owner");
    return {
      ...s,
      owner: owner ? { id: owner.id, name: owner.name } : null,
      pros: people.filter((p) => p.shopId === s.id && p.role === "pro").map((p) => ({ id: p.id, name: p.name, title: p.title ?? "Pro" })),
    };
  });
}
