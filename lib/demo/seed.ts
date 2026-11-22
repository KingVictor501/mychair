// lib/demo/seed.ts
// WHAT IT'S FOR: adding and removing the demo shops.
//   seedDemo   creates the three demo shops from lib/demo/catalog.ts, with their owners, pros,
//              clients, services and prices, hours, about three months of past appointments and
//              five days of upcoming ones, and style cards. Skips if demo data already exists,
//              so running it twice never makes duplicates.
//   removeDemo deletes every demo shop (everything under a shop goes with it, because of the
//              "onDelete: cascade" links in the schema), their photo files in storage, and the
//              demo Super Admin. Real records
//              are never touched: only rows marked is_demo are deleted.
//   resetDemo  remove, then seed: puts the demo back to a clean state.
// Appointment times are generated around "now" in each shop's time zone, so the demo always
// looks current.
// WHO USES IT: scripts/demo-seed.ts, scripts/demo-remove.ts and the Super Admin "Reset demo" route.
// WHY THE NAME: "seed" = put starting data into the database; ".ts" = no screen code.

import { createHash } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { hashPassword } from "../auth/password";
import { getDb } from "../db/client";
import {
  appointments,
  availabilityRules,
  clientProfiles,
  proProfiles,
  proServices,
  services,
  shops,
  styleCardPhotos,
  styleCards,
  users,
} from "../db/schema";
import { deleteBlobs } from "../photos/data";
import { DEMO_SHOPS, DEMO_SUPER_ADMIN, type DemoShop } from "./catalog";
import { addDays, localDateParts, minutesToTime, timeToMinutes, zonedToUtc } from "./time";

type Db = ReturnType<typeof getDb>;

// How far back the demo's appointment history goes, so visit history and revenue have a few months to show.
const HISTORY_DAYS = 90;

// A fixed ID for a demo shop or person, made from its slug or email. Because the ID is the same
// every time the demo is seeded, resetting the demo doesn't log anyone out: their session still
// points at an account that exists. (Real accounts keep their random IDs.)
export function demoId(key: string): string {
  const h = createHash("sha256").update(`mychair-demo:${key}`).digest("hex");
  // Shaped like a standard UUID (version 4 layout) so the uuid columns accept it.
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
type AppointmentRow = typeof appointments.$inferInsert;

// A small seeded random-number generator, so each shop's demo week has a stable shape.
function random(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// True if any demo shop exists.
export async function demoExists(db: Db = getDb()): Promise<boolean> {
  const [row] = await db.select({ n: count() }).from(shops).where(eq(shops.isDemo, true));
  return Number(row?.n ?? 0) > 0;
}

// Deletes all demo data. Returns how many demo shops and demo users were removed.
export async function removeDemo(db: Db = getDb()): Promise<{ shops: number; users: number }> {
  // Photo files live in file storage, not the database, so delete them first: removing the
  // shops below would otherwise leave the files behind.
  const photos = await db
    .select({ pathname: styleCardPhotos.pathname })
    .from(styleCardPhotos)
    .innerJoin(shops, eq(shops.id, styleCardPhotos.shopId))
    .where(eq(shops.isDemo, true));
  await deleteBlobs(photos.map((p) => p.pathname));
  const removedShops = await db.delete(shops).where(eq(shops.isDemo, true)).returning({ id: shops.id });
  // Users with a shop went with their shop; this catches the demo Super Admin (no shop).
  const removedUsers = await db.delete(users).where(eq(users.isDemo, true)).returning({ id: users.id });
  return { shops: removedShops.length, users: removedUsers.length };
}

// Creates all demo data. "password" is the shared demo login password (from DEMO_PASSWORD).
export async function seedDemo(
  password: string,
  now: Date = new Date(),
  db: Db = getDb(),
): Promise<{ skipped: boolean; shops: number; appointments: number }> {
  if (await demoExists(db)) return { skipped: true, shops: 0, appointments: 0 };
  const passwordHash = await hashPassword(password);

  await db.insert(users).values({ id: demoId(DEMO_SUPER_ADMIN.email), role: "super_admin", name: DEMO_SUPER_ADMIN.name, email: DEMO_SUPER_ADMIN.email, passwordHash, isDemo: true });

  let totalAppointments = 0;
  for (const [index, shop] of DEMO_SHOPS.entries()) {
    totalAppointments += await seedShop(db, shop, passwordHash, now, random(1000 + index));
  }
  return { skipped: false, shops: DEMO_SHOPS.length, appointments: totalAppointments };
}

// Remove, then seed again.
export async function resetDemo(password: string, now: Date = new Date(), db: Db = getDb()) {
  await removeDemo(db);
  return seedDemo(password, now, db);
}

// Seeds one shop. Returns the number of appointments created.
async function seedShop(db: Db, shop: DemoShop, passwordHash: string, now: Date, rand: () => number): Promise<number> {
  const [shopRow] = await db
    .insert(shops)
    .values({ id: demoId(shop.slug), slug: shop.slug, name: shop.name, businessType: shop.businessType, timezone: shop.timezone, isDemo: true })
    .returning({ id: shops.id });
  if (!shopRow) throw new Error("demo shop insert failed");
  const shopId = shopRow.id;

  // The owner (runs the shop; doesn't take appointments in the demo).
  await db.insert(users).values({ id: demoId(shop.owner.email), shopId, role: "owner", name: shop.owner.name, email: shop.owner.email, phone: shop.owner.phone, passwordHash, isDemo: true });

  // Services and their standard prices.
  const serviceRows = await db
    .insert(services)
    .values(shop.services.map((s) => ({ shopId, name: s.name, description: s.description, durationMin: s.durationMin, standardPriceCents: s.priceCents })))
    .returning({ id: services.id, name: services.name, durationMin: services.durationMin, priceCents: services.standardPriceCents });

  // Pros, their profiles, the services they offer (custom prices where set) and their hours.
  const pros: Array<{ id: string; custom: Record<string, number> }> = [];
  for (const [index, pro] of shop.pros.entries()) {
    const [proRow] = await db
      .insert(users)
      .values({ id: demoId(pro.email), shopId, role: "pro", name: pro.name, email: pro.email, phone: pro.phone, passwordHash, isDemo: true })
      .returning({ id: users.id });
    if (!proRow) throw new Error("demo pro insert failed");
    const custom = pro.customPrices ?? {};
    await db.insert(proProfiles).values({
      userId: proRow.id,
      title: pro.title,
      stationNumber: pro.station,
      payType: pro.payType,
      payAmount: pro.payAmount,
      priceMode: Object.keys(custom).length > 0 ? "custom" : "standard",
      bio: pro.bio,
      // The first two pros in each shop let others book for them, so the demo shows both cases.
      allowOthersToBook: index < 2,
    });
    await db.insert(proServices).values(serviceRows.map((s) => ({ proId: proRow.id, serviceId: s.id, customPriceCents: custom[s.name] ?? null })));
    const weekly = shop.openDays.flatMap((weekday) => [
      { proId: proRow.id, weekday, startTime: shop.hours.start, endTime: shop.hours.end, kind: "work" },
      { proId: proRow.id, weekday, startTime: shop.hours.breakStart, endTime: shop.hours.breakEnd, kind: "break" },
    ]);
    await db.insert(availabilityRules).values(weekly);
    pros.push({ id: proRow.id, custom });
  }

  // Clients. Each client has a client profile (for no-show strikes).
  const clientRows = await db
    .insert(users)
    .values(shop.clients.map((c) => ({ id: demoId(c.email), shopId, role: "client", name: c.name, email: c.email, phone: c.phone, passwordHash, isDemo: true })))
    .returning({ id: users.id });
  await db.insert(clientProfiles).values(clientRows.map((c) => ({ userId: c.id })));

  // Each pro has two clients of their own (6 clients, 3 pros).
  const regulars = pros.map((_, i) => [clientRows[(i * 2) % clientRows.length]!, clientRows[(i * 2 + 1) % clientRows.length]!]);
  // Each client's preferred pro is the pro they book with, so every pro has two clients under
  // "Your clients".
  for (const [i, pair] of regulars.entries()) {
    for (const client of pair) {
      await db.update(clientProfiles).set({ preferredProId: pros[i]!.id }).where(eq(clientProfiles.userId, client.id));
    }
  }

  // Appointments: about three months back to 5 days ahead, in the shop's local time.
  const rows: AppointmentRow[] = [];
  const today = localDateParts(now, shop.timezone);
  const open = timeToMinutes(shop.hours.start);
  const close = timeToMinutes(shop.hours.end);
  const breakStart = timeToMinutes(shop.hours.breakStart);
  const breakEnd = timeToMinutes(shop.hours.breakEnd);

  for (let offset = -HISTORY_DAYS; offset <= 5; offset++) {
    const day = addDays(today, offset);
    if (!shop.openDays.includes(day.weekday)) continue;
    pros.forEach((pro, p) => {
      let cursor = open;
      while (true) {
        if (cursor >= breakStart && cursor < breakEnd) cursor = breakEnd;
        // Leave gaps so the schedule isn't packed.
        if (rand() < 0.35) {
          cursor += 15 + Math.floor(rand() * 2) * 15;
          continue;
        }
        const service = serviceRows[Math.floor(rand() * serviceRows.length)]!;
        const end = cursor + service.durationMin;
        if (end > close) break;
        if (cursor < breakStart && end > breakStart) {
          cursor = breakEnd;
          continue;
        }
        const startsAt = zonedToUtc(day, minutesToTime(cursor), shop.timezone);
        const endsAt = zonedToUtc(day, minutesToTime(end), shop.timezone);
        // Clients only book with their own pro, so each pro's client list is truly their own
        // (and the demo shows that one pro never sees another pro's clients).
        const client = regulars[p]![Math.floor(rand() * 2)]!;
        const price = pro.custom[service.name] ?? service.priceCents;
        rows.push(makeAppointment({ shopId, proId: pro.id, clientId: client.id, serviceId: service.id, startsAt, endsAt, priceCents: price }, now, rand));
        cursor = end + (rand() < 0.5 ? 0 : 15);
      }
    });
  }

  // Insert in batches to keep each request small.
  for (let i = 0; i < rows.length; i += 200) await db.insert(appointments).values(rows.slice(i, i + 200));

  // No-show strikes match the no-show appointments.
  for (const client of clientRows) {
    const strikes = rows.filter((r) => r.clientId === client.id && r.status === "no_show").length;
    if (strikes > 0) await db.update(clientProfiles).set({ noShowCount: strikes }).where(eq(clientProfiles.userId, client.id));
  }

  // Style cards for each pro's regulars: preferences, notes, usual service and time estimate.
  const cards = pros.flatMap((pro, p) =>
    regulars[p]!.map((client, r) => {
      const usual = mostBooked(rows, pro.id, client.id) ?? serviceRows[0]!.id;
      const usualService = serviceRows.find((s) => s.id === usual)!;
      return {
        shopId,
        proId: pro.id,
        clientId: client.id,
        preferences: shop.preferences[(p + r) % shop.preferences.length]!,
        notes: r === 0 ? "Regular. Likes to chat; books the same time every visit." : "Prefers quiet appointments.",
        usualServiceId: usual,
        timeEstimateMin: usualService.durationMin + (r === 0 ? 0 : 10),
      };
    }),
  );
  await db.insert(styleCards).values(cards);

  return rows.length;
}

// Builds one appointment. Past ones are mostly completed (a few no-shows and cancellations);
// upcoming ones are waiting.
function makeAppointment(
  base: { shopId: string; proId: string; clientId: string; serviceId: string; startsAt: Date; endsAt: Date; priceCents: number },
  now: Date,
  rand: () => number,
): AppointmentRow {
  if (base.endsAt.getTime() > now.getTime()) {
    return { ...base, status: "waiting", paymentStatus: rand() < 0.2 ? "deposit_held" : null };
  }
  const roll = rand();
  if (roll < 0.06) return { ...base, status: "no_show", paymentStatus: null };
  if (roll < 0.13) return { ...base, status: "cancelled", paymentStatus: null };
  return {
    ...base,
    status: "completed",
    paymentStatus: rand() < 0.7 ? "paid" : "cash",
    checkedInAt: new Date(base.startsAt.getTime() - 5 * 60 * 1000),
    chairAt: base.startsAt,
    finishedAt: base.endsAt,
  };
}

// The service a client booked most with a pro (completed visits), or null.
function mostBooked(rows: AppointmentRow[], proId: string, clientId: string): string | null {
  const tally = new Map<string, number>();
  for (const r of rows) {
    if (r.proId === proId && r.clientId === clientId && r.status === "completed") tally.set(r.serviceId, (tally.get(r.serviceId) ?? 0) + 1);
  }
  let best: string | null = null;
  let most = 0;
  for (const [id, n] of tally) if (n > most) [best, most] = [id, n];
  return best;
}

