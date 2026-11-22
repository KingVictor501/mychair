// lib/owner/data.ts
// WHAT IT'S FOR: the database side of the owner view. Everything is scoped to one shop.
//   listShopDay      every appointment in the shop on one day (all pros), soonest first
//   shopRevenue      completed revenue today, this week and this month
//   listTeam         the shop's pros: title, station, live status, pay, price mode, today's count
//   getProPricing    one pro's services with standard and custom prices
//   setProPricing    switch a pro between standard and custom prices, and set custom prices
// WHO USES IT: app/owner/*, app/api/owner/*.
// WHY THE NAME: owner data; ".ts" = no screen code.
//
// PRIVACY: pay structure is in here, so these functions are only called after checking the user
// is the shop's owner (or the Super Admin).

import { and, asc, count, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { ApiError } from "../api-error";
import { serviceNamesSql, type ShopRow } from "../booking/data";
import { getDb } from "../db/client";
import { appointments, proProfiles, proServices, services, users } from "../db/schema";
import { addDays, type LocalDate, zonedToUtc } from "../demo/time";
import { alias } from "drizzle-orm/pg-core";
import { revenueRanges, type PricingInput } from "./rules";

export type ShopDayItem = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  priceCents: number;
  serviceName: string;
  proId: string;
  proName: string;
  clientName: string;
};

export type TeamMember = {
  id: string;
  name: string;
  title: string;
  station: string | null;
  liveStatus: string;
  payType: string | null;
  payAmount: number | null;
  priceMode: string;
  allowOthersToBook: boolean;
  todayCount: number;
};

// Every appointment in the shop on one local day, all pros, soonest first.
export async function listShopDay(shop: ShopRow, date: LocalDate): Promise<ShopDayItem[]> {
  const from = zonedToUtc(date, "00:00", shop.timezone);
  const to = zonedToUtc(addDays(date, 1), "00:00", shop.timezone);
  // "users" appears twice (the pro and the client), so the client copy gets its own name.
  const client = alias(users, "client");
  const rows = await getDb()
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
      priceCents: appointments.priceCents,
      serviceName: serviceNamesSql,
      proId: appointments.proId,
      proName: users.name,
      clientName: client.name,
    })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(users, eq(users.id, appointments.proId))
    .innerJoin(client, eq(client.id, appointments.clientId))
    .where(and(eq(appointments.shopId, shop.id), gte(appointments.startsAt, from), lt(appointments.startsAt, to)))
    .orderBy(asc(appointments.startsAt), asc(users.name));
  return rows.map((r) => ({ ...r, startsAt: r.startsAt.toISOString(), endsAt: r.endsAt.toISOString() }));
}

// Completed revenue (what completed appointments were booked at) today, this week and this month.
export async function shopRevenue(shop: ShopRow, now: Date = new Date()): Promise<{ todayCents: number; weekCents: number; monthCents: number }> {
  const r = revenueRanges(now, shop.timezone);
  // One query: three sums, each counting only appointments since that range began.
  const [row] = await getDb()
    .select({
      today: sql<string>`coalesce(sum(${appointments.priceCents}) filter (where ${appointments.startsAt} >= ${r.today}), 0)`,
      week: sql<string>`coalesce(sum(${appointments.priceCents}) filter (where ${appointments.startsAt} >= ${r.week}), 0)`,
      month: sql<string>`coalesce(sum(${appointments.priceCents}), 0)`,
    })
    .from(appointments)
    .where(and(eq(appointments.shopId, shop.id), eq(appointments.status, "completed"), gte(appointments.startsAt, r.month), lt(appointments.startsAt, now)));
  return { todayCents: Number(row?.today ?? 0), weekCents: Number(row?.week ?? 0), monthCents: Number(row?.month ?? 0) };
}

// The shop's pros with everything the owner manages, and how many appointments each has today.
export async function listTeam(shop: ShopRow, today: LocalDate): Promise<TeamMember[]> {
  const db = getDb();
  const pros = await db
    .select({
      id: users.id,
      name: users.name,
      title: proProfiles.title,
      station: proProfiles.stationNumber,
      liveStatus: proProfiles.liveStatus,
      payType: proProfiles.payType,
      payAmount: proProfiles.payAmount,
      priceMode: proProfiles.priceMode,
      allowOthersToBook: proProfiles.allowOthersToBook,
    })
    .from(users)
    .innerJoin(proProfiles, eq(proProfiles.userId, users.id))
    .where(and(eq(users.shopId, shop.id), eq(users.role, "pro")))
    .orderBy(asc(proProfiles.stationNumber), asc(users.name));
  if (pros.length === 0) return [];
  const from = zonedToUtc(today, "00:00", shop.timezone);
  const to = zonedToUtc(addDays(today, 1), "00:00", shop.timezone);
  const counts = await db
    .select({ proId: appointments.proId, n: count() })
    .from(appointments)
    .where(and(inArray(appointments.proId, pros.map((p) => p.id)), gte(appointments.startsAt, from), lt(appointments.startsAt, to), sql`${appointments.status} <> 'cancelled'`))
    .groupBy(appointments.proId);
  return pros.map((p) => ({ ...p, todayCount: Number(counts.find((c) => c.proId === p.id)?.n ?? 0) }));
}

// One pro in this shop, with their services at standard and custom prices. 404 if not in the shop.
export async function getProPricing(shop: ShopRow, proId: string) {
  const db = getDb();
  const [pro] = await db
    .select({ id: users.id, name: users.name, title: proProfiles.title, priceMode: proProfiles.priceMode })
    .from(users)
    .innerJoin(proProfiles, eq(proProfiles.userId, users.id))
    .where(and(eq(users.id, proId), eq(users.role, "pro"), eq(users.shopId, shop.id)));
  if (!pro) throw new ApiError(404, "NOT_FOUND", "Not found.");
  const rows = await db
    .select({ id: services.id, name: services.name, durationMin: services.durationMin, standardCents: services.standardPriceCents, customCents: proServices.customPriceCents })
    .from(proServices)
    .innerJoin(services, eq(services.id, proServices.serviceId))
    .where(and(eq(proServices.proId, proId), eq(services.active, true)))
    .orderBy(asc(services.standardPriceCents), asc(services.name));
  return { pro, services: rows };
}

// Sets a pro's price mode and custom prices. Only services this pro offers can be priced.
// Custom prices are kept when switching to standard, so switching back to custom restores them.
export async function setProPricing(shop: ShopRow, proId: string, input: PricingInput): Promise<{ changed: number }> {
  const { services: offered } = await getProPricing(shop, proId);
  const offeredIds = new Set(offered.map((s) => s.id));
  if (input.prices.some((p) => !offeredIds.has(p.serviceId))) throw new ApiError(400, "BAD_SERVICE", "Pick services this pro offers.");
  const db = getDb();
  await db.update(proProfiles).set({ priceMode: input.priceMode }).where(eq(proProfiles.userId, proId));
  for (const p of input.prices) {
    await db.update(proServices).set({ customPriceCents: p.priceCents }).where(and(eq(proServices.proId, proId), eq(proServices.serviceId, p.serviceId)));
  }
  return { changed: input.prices.length };
}
