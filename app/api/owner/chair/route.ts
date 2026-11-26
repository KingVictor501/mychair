// app/api/owner/chair/route.ts
// WHAT IT'S FOR: the owner's own chair.
//   POST   { title }  "Take appointments myself": the owner gets a pro profile, the shop's
//                     services at standard prices and starting hours (lib/owner/chair.ts), and
//                     can then use /pro like any pro. Running it twice changes nothing.
//   DELETE           "Stop taking appointments": refused (409) while they have upcoming
//                     appointments.
// Only the shop's owner, for their own account: the user ID comes from the session, never from
// the request, so one owner can't switch on someone else's chair.
// WHO USES IT: components/OwnerChair.tsx on /owner.
// WHY THE NAME: folder path = URL (/api/owner/chair).
//
// PRIVACY: logs owner_chair_changed with IDs and true/false only.

import { ApiError } from "@/lib/api-error";
import { requireOwner } from "@/lib/auth/owner-context";
import { log } from "@/lib/logger";
import { startChair, stopChair } from "@/lib/owner/chair";
import { chairInput } from "@/lib/owner/rules";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const POST = withLogging("/api/owner/chair", async (request) => {
  const { user, shop } = await requireOwner();
  const parsed = chairInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, "BAD_TITLE", parsed.error.issues[0]?.message ?? "Check the title.");
  const { created } = await startChair(shop, user.id, parsed.data.title);
  if (created) log.info("owner_chair_changed", { userId: user.id, shopId: shop.id, takesAppointments: true });
  return Response.json({ takesAppointments: true }, { status: created ? 201 : 200 });
});

export const DELETE = withLogging("/api/owner/chair", async () => {
  const { user, shop } = await requireOwner();
  const { removed } = await stopChair(shop, user.id);
  if (removed) log.info("owner_chair_changed", { userId: user.id, shopId: shop.id, takesAppointments: false });
  return Response.json({ takesAppointments: false });
});
