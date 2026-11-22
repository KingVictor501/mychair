// lib/auth/super-admin.ts
// WHAT IT'S FOR: creating the real Super Admin account (me, the developer) from settings, never
// from code: SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD and (optional) SUPER_ADMIN_NAME.
//   superAdminSettings  reads and checks the settings (no database, so it's tested exactly)
//   ensureSuperAdmin    creates the account, or, if that email is already the Super Admin,
//                       updates the name and password. Safe to run again.
// It refuses an email that belongs to anyone else (a client, a pro, a demo account), so it can
// never turn an existing person into a Super Admin by accident.
// WHO USES IT: scripts/create-super-admin.ts (npm run admin:create, development database) and
// app/api/admin/super-admin/route.ts (the live site, with the admin key).
// WHY THE NAME: the Super Admin account; ".ts" = no screen code.

import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { users } from "../db/schema";
import { hashPassword } from "./password";

export type SuperAdminSettings = { email: string; password: string; name: string };

// Reads the three settings. Returns a plain-English reason if one is missing or too weak.
export function superAdminSettings(env: Record<string, string | undefined>): { ok: true; settings: SuperAdminSettings } | { ok: false; reason: string } {
  const email = env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const password = env.SUPER_ADMIN_PASSWORD ?? "";
  const name = env.SUPER_ADMIN_NAME?.trim() || "Admin";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, reason: "Set SUPER_ADMIN_EMAIL to your email address." };
  if (password.length < 12) return { ok: false, reason: "Set SUPER_ADMIN_PASSWORD to at least 12 characters." };
  if (name.length > 40) return { ok: false, reason: "Keep SUPER_ADMIN_NAME under 40 characters." };
  return { ok: true, settings: { email, password, name } };
}

// Creates or updates the Super Admin. Returns the account's ID and whether it was new.
export async function ensureSuperAdmin(s: SuperAdminSettings): Promise<{ id: string; created: boolean }> {
  const db = getDb();
  const passwordHash = await hashPassword(s.password);
  const [existing] = await db.select({ id: users.id, role: users.role, isDemo: users.isDemo }).from(users).where(eq(users.email, s.email));
  if (existing) {
    if (existing.role !== "super_admin" || existing.isDemo) throw new Error("That email already belongs to another account. Use a different SUPER_ADMIN_EMAIL.");
    await db.update(users).set({ name: s.name, passwordHash }).where(eq(users.id, existing.id));
    return { id: existing.id, created: false };
  }
  const [row] = await db.insert(users).values({ role: "super_admin", shopId: null, name: s.name, email: s.email, passwordHash, isDemo: false }).returning({ id: users.id });
  return { id: row!.id, created: true };
}
