// app/api/admin/metrics/route.ts
// WHAT IT'S FOR: GET /api/admin/metrics?range=1h|24h|7d returns requests, server errors and
// latency over time, built from the app's own log table. Admin-key protected.
// WHO USES IT: the metrics page (/metrics, components/MetricsDashboard.tsx), and curl.
// WHY THE NAME: folder path = URL (app/api/admin/metrics -> /api/admin/metrics).
//
// PRIVACY: counts and milliseconds only.

import { z } from "zod";
import { ApiError } from "@/lib/api-error";
import { requireAdminKey } from "@/lib/admin-auth";
import { RANGE_KEYS, type MetricsRange } from "@/lib/metrics";
import { getMetrics } from "@/lib/metrics-data";
import { withLogging } from "@/lib/with-logging";

// Never cache: every call reads the latest numbers.
export const dynamic = "force-dynamic";

// The only allowed value for ?range=. Missing means the last 24 hours.
const query = z.object({ range: z.enum(RANGE_KEYS as [MetricsRange, ...MetricsRange[]]).default("24h") });

export const GET = withLogging("/api/admin/metrics", async (request) => {
  // 1. Lock: wrong or missing key stops here with a 401.
  requireAdminKey(request);

  // 2. Check the input. Anything other than 1h, 24h or 7d gets a 400.
  const parsed = query.safeParse({ range: new URL(request.url).searchParams.get("range") ?? undefined });
  if (!parsed.success) throw new ApiError(400, "BAD_RANGE", "range must be 1h, 24h or 7d.");

  // 3. Read the numbers. A database problem gives a safe message; the real reason is logged.
  try {
    return Response.json(await getMetrics(parsed.data.range));
  } catch (cause) {
    throw new ApiError(503, "METRICS_UNAVAILABLE", "Could not load metrics right now.", { cause });
  }
});
