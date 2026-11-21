// lib/photos/data.ts
// WHAT IT'S FOR: style-card photos: saving them to private file storage (Vercel Blob), listing
// them, reading one back for an allowed viewer, and deleting them.
//   uploadPhoto      a pro adds a photo to their card for one of their own clients
//   listPhotos       the photos on a card (IDs and captions only; never a storage address)
//   readPhotoFor     the image itself, for the card's pro, an owner of that shop, the Super Admin,
//                    or another pro on a day the client is booked with them
//   deletePhoto      removes the file from storage and its row
//   deleteBlobs      removes stored files by address (used when demo data is removed)
// The storage is PRIVATE: files can't be opened by URL. They're only served by /api/photos/<id>
// after the permission check. Uses BLOB_READ_WRITE_TOKEN; without it, uploads say photo storage
// isn't set up yet.
// WHO USES IT: app/api/pro/clients/[clientId]/photos, app/api/photos/[id], lib/demo/seed.ts.
// WHY THE NAME: photo data; ".ts" = no screen code.
//
// PRIVACY: photos of clients are personal. Logs hold photo and card IDs only, never captions.

// put saves a file, get reads a private file back, del deletes; all from Vercel's Blob package.
import { del, get, put } from "@vercel/blob";
import { and, asc, count, eq } from "drizzle-orm";
import { ApiError } from "../api-error";
import { getDb } from "../db/client";
import { styleCardPhotos, styleCards } from "../db/schema";
import type { ShopRow } from "../booking/data";
import { bookedWithToday, isMyClient } from "../pro/data";
import { canViewCard } from "../pro/lifecycle";
import type { CurrentUser } from "../types";
import { checkPhoto } from "./validate";

export type PhotoSummary = { id: string; caption: string | null; createdAt: string };

// True if photo storage is configured on this server.
export function photoStorageReady(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function requireStorage(): void {
  if (!photoStorageReady()) throw new ApiError(503, "PHOTOS_NOT_SET_UP", "Photo storage isn't set up yet.");
}

// The pro's card for this client, created empty if it doesn't exist yet. Returns its ID.
async function ensureCard(proId: string, shopId: string, clientId: string): Promise<string> {
  const db = getDb();
  await db.insert(styleCards).values({ shopId, proId, clientId }).onConflictDoNothing({ target: [styleCards.proId, styleCards.clientId] });
  const [card] = await db.select({ id: styleCards.id }).from(styleCards).where(and(eq(styleCards.proId, proId), eq(styleCards.clientId, clientId)));
  return card!.id;
}

// Saves a photo to the pro's style card for one of their own clients.
export async function uploadPhoto(proId: string, shopId: string, clientId: string, file: File, caption: string | null) {
  if (!(await isMyClient(proId, clientId))) throw new ApiError(404, "NOT_FOUND", "Not found.");
  requireStorage();
  const db = getDb();
  const cardId = await ensureCard(proId, shopId, clientId);
  const [existing] = await db.select({ n: count() }).from(styleCardPhotos).where(eq(styleCardPhotos.styleCardId, cardId));

  // Size is checked before reading the whole file into memory.
  if (file.size > 4 * 1024 * 1024 + 1) throw new ApiError(400, "BAD_PHOTO", "Photos can be up to 4 MB. Try a smaller one.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkPhoto(bytes, Number(existing?.n ?? 0));
  if (!check.ok) throw new ApiError(400, "BAD_PHOTO", check.reason);

  // The stored name never uses the uploaded file's name; addRandomSuffix makes it unguessable.
  const blob = await put(`style-cards/${shopId}/${cardId}/photo.${check.type.extension}`, Buffer.from(bytes), {
    access: "private",
    addRandomSuffix: true,
    contentType: check.type.contentType,
  });
  const [row] = await db
    .insert(styleCardPhotos)
    .values({ styleCardId: cardId, shopId, proId, pathname: blob.pathname, contentType: check.type.contentType, sizeBytes: bytes.length, caption })
    .returning({ id: styleCardPhotos.id, caption: styleCardPhotos.caption, createdAt: styleCardPhotos.createdAt });
  return { id: row!.id, caption: row!.caption, createdAt: row!.createdAt.toISOString(), cardId };
}

// The photos on a card, oldest first.
export async function listPhotos(cardId: string): Promise<PhotoSummary[]> {
  const rows = await getDb()
    .select({ id: styleCardPhotos.id, caption: styleCardPhotos.caption, createdAt: styleCardPhotos.createdAt })
    .from(styleCardPhotos)
    .where(eq(styleCardPhotos.styleCardId, cardId))
    .orderBy(asc(styleCardPhotos.createdAt));
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

// Who may DELETE a photo: the card's own pro, an owner of that shop, or the Super Admin.
// (The route also runs assertShopAccess, which keeps demo accounts inside demo shops.)
function mayHandle(user: CurrentUser, photo: { proId: string; shopId: string }): boolean {
  if (user.role === "super_admin") return true;
  if (user.role === "owner") return user.shopId === photo.shopId;
  if (user.role === "pro") return user.id === photo.proId;
  return false;
}

// The photo row (with the card's client), or null. Used by the routes to find the shop before
// the access check.
export async function findPhoto(photoId: string) {
  const [row] = await getDb()
    .select({ id: styleCardPhotos.id, shopId: styleCardPhotos.shopId, proId: styleCardPhotos.proId, pathname: styleCardPhotos.pathname, contentType: styleCardPhotos.contentType, clientId: styleCards.clientId })
    .from(styleCardPhotos)
    .innerJoin(styleCards, eq(styleCards.id, styleCardPhotos.styleCardId))
    .where(eq(styleCardPhotos.id, photoId));
  return row ?? null;
}

// Reads the image for an allowed viewer: the same people who may view the card
// (lib/pro/lifecycle.ts canViewCard), including another pro on a day the client is booked with
// them. Not found and not allowed look the same (404).
export async function readPhotoFor(user: CurrentUser, photoId: string, shop: ShopRow): Promise<{ stream: ReadableStream<Uint8Array>; contentType: string }> {
  const photo = await findPhoto(photoId);
  const bookedToday = Boolean(photo && user.role === "pro" && user.id !== photo.proId && (await bookedWithToday(user.id, photo.clientId, shop)));
  if (!photo || !canViewCard(user, photo, bookedToday)) throw new ApiError(404, "NOT_FOUND", "Not found.");
  requireStorage();
  const result = await get(photo.pathname, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) throw new ApiError(404, "NOT_FOUND", "Not found.");
  return { stream: result.stream, contentType: photo.contentType };
}

// Deletes a photo: the file from storage, then its row.
export async function deletePhoto(user: CurrentUser, photoId: string): Promise<void> {
  const photo = await findPhoto(photoId);
  if (!photo || !mayHandle(user, photo)) throw new ApiError(404, "NOT_FOUND", "Not found.");
  requireStorage();
  await del(photo.pathname);
  await getDb().delete(styleCardPhotos).where(eq(styleCardPhotos.id, photoId));
}

// Deletes stored files by address. Does nothing if storage isn't set up or there's nothing to delete.
export async function deleteBlobs(pathnames: string[]): Promise<void> {
  if (pathnames.length === 0 || !photoStorageReady()) return;
  await del(pathnames);
}
