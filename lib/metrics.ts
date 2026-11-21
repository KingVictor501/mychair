// lib/metrics.ts
// WHAT IT'S FOR: the rules for the metrics view (requests, server errors and latency over time),
// kept apart from the database so they can be tested with plain numbers:
//   - the three time ranges and how big each time bucket is,
//   - filling in empty buckets with zeros, so a quiet hour shows as 0 instead of a gap.
// WHO USES IT: lib/metrics-data.ts, app/api/admin/metrics/route.ts,
// components/MetricsDashboard.tsx (the types), and lib/metrics.test.ts.
// WHY THE NAME: it's about "metrics"; ".ts" = plain logic, no screen code.

// The ranges the page offers. "unit" is the Postgres date_trunc unit for one bucket.
export const RANGES = {
  "1h": { unit: "minute", spanMs: 60 * 60 * 1000, stepMs: 60 * 1000 },
  "24h": { unit: "hour", spanMs: 24 * 60 * 60 * 1000, stepMs: 60 * 60 * 1000 },
  "7d": { unit: "day", spanMs: 7 * 24 * 60 * 60 * 1000, stepMs: 24 * 60 * 60 * 1000 },
} as const;

export type MetricsRange = keyof typeof RANGES;
export const RANGE_KEYS = Object.keys(RANGES) as MetricsRange[];

// One bucket as it comes from the database (only buckets that had requests).
export type BucketRow = { bucket: string; requests: number; errors: number; p50: number | null; p95: number | null };

// One point on the charts. "t" is the bucket's start time (ISO, UTC).
export type MetricsPoint = { t: string; requests: number; errors: number; p50_ms: number | null; p95_ms: number | null };

// What GET /api/admin/metrics returns.
export type MetricsResponse = {
  range: MetricsRange;
  generated_at: string;
  summary: { requests: number; errors: number; error_rate_pct: number; p50_ms: number | null; p95_ms: number | null };
  points: MetricsPoint[];
};

// The start of the bucket that "date" falls in, in UTC (same as Postgres date_trunc in UTC).
export function bucketStart(date: Date, range: MetricsRange): Date {
  const d = new Date(date);
  d.setUTCSeconds(0, 0);
  if (range !== "1h") d.setUTCMinutes(0);
  if (range === "7d") d.setUTCHours(0);
  return d;
}

// Turns the database rows into one point per bucket across the whole range, oldest first.
// Buckets with no requests become zeros (and no latency), so the chart has no missing times.
export function fillBuckets(rows: BucketRow[], range: MetricsRange, now: Date): MetricsPoint[] {
  const { spanMs, stepMs } = RANGES[range];
  const byTime = new Map(rows.map((r) => [new Date(r.bucket).getTime(), r]));
  const last = bucketStart(now, range).getTime();
  const count = Math.round(spanMs / stepMs);
  const points: MetricsPoint[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const t = last - i * stepMs;
    const row = byTime.get(t);
    points.push({
      t: new Date(t).toISOString(),
      requests: row?.requests ?? 0,
      errors: row?.errors ?? 0,
      p50_ms: row?.p50 == null ? null : Math.round(row.p50),
      p95_ms: row?.p95 == null ? null : Math.round(row.p95),
    });
  }
  return points;
}

// Errors as a percentage of requests, rounded to 2 places (0 when there were no requests).
export function errorRatePct(requests: number, errors: number): number {
  return requests === 0 ? 0 : Math.round((errors / requests) * 10000) / 100;
}
