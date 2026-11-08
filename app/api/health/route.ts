// app/api/health/route.ts
// WHAT IT'S FOR: the health check. Visiting /api/health answers "is the app alive, and can
// it reach the database?"
// WHO USES IT: components/HealthStatus.tsx (the hello page), you in the browser or Postman,
//              and later the host/uptime tools.
// WHY THE NAME: in Next.js's App Router the FOLDER path becomes the URL (app/api/health ->
// /api/health), and a file named "route.ts" means "this is an API route, not a page".

// getSql comes from lib/db/client.ts: it opens the database connection using DATABASE_URL.
import { getSql } from "@/lib/db/client";
// ApiError comes from lib/api-error.ts: a safe error with a friendly message for the visitor.
import { ApiError } from "@/lib/api-error";
// log comes from lib/logger.ts: our structured logger (never console.log).
import { log } from "@/lib/logger";
// withLogging comes from lib/with-logging.ts: it logs request_start / request_done / request_failed.
import { withLogging } from "@/lib/with-logging";
import type { HealthResponse } from "@/lib/types";

// Never cache this answer: a health check must ask the database every single time.
export const dynamic = "force-dynamic";

// Handles GET requests (a browser visiting the URL is a GET).
export const GET = withLogging("/api/health", async () => {
  // A deliberately noisy debug line to prove dev and live are separate: it prints on your
  // computer (LOG_LEVEL=debug) but never on the live site (LOG_LEVEL=info).
  log.debug("health_debug_probe", { note: "dev-only noise" });

  try {
    const sql = getSql();
    // The simplest possible database question: "what is 1?" If Neon answers, it is reachable.
    await sql`SELECT 1`;
  } catch (cause) {
    // The visitor gets a short safe message and a 503 ("service unavailable").
    // The real reason (like "connect ECONNREFUSED") travels as the "cause" and is logged
    // as request_failed by withLogging, with secrets removed.
    throw new ApiError(503, "DB_UNREACHABLE", "Database unreachable", { cause });
  }

  const body: HealthResponse = { status: "ok" };
  return Response.json(body);
});
