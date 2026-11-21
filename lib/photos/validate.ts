// lib/photos/validate.ts
// WHAT IT'S FOR: deciding whether an uploaded file is an acceptable style-card photo.
//   - Only JPG, PNG and WebP. The type is decided by the file's first bytes (its "signature"),
//     not by its name or the type the browser claims, so an SVG or a script renamed to
//     "photo.jpg" is refused. SVG is never allowed because it can carry scripts.
//   - At most 4 MB (Vercel refuses request bodies over 4.5 MB, so 4 MB leaves room).
//   - Up to 12 photos per style card.
// WHO USES IT: lib/photos/data.ts. Tested by lib/photos/photos.test.ts.
// WHY THE NAME: photo validation; ".ts" = no screen code.

export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
export const MAX_PHOTOS_PER_CARD = 12;

export type PhotoType = { contentType: "image/jpeg" | "image/png" | "image/webp"; extension: "jpg" | "png" | "webp" };

// Reads the first bytes and returns the real image type, or null if it isn't JPG, PNG or WebP.
export function detectImageType(bytes: Uint8Array): PhotoType | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (starts([0xff, 0xd8, 0xff])) return { contentType: "image/jpeg", extension: "jpg" };
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { contentType: "image/png", extension: "png" };
  // WebP: "RIFF" + 4 size bytes + "WEBP"
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return { contentType: "image/webp", extension: "webp" };
  return null;
}

// Checks a file's size and contents. Returns the real type, or a plain-English reason to refuse.
export function checkPhoto(bytes: Uint8Array, existingCount: number): { ok: true; type: PhotoType } | { ok: false; reason: string } {
  if (existingCount >= MAX_PHOTOS_PER_CARD) return { ok: false, reason: `A style card can hold up to ${MAX_PHOTOS_PER_CARD} photos. Remove one first.` };
  if (bytes.length === 0) return { ok: false, reason: "That file is empty." };
  if (bytes.length > MAX_PHOTO_BYTES) return { ok: false, reason: "Photos can be up to 4 MB. Try a smaller one." };
  const type = detectImageType(bytes);
  if (!type) return { ok: false, reason: "Only JPG, PNG or WebP photos can be uploaded." };
  return { ok: true, type };
}
