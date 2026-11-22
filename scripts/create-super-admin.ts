// scripts/create-super-admin.ts
// WHAT IT'S FOR: npm run admin:create makes my real Super Admin account on the database in
// DATABASE_URL (.env.local = the development branch), from SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD
// and SUPER_ADMIN_NAME in .env.local. Safe to run again: it updates the name and password.
// For the live site, the same thing runs from POST /api/admin/super-admin (with the admin key),
// using the settings in Vercel. Never prints the email or password.
// WHO USES IT: me, by hand.
// WHY THE NAME: creates the Super Admin; ".ts" = a script, no screen code.

import { ensureSuperAdmin, superAdminSettings } from "../lib/auth/super-admin";
import { flushLogs, log } from "../lib/logger";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: fine if the variables are set some other way.
}

async function main(): Promise<void> {
  const read = superAdminSettings(process.env);
  if (!read.ok) {
    console.error(read.reason);
    process.exit(2);
  }
  const result = await ensureSuperAdmin(read.settings);
  log.info("super_admin_saved", { userId: result.id, created: result.created });
  await flushLogs();
  console.log(result.created ? "Super Admin account created." : "Super Admin account already existed: name and password updated.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Couldn't create the Super Admin.");
  process.exit(1);
});
