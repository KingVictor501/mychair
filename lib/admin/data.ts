// lib/admin/data.ts
// WHAT IT'S FOR: the database side of the Super Admin pages. Only called after canUseAdmin.
//   listShopSummaries  every shop: type, demo or real, pros, clients, today's appointments,
//                      this month's completed revenue, plus the owner and pros for "View as"
//   searchLogs         log lines, newest first, filtered by level, event, route, shop and time
//   stackLinks         the stack's dashboards (database, hosting, repo, storage, embeddings),
//                      read from STACK_URL_* settings so they can change without editing code
// WHO USES IT: app/admin/*. The filter rules are in lib/admin/rules.ts (tested).
// WHY THE NAME: admin data; ".ts" = no screen code.

import { and, asc, count, desc, eq, gte, ilike, inArray, lt, ne, sql, type SQL } from "drizzle-orm";
import { getDb } from "../db/client";
import { staffNameSql } from "../db/names";
import { appointments, logEntries, proProfiles, shops, users } from "../db/schema";
import { addDays, localDateParts, zonedToUtc } from "../demo/time";
import { revenueRanges } from "../owner/rules";
import { safeLink, type LogFilters } from "./rules";

export type ShopSummary = {
  id: string;
  name: string;
  businessType: string;
  isDemo: boolean;
  timezone: string;
  pros: number;
  clients: number;
  todayAppointments: number;
  monthRevenueCents: number;
  people: Array<{ id: string; name: string; role: string; title: string | null }>;
};

// Every shop with its headline numbers, by name.
export async function listShopSummaries(now: Date = new Date()): Promise<ShopSummary[]> {
  const db = getDb();
  const all = await db.select().from(shops).orderBy(asc(shops.name));
  if (all.length === 0) return [];
  const ids = all.map((s) => s.id);
  const [people, clientCounts] = await Promise.all([
    db
      .select({ id: users.id, name: staffNameSql(users), role: users.role, shopId: users.shopId, title: proProfiles.title, station: proProfiles.stationNumber })
      .from(users)
      .leftJoin(proProfiles, eq(proProfiles.userId, users.id))
      .where(and(inArray(users.shopId, ids), inArray(users.role, ["owner", "pro"])))
      .orderBy(asc(users.role), asc(proProfiles.stationNumber), asc(users.name)),
    db.select({ shopId: users.shopId, n: count() }).from(users).where(and(inArray(users.shopId, ids), eq(users.role, "client"))).groupBy(users.shopId),
  ]);

  return Promise.all(
    all.map(async (shop) => {
      // Each shop has its own time zone, so "today" and "this month" are worked out per shop.
      const today = localDateParts(now, shop.timezone);
      const from = zonedToUtc(today, "00:00", shop.timezone);
      const to = zonedToUtc(addDays(today, 1), "00:00", shop.timezone);
      const month = revenueRanges(now, shop.timezone).month;
      const [row] = await db
        .select({
          today: sql<string>`count(*) filter (where ${appointments.startsAt} >= ${from} and ${appointments.startsAt} < ${to} and ${appointments.status} <> 'cancelled')`,
          revenue: sql<string>`coalesce(sum(${appointments.priceCents}) filter (where ${appointments.status} = 'completed' and ${appointments.startsAt} >= ${month} and ${appointments.startsAt} < ${now}), 0)`,
        })
        .from(appointments)
        .where(and(eq(appointments.shopId, shop.id), gte(appointments.startsAt, month < from ? month : from)));
      const mine = people.filter((p) => p.shopId === shop.id);
      return {
        id: shop.id,
        name: shop.name,
        businessType: shop.businessType,
        isDemo: shop.isDemo,
        timezone: shop.timezone,
        pros: mine.filter((p) => p.role === "pro").length,
        clients: Number(clientCounts.find((c) => c.shopId === shop.id)?.n ?? 0),
        todayAppointments: Number(row?.today ?? 0),
        monthRevenueCents: Number(row?.revenue ?? 0),
        people: mine.map((p) => ({ id: p.id, name: p.name, role: p.role, title: p.title })),
      };
    }),
  );
}

export type LogRow = { id: string; ts: string; level: string; event: string; route: string | null; shopId: string | null; userId: string | null; requestId: string | null; details: unknown };

// Log lines matching the filters, newest first, at most "limit".
export async function searchLogs(filters: LogFilters, now: Date = new Date(), limit = 200): Promise<LogRow[]> {
  const where: SQL[] = [gte(logEntries.ts, new Date(now.getTime() - filters.rangeHours * 3600 * 1000))];
  if (filters.level) where.push(eq(logEntries.level, filters.level));
  // "%" means "anything" in a LIKE search; the user's text is passed as a value, never as SQL.
  if (filters.event) where.push(ilike(logEntries.event, `%${filters.event}%`));
  if (filters.route) where.push(ilike(logEntries.route, `%${filters.route}%`));
  if (filters.shopId) where.push(eq(logEntries.shopId, filters.shopId));
  if (filters.hideDebug && !filters.level) where.push(ne(logEntries.level, "debug"));
  const rows = await getDb()
    .select()
    .from(logEntries)
    .where(and(...where, lt(logEntries.ts, new Date(now.getTime() + 60_000))))
    .orderBy(desc(logEntries.ts))
    .limit(limit);
  return rows.map((r) => ({ ...r, ts: r.ts.toISOString() }));
}

// The stack's dashboards, from settings. Only links that are set and start with https:// show.
export function stackLinks(): Array<{ label: string; url: string }> {
  const wanted: Array<[string, string | undefined]> = [
    ["Database (Neon)", process.env.STACK_URL_DATABASE],
    ["Hosting (Vercel project)", process.env.STACK_URL_HOSTING],
    ["Deployments (Vercel)", process.env.STACK_URL_DEPLOYMENTS],
    ["Code (GitHub)", process.env.STACK_URL_REPO],
    ["File storage (Vercel Blob)", process.env.STACK_URL_STORAGE],
    ["Embeddings (OpenAI)", process.env.STACK_URL_EMBEDDINGS],
  ];
  return wanted.flatMap(([label, raw]) => {
    const url = safeLink(raw);
    return url ? [{ label, url }] : [];
  });
}
