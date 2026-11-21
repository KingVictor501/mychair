// app/api/pros/[id]/route.ts
// WHAT IT'S FOR: GET /api/pros/<id> returns one pro's public profile, the services they offer
// at their prices, and the dates a client can pick. A client sees their style-card time
// estimate for their usual service. Pay details are never included.
// WHO USES IT: the pro booking page and the future mobile app.
// WHY THE NAME: folder path = URL; "[id]" is the pro's ID in the URL.

import { getCurrentUser } from "@/lib/auth/current-user";
import { loadProFor } from "@/lib/auth/guards";
import { requireUser } from "@/lib/auth/permissions";
import { bookableDates, listProServices } from "@/lib/booking/data";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const GET = withLogging<{ params: Promise<{ id: string }> }>("/api/pros/[id]", async (_request, { params }) => {
  const user = requireUser(await getCurrentUser());
  const { pro, shop } = await loadProFor(user, (await params).id);
  const services = await listProServices(pro.id, pro.priceMode, user.role === "client" ? user.id : undefined);
  const dates = bookableDates(shop).map((d) => `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`);
  return Response.json({
    pro: { id: pro.id, name: pro.name, title: pro.title, bio: pro.bio, liveStatus: pro.liveStatus },
    shop: { id: shop.id, name: shop.name, timezone: shop.timezone, cancellationWindowHours: shop.cancellationWindowHours },
    services,
    dates,
  });
});
