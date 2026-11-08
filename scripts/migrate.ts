// scripts/migrate.ts
// WHAT IT'S FOR: applies the migration files in /drizzle to the database, creating or changing
// tables. Safe to run again: it only applies the migrations not yet applied.
// WHO USES IT: `npm run db:migrate` (you, against your DEVELOPMENT database), and `npm run build`
// (so a Vercel production deploy updates the PRODUCTION database automatically).
// WHY THE NAME: a "script" is a one-off command-line program (not part of the website),
// so it sits in /scripts; ".ts" = no screen code.
//
// SAFETY RULES:
//  - On Vercel it runs ONLY for production deploys. Preview deploys skip it, so a test deploy
//    can never change the live database.
//  - It uses whatever DATABASE_URL is set: .env.local on your computer (development branch),
//    or Vercel's setting (production branch). It never prints the connection string.

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
// The migrator applies the SQL files in the "drizzle" folder.
import { migrate } from "drizzle-orm/neon-http/migrator";
import { log } from "../lib/logger";

// Load .env.local for local runs (built into Node). Does not overwrite variables already set.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local (for example on Vercel). That's fine.
}

async function main(): Promise<void> {
  // On Vercel, "VERCEL_ENV" says production / preview / development.
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv && vercelEnv !== "production") {
    log.info("migrate_skipped", { reason: "not a production deploy", vercelEnv });
    return;
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    // Fail loudly: a deploy without a database address should not go live half-working.
    throw new Error("DATABASE_URL is not set");
  }

  log.info("migrate_start", { target: vercelEnv ?? "local" });
  const db = drizzle({ client: neon(url) });
  await migrate(db, { migrationsFolder: "./drizzle" });
  log.info("migrate_done", { target: vercelEnv ?? "local" });
}

main().catch((error: unknown) => {
  // Only the (cleaned by the logger) message. Never the whole error, which could hold the address.
  log.error("migrate_failed", { message: error instanceof Error ? error.message : "unknown" });
  process.exit(1);
});
