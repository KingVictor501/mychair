// lib/clients/search.ts
// WHAT IT'S FOR: client search, and adding a client who calls in.
//   parseClientSearch  what each role may search with (no database, so it's tested exactly):
//                        - a pro: the client's FULL phone number only, so they can find someone who
//                          calls to book, without being able to browse the client list
//                        - an owner (their shop) or the Super Admin (every shop): any part of a
//                          name or phone number
//   searchClients      runs the search for the logged-in user
//   addClient          adds a new client (first name and phone) to a shop, for phone-in bookings
// WHO USES IT: app/api/clients/*, the Client search box. Tested by lib/clients/clients.test.ts.
// WHY THE NAME: client search; ".ts" = no screen code.
//
// PRIVACY: a pro's search result has first name and phone only (never email). Owners and the
// Super Admin also see email. Searches are logged with the result count only, never the text.

import { and, asc, eq, ilike, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "../api-error";
import { normalizePhone } from "../auth/identifier";
import type { ShopRow } from "../booking/data";
import { getDb } from "../db/client";
import { clientProfiles, shops, users } from "../db/schema";
import type { CurrentUser } from "../types";

export type ClientSearch = { kind: "phone"; phone: string } | { kind: "text"; text: string; digits: string };
export type ClientResult = { id: string; name: string; phone: string | null; email?: string | null; shopName?: string; noShows: number };

// Decides what the user may search with. Returns a plain-English reason when the search isn't allowed.
export function parseClientSearch(role: CurrentUser["role"], q: string): { ok: true; search: ClientSearch } | { ok: false; reason: string } {
  const text = q.trim();
  if (role === "pro") {
    const phone = normalizePhone(text);
    return phone ? { ok: true, search: { kind: "phone", phone } } : { ok: false, reason: "Search by the client's full phone number, for example (212) 555-0111." };
  }
  if (role === "owner" || role === "super_admin") {
    if (text.length < 2 || text.length > 60) return { ok: false, reason: "Type at least 2 characters of a name or phone number." };
    return { ok: true, search: { kind: "text", text, digits: text.replace(/\D/g, "") } };
  }
  return { ok: false, reason: "You don't have access to client search." };
}

// Runs the search. "shopIds" are the shops this user may search (one shop for a pro or owner;
// every allowed shop for the Super Admin). At most 25 results.
export async function searchClients(user: CurrentUser, search: ClientSearch, shopIds: string[]): Promise<ClientResult[]> {
  if (shopIds.length === 0) return [];
  const db = getDb();
  const match =
    search.kind === "phone"
      ? eq(users.phone, search.phone)
      : or(ilike(users.name, `%${search.text.replace(/[%_\\]/g, "\\$&")}%`), ...(search.digits.length >= 3 ? [ilike(users.phone, `%${search.digits}%`)] : []));
  const rows = await db
    .select({ id: users.id, name: users.name, phone: users.phone, email: users.email, shopName: shops.name, noShows: clientProfiles.noShowCount })
    .from(users)
    .innerJoin(shops, eq(shops.id, users.shopId))
    .leftJoin(clientProfiles, eq(clientProfiles.userId, users.id))
    .where(and(eq(users.role, "client"), inArray(users.shopId, shopIds), match))
    .orderBy(asc(users.name))
    .limit(25);
  return rows.map((r) =>
    user.role === "pro"
      ? { id: r.id, name: r.name, phone: r.phone, noShows: r.noShows ?? 0 }
      : { id: r.id, name: r.name, phone: r.phone, email: r.email, shopName: user.role === "super_admin" ? r.shopName : undefined, noShows: r.noShows ?? 0 },
  );
}

// What adding a client needs: a first name and a phone number.
export const newClientInput = z
  .object({
    name: z.string().trim().min(1, "Enter the client's first name.").max(40),
    phone: z.string().trim().min(7).max(30),
  })
  .strict();

// Adds a client to a shop (no password yet, so they can't log in until they set one up).
// Demo shops get demo clients, so a demo reset removes them.
export async function addClient(shop: ShopRow, input: z.infer<typeof newClientInput>): Promise<ClientResult> {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new ApiError(400, "BAD_PHONE", "Enter a 10-digit phone number.");
  const db = getDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone));
  if (existing) throw new ApiError(409, "PHONE_TAKEN", "A client with that phone number already exists. Search for them instead.");
  const [row] = await db
    .insert(users)
    .values({ shopId: shop.id, role: "client", name: input.name, phone, isDemo: shop.isDemo })
    .returning({ id: users.id, name: users.name, phone: users.phone });
  await db.insert(clientProfiles).values({ userId: row!.id });
  return { id: row!.id, name: row!.name, phone: row!.phone, noShows: 0 };
}
