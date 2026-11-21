// app/api/photos/[id]/route.ts
// WHAT IT'S FOR: one style-card photo.
//   GET    /api/photos/<id>  shows the image to the card's pro, an owner of that shop, the Super
//                            Admin, or another pro on a day the client is booked with them.
//                            Photos are in private storage, so this route is the only way to see one.
//   DELETE /api/photos/<id>  removes it (the card's pro, an owner of that shop, or the Super Admin).
// Anyone else, or a made-up ID, gets 404.
// WHO USES IT: the photo grid on the style card (<img src="/api/photos/<id>">).
// WHY THE NAME: folder path = URL; "[id]" is the photo's ID.
//
// PRIVACY: the browser is told not to keep a shared copy (Cache-Control: private, no-store).

import { getCurrentUser } from "@/lib/auth/current-user";
import { uuidOr404 } from "@/lib/auth/guards";
import { assertShopAccess, requireRole } from "@/lib/auth/permissions";
import { getShop } from "@/lib/booking/data";
import { log } from "@/lib/logger";
import { deletePhoto, findPhoto, readPhotoFor } from "@/lib/photos/data";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Shared first steps: who is asking, and may they reach this photo's shop at all?
async function access(ctx: Ctx) {
  const user = requireRole(await getCurrentUser(), "pro", "owner", "super_admin");
  const id = uuidOr404((await ctx.params).id);
  const photo = await findPhoto(id);
  const shop = photo ? await getShop(photo.shopId) : null;
  assertShopAccess(user, shop);
  return { user, id, shop };
}

export const GET = withLogging<Ctx>("/api/photos/[id]", async (_request, ctx) => {
  const { user, id, shop } = await access(ctx);
  const { stream, contentType } = await readPhotoFor(user, id, shop);
  return new Response(stream, {
    headers: { "content-type": contentType, "cache-control": "private, no-store", "x-content-type-options": "nosniff" },
  });
});

export const DELETE = withLogging<Ctx>("/api/photos/[id]", async (_request, ctx) => {
  const { user, id } = await access(ctx);
  await deletePhoto(user, id);
  log.info("style_card_photo_deleted", { userId: user.id, photoId: id });
  return Response.json({ ok: true });
});
