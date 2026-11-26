// lib/owner/rules.ts
// WHAT IT'S FOR: the owner view's rules that need no database, so they're tested exactly:
//   pricingInput   what a "set this pro's prices" request may contain
//   payLabel       a pro's pay structure in plain words ("Chair rent $250/mo", "Commission 45%")
//   revenueRanges  the start of today, this week (Monday) and this month, in the shop's time zone
// WHO USES IT: lib/owner/data.ts, app/api/owner/*, app/owner/*. Tested by lib/owner/owner.test.ts.
// WHY THE NAME: owner rules; ".ts" = no screen code.

import { z } from "zod";
import { addDays, localDateParts, zonedToUtc } from "../demo/time";
import { money } from "../format";

// The highest price the owner can set, in cents ($1,000), to catch typos like an extra zero.
export const MAX_PRICE_CENTS = 100_000;

// A pricing change for one pro: "standard" (the shop's price list) or "custom", plus any custom
// prices. A price of null means "use the standard price for this service".
export const pricingInput = z
  .object({
    priceMode: z.enum(["standard", "custom"]),
    prices: z
      .array(
        z
          .object({
            serviceId: z.string().uuid(),
            priceCents: z.number().int().min(0, "Prices can't be negative.").max(MAX_PRICE_CENTS, "Prices can be up to $1,000.").nullable(),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
export type PricingInput = z.infer<typeof pricingInput>;

// A pro's pay structure in plain words. Only owners and the Super Admin ever see this.
export function payLabel(payType: string | null, payAmount: number | null): string {
  if (payType === "chair_rent" && payAmount !== null) return `Chair rent ${money(payAmount)}/mo`;
  if (payType === "commission" && payAmount !== null) return `Commission ${payAmount}%`;
  return "Not set";
}

// The moments today, this week (from Monday) and this month began, in the shop's time zone.
export function revenueRanges(now: Date, timeZone: string): { today: Date; week: Date; month: Date } {
  const local = localDateParts(now, timeZone);
  // weekday: 0 = Sunday ... 6 = Saturday, so Monday is (weekday + 6) % 7 days back.
  const monday = addDays(local, -((local.weekday + 6) % 7));
  const first = addDays(local, -(local.day - 1));
  return {
    today: zonedToUtc(local, "00:00", timeZone),
    week: zonedToUtc(monday, "00:00", timeZone),
    month: zonedToUtc(first, "00:00", timeZone),
  };
}

// ---- The owner's own chair ("Take appointments myself") ----

// What clients see under the owner's name when they start taking appointments, by kind of shop.
// The owner can type something else.
export const DEFAULT_CHAIR_TITLE: Record<string, string> = {
  barbershop: "Barber",
  nail_salon: "Nail tech",
  lash_studio: "Lash artist",
};

// What a "take appointments myself" request may contain: the title clients see. Nothing else,
// so the owner can't slip in pay or prices here (prices are set on /owner/pros/<id> as usual).
export const chairInput = z
  .object({ title: z.string().trim().min(2, "Enter a title of at least 2 characters, for example Barber.").max(40, "Keep the title under 40 characters.") })
  .strict();

// One weekly hours row (work hours or a break), in the shop's local time.
export type WeeklyRule = { weekday: number; startTime: string; endTime: string; kind: string };

// The owner's starting hours: a copy of one teammate's weekly hours and breaks (they already
// match when the shop is open), or Tuesday to Saturday, 9 to 5, if nobody has hours yet.
export function startingHours(teammate: WeeklyRule[]): WeeklyRule[] {
  if (teammate.length > 0) return teammate.map(({ weekday, startTime, endTime, kind }) => ({ weekday, startTime, endTime, kind }));
  return [2, 3, 4, 5, 6].map((weekday) => ({ weekday, startTime: "09:00", endTime: "17:00", kind: "work" }));
}
