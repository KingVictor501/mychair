// lib/guest/booking.ts
// WHAT IT'S FOR: booking without an account ("guest" booking).
//   guestCanSeeShop      which shops a guest may see and book at (no database, so it's tested
//                        exactly): real shops always; demo shops only while demo mode is on
//   guestBookingInput    what a guest booking request may contain
//   listGuestShops       the shops a guest can book at, each with its pros
//   loadGuestPro         one pro and their shop, or 404 if a guest may not see them
//   findOrAddGuestClient the client record a guest booking goes on, found or added by phone
// WHO USES IT: app/guest/*, app/api/guest/*. Tested by lib/guest/guest.test.ts.
// WHY THE NAME: guest booking; ".ts" = no screen code.
//
// PRIVACY: a guest never sees anything about an existing client. If their phone number already
// belongs to a client of that shop, the booking goes on that client's record (as the shop
// owner chose), but the reply is the same either way. Nothing here logs a name or phone.

import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "../api-error";
import { normalizePhone } from "../auth/identifier";
import { getPro, getShop, listPros, type ProSummary, type ShopRow } from "../booking/data";
import { getDb } from "../db/client";
import { clientProfiles, shops, users } from "../db/schema";
import { isDemoModeOn } from "../demo/mode";

// True if a guest may see and book at this shop.
export function guestCanSeeShop(shop: { isDemo: boolean }, demoModeOn: boolean): boolean {
  return !shop.isDemo || demoModeOn;
}

// A guest booking: the pro, service and time, plus the guest's first name and phone.
export const guestBookingInput = z
  .object({
    proId: z.string().uuid(),
    serviceId: z.string().uuid(),
    startsAt: z.string().datetime(),
    name: z.string().trim().min(1, "Enter your first name.").max(40, "Keep your name under 40 characters."),
    phone: z.string().trim().min(7, "Enter your phone number.").max(30),
  })
  .strict();

// The shops a guest can book at, by name, each with its pros.
export async function listGuestShops(): Promise<Array<{ shop: ShopRow; pros: ProSummary[] }>> {
  const demoOn = await isDemoModeOn();
  const rows = await getDb().select().from(shops).orderBy(asc(shops.name));
  const visible = rows.filter((s) => guestCanSeeShop(s, demoOn));
  return Promise.all(visible.map(async (shop) => ({ shop, pros: await listPros(shop.id) })));
}

// One pro and their shop for a guest. A made-up ID, or a shop a guest can't see, is 404.
export async function loadGuestPro(proId: string) {
  const pro = /^[0-9a-f-]{36}$/i.test(proId) ? await getPro(proId) : null;
  const shop = pro?.shopId ? await getShop(pro.shopId) : null;
  if (!pro || !shop || !guestCanSeeShop(shop, await isDemoModeOn())) throw new ApiError(404, "NOT_FOUND", "Not found.");
  return { pro, shop };
}

// The client ID a guest booking goes on: the shop's client with that phone number, or a new
// client (first name and phone) if nobody has it. A number that belongs to someone outside this
// shop, or to a pro or owner, can't be used, because each phone number is one account.
export async function findOrAddGuestClient(shop: ShopRow, name: string, rawPhone: string): Promise<string> {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new ApiError(400, "BAD_PHONE", "Enter a 10-digit phone number.");
  const db = getDb();
  const [existing] = await db.select({ id: users.id, role: users.role, shopId: users.shopId }).from(users).where(eq(users.phone, phone));
  if (existing) {
    if (existing.role === "client" && existing.shopId === shop.id) return existing.id;
    throw new ApiError(409, "PHONE_IN_USE", "We couldn't book with that number. Please call the shop to book.");
  }
  const [row] = await db.insert(users).values({ shopId: shop.id, role: "client", name, phone, isDemo: shop.isDemo }).returning({ id: users.id });
  await db.insert(clientProfiles).values({ userId: row!.id });
  return row!.id;
}

