// lib/db.ts
// WHAT IT'S FOR: the one place that opens a connection to the Neon Postgres database.
// WHO USES IT: app/api/health/route.ts now; every API route that needs data later.
// WHY THE NAME: "db" = database; ".ts" because it is plain logic with no screen code.

// "neon" comes from @neondatabase/serverless (the package we installed). It gives us a
// function that sends SQL (database questions) to Neon over HTTPS, which suits Vercel's
// short-lived serverless functions.
import { neon } from "@neondatabase/serverless";

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
