// lib/pro/lifecycle.ts
// WHAT IT'S FOR: the rules for moving an appointment along, kept apart from the database so
// they can be tested exactly:
//   waiting  -> in_chair   (the client sat down; records check-in and chair time)
//   waiting  -> no_show    (they didn't come; adds one no-show strike to the client)
//   waiting  -> cancelled  (the shop cancelled it)
//   in_chair -> completed  (finished; needs a payment status: paid, deposit_held or cash)
// Completed, no-show and cancelled are final.
// Also: who may change an appointment (its own pro, the shop's owner, or the Super Admin), and
// the style-card input rules.
// WHO USES IT: lib/pro/data.ts, the pro routes. Tested by lib/pro/pro.test.ts.
// WHY THE NAME: the appointment "lifecycle"; ".ts" = no screen code.

import { z } from "zod";
import { worksAsPro } from "../auth/permissions";
import type { CurrentUser } from "../types";

export const APPOINTMENT_STATUSES = ["waiting", "in_chair", "completed", "no_show", "cancelled"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export const PAYMENT_STATUSES = ["paid", "deposit_held", "cash"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const LIVE_STATUSES = ["available", "with_client", "unavailable"] as const;

// The allowed next steps from each status.
const NEXT: Record<AppointmentStatus, AppointmentStatus[]> = {
  waiting: ["in_chair", "no_show", "cancelled"],
  in_chair: ["completed"],
  completed: [],
  no_show: [],
  cancelled: [],
};

// True if an appointment may move from "from" to "to".
export function canTransition(from: string, to: AppointmentStatus): boolean {
  return (NEXT[from as AppointmentStatus] ?? []).includes(to);
}

// The next steps offered on screen for an appointment in this status.
export function nextSteps(from: string): AppointmentStatus[] {
  return NEXT[from as AppointmentStatus] ?? [];
}

// True if this user may change this appointment: the pro it belongs to, an owner of that shop,
// or the Super Admin. (The shop itself is checked separately with assertShopAccess.)
export function canManageAppointment(user: CurrentUser, appointment: { proId: string; shopId: string }): boolean {
  if (user.role === "super_admin") return true;
  if (user.role === "owner") return user.shopId === appointment.shopId;
  if (user.role === "pro") return user.id === appointment.proId;
  return false;
}

// True if a pro (or an owner who takes appointments) may book a client onto "target" pro's calendar: always for themselves; for
// another pro only in the same shop, and only if that pro turned on "Let other pros book for me".
export function canBookFor(booker: CurrentUser, target: { id: string; shopId: string | null; allowOthersToBook: boolean }): boolean {
  if (!worksAsPro(booker) || !booker.shopId || booker.shopId !== target.shopId) return false;
  return booker.id === target.id || target.allowOthersToBook;
}

// What the pro settings form may send.
export const proSettingsInput = z.object({ allowOthersToBook: z.boolean() }).strict();

// True if this user may VIEW a style card (and its photos):
//   - the Super Admin, or an owner of that shop: every card,
//   - the pro who owns the card,
//   - another pro in the same shop, at any time, if the client is also their client
//     ("viewerHasClient"), so they can see how the client likes it before they sit down.
// Editing stays with the card's own pro.
export function canViewCard(user: CurrentUser, card: { proId: string; shopId: string }, viewerHasClient: boolean): boolean {
  if (user.role === "super_admin") return true;
  if (user.role === "owner") return user.shopId === card.shopId;
  if (user.role !== "pro" || user.shopId !== card.shopId) return false;
  return user.id === card.proId || viewerHasClient;
}

// What a status change request may contain.
export const statusChangeInput = z
  .object({
    status: z.enum(["in_chair", "completed", "no_show", "cancelled"]),
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  })
  .strict()
  .refine((v) => v.status !== "completed" || v.paymentStatus !== undefined, {
    message: "Pick how it was paid (paid, deposit held or cash).",
    path: ["paymentStatus"],
  });

// What a style card may contain. Preferences are short labeled notes ("guard": "#2 on the
// sides"); limits keep them small. The time estimate is the usual service's length in minutes.
export const styleCardInput = z
  .object({
    preferences: z
      .record(z.string().trim().min(1).max(40), z.string().trim().max(200))
      .refine((p) => Object.keys(p).length <= 12, { message: "Up to 12 preferences." }),
    notes: z.string().trim().max(2000),
    usualServiceId: z.string().uuid().nullable(),
    timeEstimateMin: z.number().int().min(5).max(480).nullable(),
  })
  .strict();

export type StyleCardInput = z.infer<typeof styleCardInput>;
