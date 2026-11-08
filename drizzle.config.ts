// drizzle.config.ts
// WHAT IT'S FOR: tells the Drizzle tool (drizzle-kit) where our table blueprint is and where to
// write the migration files. A "migration" is a small SQL file that changes the database
// (for example, "create the log_entries table").
// WHO USES IT: the command `npm run db:generate` (drizzle-kit reads this file by name).
// WHY THE NAME: drizzle-kit looks for exactly "drizzle.config.ts" in the project root.

// defineConfig comes from drizzle-kit (a dev tool). It checks our settings are spelled right.
import { defineConfig } from "drizzle-kit";

// Load .env.local if it exists, so DATABASE_URL is available when running commands in the
// terminal. Built into Node (no extra package). It never overwrites a variable that is
// already set, and on Vercel there is no file, so the error is ignored.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local here. That's fine.
}

export default defineConfig({
  // Where the blueprint of the tables lives.
  schema: "./lib/db/schema.ts",
  // Where the generated migration SQL files are written (these ARE committed to git).
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // From the environment, never written here. Only needed by commands that touch the database.
    url: process.env.DATABASE_URL ?? "",
  },
});
