// lib/metrics-data.ts
// WHAT IT'S FOR: reads the metrics from the log table: for each time bucket in the chosen range,
// how many requests finished, how many were server errors (status 500 or more), and the median
// (p50) and 95th-percentile (p95) response time. Built from the request_done lines every route
// writes through lib/with-logging.ts.
// WHO USES IT: app/api/admin/metrics/route.ts.
// WHY THE NAME: it fetches the data for lib/metrics.ts; ".ts" = no screen code.
//
// PRIVACY: it reads only the event name, status number, milliseconds and time. Nothing personal.

import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "./db/client";
import { logEntries } from "./db/schema";
import { errorRatePct, fillBuckets, RANGES, type BucketRow, type MetricsRange, type MetricsResponse } from "./metrics";

// Builds the full metrics answer for one range.
export async function getMetrics(range: MetricsRange, now: Date = new Date()): Promise<MetricsResponse> {
  const db = getDb();
  const { unit, spanMs } = RANGES[range];
  const since = new Date(now.getTime() - spanMs);

  // status and ms live inside the JSON "details" column of each request_done line.
  const status = sql`(${logEntries.details}->>'status')::int`;
  const ms = sql`(${logEntries.details}->>'ms')::float`;
  // "unit" comes only from the fixed RANGES list above (never from the visitor), so it is safe
  // to place into the SQL text directly. The bucket time is formatted as ISO text in UTC.
  const bucket = sql<string>`to_char(date_trunc(${sql.raw(`'${unit}'`)}, ${logEntries.ts} at time zone 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;
  const onlyRequests = and(eq(logEntries.event, "request_done"), gte(logEntries.ts, since));

  const rows = await db
    .select({
      bucket,
      requests: sql<number>`count(*)`,
      errors: sql<number>`count(*) filter (where ${status} >= 500)`,
      p50: sql<number | null>`percentile_cont(0.5) within group (order by ${ms})`,
      p95: sql<number | null>`percentile_cont(0.95) within group (order by ${ms})`,
    })
    .from(logEntries)
    .where(onlyRequests)
    .groupBy(sql`1`);

  // The totals for the whole range (percentiles can't be added up from buckets, so ask again).
  const [total] = await db
    .select({
      requests: sql<number>`count(*)`,
      errors: sql<number>`count(*) filter (where ${status} >= 500)`,
      p50: sql<number | null>`percentile_cont(0.5) within group (order by ${ms})`,
      p95: sql<number | null>`percentile_cont(0.95) within group (order by ${ms})`,
    })
    .from(logEntries)
    .where(onlyRequests);

  // The database may hand numbers back as text, so convert carefully.
  const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
  const clean: BucketRow[] = rows.map((r) => ({
    bucket: String(r.bucket),
    requests: Number(r.requests),
    errors: Number(r.errors),
    p50: num(r.p50),
    p95: num(r.p95),
  }));
  const requests = Number(total?.requests ?? 0);
  const errors = Number(total?.errors ?? 0);
  const p50 = num(total?.p50);
  const p95 = num(total?.p95);

  return {
    range,
    generated_at: now.toISOString(),
    summary: {
      requests,
      errors,
      error_rate_pct: errorRatePct(requests, errors),
      p50_ms: p50 === null ? null : Math.round(p50),
      p95_ms: p95 === null ? null : Math.round(p95),
    },
    points: fillBuckets(clean, range, now),
  };
}
