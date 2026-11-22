// lib/booking/data.ts
// WHAT IT'S FOR: the database side of booking. Each function reads or writes one thing and
// leaves the permission decision to the caller (the route), which uses lib/auth/permissions.ts.
//   getShop, listPros, getPro, listProServices, getSlots, createAppointment,
//   listClientAppointments, cancelAppointment
// Prices and open times come from lib/booking/slots.ts, so pages and the API agree.
// WHO USES IT: app/api/pros/*, app/api/appointments/*, and the /book pages.
// WHY THE NAME: booking data; ".ts" = no screen code.
//
// PRIVACY: what goes back to a client is a pro's public profile and prices. Never pay details,
// other clients, or anyone's email or phone.

import { and, asc, desc, eq, gte, inArray, lt, notInArray, or } from "drizzle-orm";
import { ApiError } from "../api-error";
import { getDb } from "../db/client";
import { appointments, availabilityRules, proProfiles, proServices, services, shops, styleCards, users } from "../db/schema";
import { addDays, localDateParts, type LocalDate } from "../demo/time";
import { canClientCancel, effectivePrice, openSlots, type Rule, type Slot } from "./slots";

export type ShopRow = typeof shops.$inferSelect;
export type ProSummary = { id: string; name: string; title: string; liveStatus: string; bio: string | null; priceMode: string; fromPriceCents: number | null };
export type ProService = { id: string; name: string; description: string; durationMin: number; priceCents: number };
export type ClientAppointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  priceCents: number;
  serviceName: string;
  proName: string;
  canCancel: boolean;
};

// Statuses that hold a time slot.
const INACTIVE = ["cancelled", "no_show"];

export async function getShop(shopId: string): Promise<ShopRow | null> {
  const [row] = await getDb().select().from(shops).where(eq(shops.id, shopId));
  return row ?? null;
}

// The pros in a shop, with their lowest price (what "from $X" shows).
export async function listPros(shopId: string): Promise<ProSummary[]> {
  const db = getDb();
  const pros = await db
    .select({ id: users.id, name: users.name, title: proProfiles.title, liveStatus: proProfiles.liveStatus, bio: proProfiles.bio, priceMode: proProfiles.priceMode })
    .from(users)
    .innerJoin(proProfiles, eq(proProfiles.userId, users.id))
    .where(and(eq(users.shopId, shopId), eq(users.role, "pro")))
    .orderBy(asc(users.name));
  if (pros.length === 0) return [];
  const offered = await db
    .select({ proId: proServices.proId, custom: proServices.customPriceCents, standard: services.standardPriceCents })
    .from(proServices)
    .innerJoin(services, eq(services.id, proServices.serviceId))
    .where(and(inArray(proServices.proId, pros.map((p) => p.id)), eq(services.active, true)));
  return pros.map((p) => {
    const prices = offered.filter((o) => o.proId === p.id).map((o) => effectivePrice(p.priceMode, o.custom, o.standard));
    return { ...p, fromPriceCents: prices.length ? Math.min(...prices) : null };
  });
}

// The pros a pro can book a caller with: themselves, plus every other pro in the shop who turned
// on "Let other pros book for me". Names only, themselves first.
export async function bookablePros(proId: string, shopId: string): Promise<Array<{ id: string; name: string }>> {
  const rows = await getDb()
    .select({ id: users.id, name: users.name })
    .from(users)
    .innerJoin(proProfiles, eq(proProfiles.userId, users.id))
    .where(and(eq(users.shopId, shopId), eq(users.role, "pro"), or(eq(users.id, proId), eq(proProfiles.allowOthersToBook, true))))
    .orderBy(asc(users.name));
  return [...rows.filter((r) => r.id === proId), ...rows.filter((r) => r.id !== proId)];
}

// One pro's profile, or null if there's no such pro. ("allowOthersToBook" is the pro's own
// setting; the public pages don't show it.)
export async function getPro(proId: string) {
  const [row] = await getDb()
    .select({ id: users.id, name: users.name, shopId: users.shopId, title: proProfiles.title, bio: proProfiles.bio, liveStatus: proProfiles.liveStatus, priceMode: proProfiles.priceMode, allowOthersToBook: proProfiles.allowOthersToBook })
    .from(users)
    .innerJoin(proProfiles, eq(proProfiles.userId, users.id))
    .where(and(eq(users.id, proId), eq(users.role, "pro")));
  return row ?? null;
}

// The services a pro offers, at the price this pro charges. If "clientId" has a style card
// with this pro, the usual service takes the card's time estimate instead of the default length.
export async function listProServices(proId: string, priceMode: string, clientId?: string): Promise<ProService[]> {
  const db = getDb();
  const rows = await db
    .select({ id: services.id, name: services.name, description: services.description, durationMin: services.durationMin, standard: services.standardPriceCents, custom: proServices.customPriceCents })
    .from(proServices)
    .innerJoin(services, eq(services.id, proServices.serviceId))
    .where(and(eq(proServices.proId, proId), eq(services.active, true)))
    .orderBy(asc(services.standardPriceCents));
  let estimate: { serviceId: string | null; minutes: number | null } | undefined;
  if (clientId) {
    const [card] = await db
      .select({ serviceId: styleCards.usualServiceId, minutes: styleCards.timeEstimateMin })
      .from(styleCards)
      .where(and(eq(styleCards.proId, proId), eq(styleCards.clientId, clientId)));
    estimate = card;
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    durationMin: estimate?.serviceId === r.id && estimate.minutes ? estimate.minutes : r.durationMin,
    priceCents: effectivePrice(priceMode, r.custom, r.standard),
  }));
}

// The open start times for a pro on a local date, for a service of this length.
export async function getSlots(proId: string, shop: ShopRow, date: LocalDate, durationMin: number, now: Date = new Date()): Promise<Slot[]> {
  const db = getDb();
  const rules = (await db
    .select({ kind: availabilityRules.kind, startTime: availabilityRules.startTime, endTime: availabilityRules.endTime })
    .from(availabilityRules)
    .where(and(eq(availabilityRules.proId, proId), eq(availabilityRules.weekday, date.weekday)))) as Rule[];
  // Appointments that day (a generous window around the local day covers any time zone).
  const dayStart = new Date(Date.UTC(date.year, date.month - 1, date.day) - 14 * 3600 * 1000);
  const dayEnd = new Date(Date.UTC(date.year, date.month - 1, date.day) + 38 * 3600 * 1000);
  const busy = await db
    .select({ startsAt: appointments.startsAt, endsAt: appointments.endsAt })
    .from(appointments)
    .where(and(eq(appointments.proId, proId), gte(appointments.endsAt, dayStart), lt(appointments.startsAt, dayEnd), notInArray(appointments.status, INACTIVE)));
  return openSlots({ date, timeZone: shop.timezone, rules: rules.map((r) => ({ ...r, startTime: r.startTime.slice(0, 5), endTime: r.endTime.slice(0, 5) })), busy, durationMin, now, bookingWindowDays: shop.bookingWindowDays });
}

// The next days a client can pick from (today through the booking window), in the shop's zone.
export function bookableDates(shop: ShopRow, now: Date = new Date()): LocalDate[] {
  const today = localDateParts(now, shop.timezone);
  return Array.from({ length: shop.bookingWindowDays + 1 }, (_, i) => addDays(today, i));
}

// Books an appointment after checking the time is really open. The database's no-overlap rule
// is the final guard: if two people book the same slot at the same moment, one gets 409.
export async function createAppointment(args: { shop: ShopRow; proId: string; priceMode: string; clientId: string; serviceId: string; startsAt: Date; now?: Date }) {
  const { shop, proId, priceMode, clientId, serviceId, startsAt } = args;
  const service = (await listProServices(proId, priceMode, clientId)).find((s) => s.id === serviceId);
  if (!service) throw new ApiError(400, "BAD_SERVICE", "That pro doesn't offer that service.");

  const date = localDateParts(startsAt, shop.timezone);
  const slots = await getSlots(proId, shop, date, service.durationMin, args.now);
  if (!slots.some((s) => s.startsAt === startsAt.toISOString())) {
    throw new ApiError(409, "SLOT_TAKEN", "That time isn't available anymore. Pick another time.");
  }

  try {
    const [row] = await getDb()
      .insert(appointments)
      .values({ shopId: shop.id, proId, clientId, serviceId, startsAt, endsAt: new Date(startsAt.getTime() + service.durationMin * 60000), priceCents: service.priceCents, status: "waiting" })
      .returning({ id: appointments.id, startsAt: appointments.startsAt, endsAt: appointments.endsAt, priceCents: appointments.priceCents });
    return row!;
  } catch (error) {
    // 23P01 = the no-overlap rule refused it (someone booked that slot a moment earlier).
    if (pgCode(error) === "23P01") throw new ApiError(409, "SLOT_TAKEN", "That time was just booked. Pick another time.");
    throw error;
  }
}

// A client's appointments: upcoming first (soonest first), then past (newest first).
export async function listClientAppointments(clientId: string, shop: ShopRow, now: Date = new Date()): Promise<ClientAppointment[]> {
  const rows = await getDb()
    .select({ id: appointments.id, startsAt: appointments.startsAt, endsAt: appointments.endsAt, status: appointments.status, priceCents: appointments.priceCents, serviceName: services.name, proName: users.name })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(users, eq(users.id, appointments.proId))
    .where(eq(appointments.clientId, clientId))
    .orderBy(desc(appointments.startsAt));
  const shaped = rows.map((r) => ({
    id: r.id,
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt.toISOString(),
    status: r.status,
    priceCents: r.priceCents,
    serviceName: r.serviceName,
    proName: r.proName,
    canCancel: r.status === "waiting" && canClientCancel(r.startsAt, shop.cancellationWindowHours, now),
  }));
  const upcoming = shaped.filter((a) => new Date(a.startsAt) > now).reverse();
  const past = shaped.filter((a) => new Date(a.startsAt) <= now);
  return [...upcoming, ...past];
}

// Cancels a client's own appointment, if it's still early enough. Returns the updated row.
export async function cancelAppointment(appointmentId: string, clientId: string, shop: ShopRow, now: Date = new Date()) {
  const db = getDb();
  const [appt] = await db.select().from(appointments).where(eq(appointments.id, appointmentId));
  // Someone else's appointment looks exactly like a missing one.
  if (!appt || appt.clientId !== clientId) throw new ApiError(404, "NOT_FOUND", "Not found.");
  if (appt.status !== "waiting") throw new ApiError(409, "NOT_CANCELLABLE", "This appointment can't be cancelled.");
  if (!canClientCancel(appt.startsAt, shop.cancellationWindowHours, now)) {
    throw new ApiError(409, "TOO_LATE", `Appointments can be cancelled up to ${shop.cancellationWindowHours} hours before they start. Please call the shop.`);
  }
  const [row] = await db.update(appointments).set({ status: "cancelled" }).where(eq(appointments.id, appointmentId)).returning({ id: appointments.id, status: appointments.status });
  return row!;
}

// Pulls the Postgres error code out of a database error (Drizzle may wrap it).
function pgCode(error: unknown): string | undefined {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code ?? e?.cause?.code;
}
