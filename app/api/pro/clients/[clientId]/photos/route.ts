// app/api/pro/clients/[clientId]/photos/route.ts
// WHAT IT'S FOR: POST /api/pro/clients/<id>/photos uploads a photo to the logged-in pro's style
// card for one of their own clients. Send it as form data: "file" (JPG, PNG or WebP, up to 4 MB)
// and an optional "caption" (up to 120 characters). The file's real type is checked from its
// contents. Someone else's client answers 404.
// WHO USES IT: the photo section of the style card editor.
// WHY THE NAME: folder path = URL (/api/pro/clients/<id>/photos).
//
// PRIVACY: logs style_card_photo_added with IDs and the size only, never the caption.

import { ApiError } from "@/lib/api-error";
import { uuidOr404 } from "@/lib/auth/guards";
import { requirePro } from "@/lib/auth/pro-context";
import { log } from "@/lib/logger";
import { uploadPhoto } from "@/lib/photos/data";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const POST = withLogging<{ params: Promise<{ clientId: string }> }>("/api/pro/clients/[clientId]/photos", async (request, { params }) => {
  const { user, shop } = await requirePro();
  const clientId = uuidOr404((await params).clientId);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "BAD_PHOTO", "Choose a photo to upload.");
  const captionRaw = form?.get("caption");
  const caption = typeof captionRaw === "string" && captionRaw.trim() ? captionRaw.trim().slice(0, 120) : null;

  const photo = await uploadPhoto(user.id, shop.id, clientId, file, caption);
  log.info("style_card_photo_added", { userId: user.id, shopId: shop.id, clientId, photoId: photo.id, sizeBytes: file.size });
  return Response.json({ photo: { id: photo.id, caption: photo.caption, createdAt: photo.createdAt } }, { status: 201 });
});
