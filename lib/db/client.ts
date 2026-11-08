// lib/db/client.ts
// WHAT IT'S FOR: the one place that opens a connection to the Neon Postgres database.
// WHO USES IT: app/api/health/route.ts, lib/logger.ts, scripts/migrate.ts, and every API
// route that needs data later.
// WHY THE NAME: it creates the database "client" (the thing that sends questions to the
// database); it lives in lib/db/ next to schema.ts; ".ts" = no screen code.
// (It used to be lib/db.ts. It moved here so all database files sit together.)

// "neon" comes from @neondatabase/serverless: it sends SQL (database questions) to Neon over
// HTTPS, which suits Vercel's short-lived serverless functions.
import { neon } from "@neondatabase/serverless";
// "drizzle" comes from drizzle-orm: it wraps the connection so we can write queries in TypeScript.
import { drizzle } from "drizzle-orm/neon-http";

// Returns a function you can use like:  const rows = await sql`SELECT 1`;
// The connection string is read from the DATABASE_URL environment variable, so the secret
// is never written in the code. Locally it comes from .env.local; on Vercel, from the dashboard.
export function getSql() {
  const url = process.env.DATABASE_URL;

  // Stop early with a clear message if the variable is missing or empty.
  // This message names the variable only; it never prints the value.
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  return neon(url);
}

// Returns the Drizzle database object, for typed queries like db.insert(logEntries).values(...).
// Callers import the table they need from lib/db/schema.ts. (The latest Drizzle release
// candidate no longer takes a "schema" setting here; that job moved to "relations", which we
// don't need yet.)
export function getDb() {
  return drizzle({ client: getSql() });
}
