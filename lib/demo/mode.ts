// lib/demo/mode.ts
// WHAT IT'S FOR: reading and changing the "demo mode" switch. It lives in the database
// (app_settings, key "demo_mode") rather than in a Vercel setting, so it works on any host and
// the Super Admin can flip it from the dashboard. When it's off, demo sessions stop working and
// /demo shows "Demo not available".
// WHO USES IT: lib/auth/current-user.ts, the /demo page and the Super Admin demo routes.
// WHY THE NAME: demo "mode"; ".ts" = no screen code.

import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { appSettings } from "../db/schema";

const KEY = "demo_mode";

// True if demo mode is on. Off by default (no row yet = off).
export async function isDemoModeOn(): Promise<boolean> {
  const [row] = await getDb().select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, KEY));
  const value = row?.value as { enabled?: unknown } | undefined;
  return value?.enabled === true;
}

// Turns demo mode on or off. "byUserId" is the Super Admin who did it (stored as an ID only).
export async function setDemoMode(enabled: boolean, byUserId: string | null): Promise<void> {
  await getDb()
    .insert(appSettings)
    .values({ key: KEY, value: { enabled }, updatedBy: byUserId })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: { enabled }, updatedBy: byUserId, updatedAt: new Date() } });
}
