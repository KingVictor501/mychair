// lib/demo/seed.ts
// WHAT IT'S FOR: adding and removing the demo shops.
//   seedDemo   creates the three demo shops from lib/demo/catalog.ts, with their owners, pros,
//              clients (six regulars plus 320 drop-ins per shop), services and prices, hours,
//              about three months of past visits and five days of upcoming ones (one appointment
//              per visit, 1 to 3 services), and style cards. Skips if demo data already exists,
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

import { createHash, randomUUID } from "node:crypto";
import { count, eq, sql } from "drizzle-orm";
import { hashPassword } from "../auth/password";
import { getDb } from "../db/client";
import {
  appointmentServices,
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
import { DEMO_SHOPS, DEMO_SUPER_ADMIN, demoDropInClients, type DemoShop } from "./catalog";
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

  // Clients: the catalog's six regulars (two per pro; they pick that pro as preferred, so each
  // pro has two clients under "Your clients"), plus drop-in clients so the shop has a realistic
  // client list. Each client has a client profile (no-show strikes and preferred pro).
  const regularCount = shop.clients.length;
  const allClients = [...shop.clients, ...demoDropInClients(shop)].map((c) => ({ ...c, id: demoId(c.email) }));
  for (let i = 0; i < allClients.length; i += 200) {
    await db.insert(users).values(allClients.slice(i, i + 200).map((c) => ({ id: c.id, shopId, role: "client", name: c.name, email: c.email, phone: c.phone, passwordHash, isDemo: true })));
  }
  // Each client's "home" pro: regulars two per pro in order (Chris and Tyler with the first pro,
  // and so on); drop-ins spread evenly across the pros.
  const homePro = (i: number) => (i < regularCount ? Math.floor(i / 2) % pros.length : (i - regularCount) % pros.length);
  const profiles = allClients.map((c, i) => ({ userId: c.id, preferredProId: i < regularCount ? pros[homePro(i)]!.id : null }));
  for (let i = 0; i < profiles.length; i += 200) await db.insert(clientProfiles).values(profiles.slice(i, i + 200));
  const regulars = pros.map((_, p) => allClients.filter((_, i) => i < regularCount && homePro(i) === p));

  // Appointments: about three months back to 5 days ahead, in the shop's local time. Each client
  // comes back every so often (regulars every 1 to 2 weeks, drop-ins every 2 to 5 weeks), and each
  // visit is ONE appointment with 1 to 3 different services, mostly with their own pro.
  const rows: AppointmentRow[] = [];
  const lines: Array<typeof appointmentServices.$inferInsert> = [];
  const today = localDateParts(now, shop.timezone);
  const open = timeToMinutes(shop.hours.start);
  const close = timeToMinutes(shop.hours.end);
  const breakStart = timeToMinutes(shop.hours.breakStart);
  const breakEnd = timeToMinutes(shop.hours.breakEnd);
  // Booked minutes per pro per day ("proIndex|dayOffset"), so visits never overlap.
  const booked = new Map<string, Array<[number, number]>>();
  const fits = (key: string, start: number, length: number) => {
    const end = start + length;
    if (start < open || end > close || (start < breakEnd && end > breakStart)) return false;
    return !(booked.get(key) ?? []).some(([s, e]) => start < e && end > s);
  };

  allClients.forEach((client, i) => {
    const cadence = i < regularCount ? 7 + Math.floor(rand() * 8) : 14 + Math.floor(rand() * 22);
    for (let offset = -HISTORY_DAYS + Math.floor(rand() * cadence); offset <= 5; offset += cadence + Math.floor(rand() * 7) - 3) {
      // If the shop is closed that day, come the next open day instead.
      let o = offset;
      let day = addDays(today, o);
      for (let tries = 0; tries < 3 && !shop.openDays.includes(day.weekday); tries++) day = addDays(today, ++o);
      if (!shop.openDays.includes(day.weekday) || o > 5) continue;
      // Usually their own pro; now and then someone else in the shop.
      const p = rand() < 0.9 ? homePro(i) : Math.floor(rand() * pros.length);
      const pro = pros[p]!;
      // One service most visits, sometimes two or three, never the same one twice.
      const howMany = rand() < 0.65 ? 1 : rand() < 0.8 ? 2 : 3;
      const pool = [...serviceRows];
      const picked = Array.from({ length: howMany }, () => pool.splice(Math.floor(rand() * pool.length), 1)[0]!);
      const length = picked.reduce((sum, sv) => sum + sv.durationMin, 0);
      // Find a free start time on the 15-minute grid; if the day is full, skip this visit.
      const key = `${p}|${o}`;
      let start: number | null = null;
      for (let t = 0; t < 25 && start === null; t++) {
        const candidate = open + Math.floor(rand() * ((close - open) / 15)) * 15;
        if (fits(key, candidate, length)) start = candidate;
      }
      if (start === null) continue;
      booked.set(key, [...(booked.get(key) ?? []), [start, start + length]]);
      const prices = picked.map((sv) => pro.custom[sv.name] ?? sv.priceCents);
      const id = randomUUID();
      const base = {
        shopId,
        proId: pro.id,
        clientId: client.id,
        serviceId: picked[0]!.id,
        startsAt: zonedToUtc(day, minutesToTime(start), shop.timezone),
        endsAt: zonedToUtc(day, minutesToTime(start + length), shop.timezone),
        priceCents: prices.reduce((sum, c) => sum + c, 0),
      };
      rows.push({ ...makeAppointment(base, now, rand), id });
      // An appointment with more than one service lists each one, with its own price and length.
      if (picked.length > 1) picked.forEach((sv, k) => lines.push({ appointmentId: id, position: k + 1, serviceId: sv.id, priceCents: prices[k]!, durationMin: sv.durationMin }));
    }
  });

  // Insert in batches to keep each request small.
  for (let i = 0; i < rows.length; i += 200) await db.insert(appointments).values(rows.slice(i, i + 200));
  // Service lines after their appointments (each line points at one).
  for (let i = 0; i < lines.length; i += 500) await db.insert(appointmentServices).values(lines.slice(i, i + 500));

  // No-show strikes match the no-show appointments: one database statement for the whole shop.
  await db.execute(
    sql`update ${clientProfiles} set no_show_count = s.n from (select client_id, count(*)::int as n from ${appointments} where shop_id = ${shopId} and status = 'no_show' group by client_id) s where ${clientProfiles.userId} = s.client_id`,
  );

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

