// lib/pro/data.ts
// WHAT IT'S FOR: the database side of the pro view.
//   listSchedule          a pro's appointments for one day or a week, with client first name
//   setLiveStatus         Available / With a client / Unavailable
//   changeAppointmentStatus  move an appointment along (lib/pro/lifecycle.ts decides what's allowed)
//   listMyClients         the pro's OWN clients only: people they have an appointment or style card with
//   getClientForPro       one of those clients: name, phone, style card and visit history with this
//                         pro, plus other pros' cards (read-only) on a day the client is booked with them
//   saveStyleCard         create or update this pro's card for this client
// PRIVACY: a pro gets a client's name, phone and style card only. Never email, never another
// pro's clients or cards. Every function here is scoped by the pro's own ID.
// WHO USES IT: app/api/pro/*, app/api/appointments/[id]/status and the /pro pages.
// WHY THE NAME: pro data; ".ts" = no screen code.

import { and, asc, count, desc, eq, gte, lt, max, ne, or, sql } from "drizzle-orm";
import { ApiError } from "../api-error";
import type { ShopRow } from "../booking/data";
import { getDb } from "../db/client";
import { appointments, clientProfiles, proProfiles, services, styleCards, users } from "../db/schema";
import { addDays, localDateParts, type LocalDate, zonedToUtc } from "../demo/time";
import { listPhotos, type PhotoSummary } from "../photos/data";
import type { CurrentUser } from "../types";
import { canManageAppointment, canTransition, type AppointmentStatus, type PaymentStatus, type StyleCardInput } from "./lifecycle";

export type ScheduleItem = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  paymentStatus: string | null;
  priceCents: number;
  serviceName: string;
  clientId: string;
  clientName: string;
};

export type MyClient = { id: string; name: string; phone: string | null; visits: number; lastVisit: string | null; noShows: number; hasCard: boolean };

export type ClientDetail = {
  client: { id: string; name: string; phone: string | null; noShows: number };
  card: { preferences: Record<string, string>; notes: string; usualServiceId: string | null; timeEstimateMin: number | null; updatedAt: string; photos: PhotoSummary[] } | null;
  // Other pros' cards for this client: shown read-only, and only on a day the client is booked
  // with this pro (empty otherwise).
  otherCards: Array<{ proName: string; preferences: Record<string, string>; notes: string; usualServiceName: string | null; timeEstimateMin: number | null; updatedAt: string; photos: PhotoSummary[] }>;
  bookedToday: boolean;
  visits: Array<{ id: string; startsAt: string; serviceName: string; priceCents: number; status: string }>;
  services: Array<{ id: string; name: string; durationMin: number }>;
};

// A pro's appointments from the start of "date" (shop time) for "days" days, soonest first.
export async function listSchedule(proId: string, shop: ShopRow, date: LocalDate, days: number): Promise<ScheduleItem[]> {
  const from = zonedToUtc(date, "00:00", shop.timezone);
  const to = zonedToUtc(addDays(date, days), "00:00", shop.timezone);
  const rows = await getDb()
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
      paymentStatus: appointments.paymentStatus,
      priceCents: appointments.priceCents,
      serviceName: services.name,
      clientId: users.id,
      clientName: users.name,
    })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(users, eq(users.id, appointments.clientId))
    .where(and(eq(appointments.proId, proId), gte(appointments.startsAt, from), lt(appointments.startsAt, to)))
    .orderBy(asc(appointments.startsAt));
  return rows.map((r) => ({ ...r, startsAt: r.startsAt.toISOString(), endsAt: r.endsAt.toISOString() }));
}

// The shop an appointment belongs to (for the shop-access check), or null if there's no such appointment.
export async function appointmentShopId(appointmentId: string): Promise<string | null> {
  const [row] = await getDb().select({ shopId: appointments.shopId }).from(appointments).where(eq(appointments.id, appointmentId));
  return row?.shopId ?? null;
}

// Sets the pro's live status (what clients see on the pros list).
export async function setLiveStatus(proId: string, liveStatus: string): Promise<void> {
  await getDb().update(proProfiles).set({ liveStatus }).where(eq(proProfiles.userId, proId));
}

// Moves an appointment along, if the user may manage it and the step is allowed.
// A no-show adds one strike to the client's count.
export async function changeAppointmentStatus(user: CurrentUser, appointmentId: string, to: AppointmentStatus, paymentStatus?: PaymentStatus, now: Date = new Date()) {
  const db = getDb();
  const [appt] = await db.select().from(appointments).where(eq(appointments.id, appointmentId));
  // Not found and "not yours" look the same, so nobody can probe for other pros' appointments.
  if (!appt || !canManageAppointment(user, appt)) throw new ApiError(404, "NOT_FOUND", "Not found.");
  if (!canTransition(appt.status, to)) throw new ApiError(409, "BAD_STEP", `A ${appt.status.replace("_", " ")} appointment can't be marked ${to.replace("_", " ")}.`);

  const changes: Partial<typeof appointments.$inferInsert> = { status: to };
  if (to === "in_chair") Object.assign(changes, { checkedInAt: appt.checkedInAt ?? now, chairAt: now });
  if (to === "completed") Object.assign(changes, { finishedAt: now, paymentStatus });

  const [row] = await db.update(appointments).set(changes).where(eq(appointments.id, appointmentId)).returning({ id: appointments.id, status: appointments.status, shopId: appointments.shopId });
  if (to === "no_show") {
    await db
      .update(clientProfiles)
      .set({ noShowCount: sql`${clientProfiles.noShowCount} + 1` })
      .where(eq(clientProfiles.userId, appt.clientId));
  }
  return row!;
}

// The pro's own clients: anyone with an appointment or a style card with this pro.
export async function listMyClients(proId: string): Promise<MyClient[]> {
  const db = getDb();
  const visits = await db
    .select({ clientId: appointments.clientId, visits: count(), lastVisit: max(appointments.startsAt) })
    .from(appointments)
    .where(and(eq(appointments.proId, proId), eq(appointments.status, "completed")))
    .groupBy(appointments.clientId);
  const linked = await db
    .selectDistinct({ id: users.id, name: users.name, phone: users.phone, noShows: clientProfiles.noShowCount, cardId: styleCards.id })
    .from(users)
    .leftJoin(clientProfiles, eq(clientProfiles.userId, users.id))
    .leftJoin(styleCards, and(eq(styleCards.clientId, users.id), eq(styleCards.proId, proId)))
    .where(
      and(
        eq(users.role, "client"),
        or(
          sql`exists (select 1 from ${appointments} a where a.client_id = ${users.id} and a.pro_id = ${proId})`,
          sql`exists (select 1 from ${styleCards} c where c.client_id = ${users.id} and c.pro_id = ${proId})`,
        ),
      ),
    )
    .orderBy(asc(users.name));
  return linked.map((c) => {
    const v = visits.find((x) => x.clientId === c.id);
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      visits: Number(v?.visits ?? 0),
      lastVisit: v?.lastVisit ? new Date(v.lastVisit).toISOString() : null,
      noShows: c.noShows ?? 0,
      hasCard: c.cardId !== null,
    };
  });
}

// True if this client is one of this pro's clients.
export async function isMyClient(proId: string, clientId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(appointments)
    .where(and(eq(appointments.proId, proId), eq(appointments.clientId, clientId)));
  if (Number(row?.n ?? 0) > 0) return true;
  const [card] = await getDb().select({ id: styleCards.id }).from(styleCards).where(and(eq(styleCards.proId, proId), eq(styleCards.clientId, clientId)));
  return Boolean(card);
}

// One of the pro's clients, with this pro's style card and visit history. 404 if not theirs.
// True if the client has an appointment with this pro today (shop time) that wasn't cancelled.
export async function bookedWithToday(proId: string, clientId: string, shop: ShopRow, now: Date = new Date()): Promise<boolean> {
  const today = localDateParts(now, shop.timezone);
  const from = zonedToUtc(today, "00:00", shop.timezone);
  const to = zonedToUtc(addDays(today, 1), "00:00", shop.timezone);
  const [row] = await getDb()
    .select({ n: count() })
    .from(appointments)
    .where(and(eq(appointments.proId, proId), eq(appointments.clientId, clientId), gte(appointments.startsAt, from), lt(appointments.startsAt, to), ne(appointments.status, "cancelled")));
  return Number(row?.n ?? 0) > 0;
}

export async function getClientForPro(proId: string, shop: ShopRow, clientId: string): Promise<ClientDetail> {
  const db = getDb();
  const shopId = shop.id;
  if (!(await isMyClient(proId, clientId))) throw new ApiError(404, "NOT_FOUND", "Not found.");
  const [client] = await db
    .select({ id: users.id, name: users.name, phone: users.phone, noShows: clientProfiles.noShowCount })
    .from(users)
    .leftJoin(clientProfiles, eq(clientProfiles.userId, users.id))
    .where(and(eq(users.id, clientId), eq(users.shopId, shopId)));
  if (!client) throw new ApiError(404, "NOT_FOUND", "Not found.");
  const [card] = await db.select().from(styleCards).where(and(eq(styleCards.proId, proId), eq(styleCards.clientId, clientId)));
  const visits = await db
    .select({ id: appointments.id, startsAt: appointments.startsAt, serviceName: services.name, priceCents: appointments.priceCents, status: appointments.status })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .where(and(eq(appointments.proId, proId), eq(appointments.clientId, clientId), lt(appointments.startsAt, new Date())))
    .orderBy(desc(appointments.startsAt))
    .limit(500);

  // Other pros' cards for this client, only when the client is booked with this pro today.
  const bookedToday = await bookedWithToday(proId, clientId, shop);
  const otherRows = bookedToday
    ? await db
        .select({ id: styleCards.id, proName: users.name, preferences: styleCards.preferences, notes: styleCards.notes, usualServiceName: services.name, timeEstimateMin: styleCards.timeEstimateMin, updatedAt: styleCards.updatedAt })
        .from(styleCards)
        .innerJoin(users, eq(users.id, styleCards.proId))
        .leftJoin(services, eq(services.id, styleCards.usualServiceId))
        .where(and(eq(styleCards.clientId, clientId), eq(styleCards.shopId, shopId), ne(styleCards.proId, proId)))
    : [];
  const otherCards = await Promise.all(
    otherRows.map(async (c) => ({
      proName: c.proName,
      preferences: c.preferences ?? {},
      notes: c.notes ?? "",
      usualServiceName: c.usualServiceName,
      timeEstimateMin: c.timeEstimateMin,
      updatedAt: c.updatedAt.toISOString(),
      photos: await listPhotos(c.id),
    })),
  );
  const offered = await db.select({ id: services.id, name: services.name, durationMin: services.durationMin }).from(services).where(eq(services.shopId, shopId)).orderBy(asc(services.name));
  return {
    client: { id: client.id, name: client.name, phone: client.phone, noShows: client.noShows ?? 0 },
    card: card
      ? { preferences: card.preferences ?? {}, notes: card.notes ?? "", usualServiceId: card.usualServiceId, timeEstimateMin: card.timeEstimateMin, updatedAt: card.updatedAt.toISOString(), photos: await listPhotos(card.id) }
      : null,
    otherCards,
    bookedToday,
    visits: visits.map((v) => ({ ...v, startsAt: v.startsAt.toISOString() })),
    services: offered,
  };
}

// Creates or updates the pro's style card for one of their clients. 404 if not their client.
export async function saveStyleCard(proId: string, shopId: string, clientId: string, input: StyleCardInput): Promise<void> {
  if (!(await isMyClient(proId, clientId))) throw new ApiError(404, "NOT_FOUND", "Not found.");
  if (input.usualServiceId) {
    const [svc] = await getDb().select({ id: services.id }).from(services).where(and(eq(services.id, input.usualServiceId), eq(services.shopId, shopId)));
    if (!svc) throw new ApiError(400, "BAD_SERVICE", "Pick one of this shop's services.");
  }
  const values = { preferences: input.preferences, notes: input.notes, usualServiceId: input.usualServiceId, timeEstimateMin: input.timeEstimateMin, updatedAt: new Date() };
  await getDb()
    .insert(styleCards)
    .values({ shopId, proId, clientId, ...values })
    .onConflictDoUpdate({ target: [styleCards.proId, styleCards.clientId], set: values });
}
