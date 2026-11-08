// app/api/health/route.ts
// WHAT IT'S FOR: the health check. Visiting /api/health answers "is the app alive, and can
// it reach the database?"
// WHO USES IT: components/HealthStatus.tsx (the hello page), you in the browser or Postman,
//              and later the host/uptime tools.
// WHY THE NAME: in Next.js's App Router the FOLDER path becomes the URL (app/api/health ->
// /api/health), and a file named "route.ts" means "this is an API route, not a page".

// getSql comes from lib/db.ts: it opens the database connection using DATABASE_URL.
import { getSql } from "@/lib/db";
// HealthResponse comes from lib/types.ts: the agreed shape of this route's answer.
import type { HealthResponse } from "@/lib/types";

// Never cache this answer: a health check must ask the database every single time.
export const dynamic = "force-dynamic";

// Handles GET requests (a browser visiting the URL is a GET).
export async function GET(): Promise<Response> {
  try {
    const sql = getSql();
    // The simplest possible database question: "what is 1?" If Neon answers, it is reachable.
    await sql`SELECT 1`;

    const body: HealthResponse = { status: "ok" };
    return Response.json(body);
  } catch {
    // We deliberately do NOT send the real error to the caller: it could reveal
    // connection details. A short generic message and a 503 ("service unavailable") is enough.
    // (Section 2 adds the logger, which will record the real reason safely for us.)
    const body: HealthResponse = {
      status: "error",
      message: "Database unreachable",
    };
    return Response.json(body, { status: 503 });
  }
}
