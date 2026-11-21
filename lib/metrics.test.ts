// lib/metrics.test.ts
// WHAT IT'S FOR: automated checks of the metrics rules in lib/metrics.ts (no database):
// bucket boundaries, zero-filling quiet buckets, and the error rate. Run with `npm test`.
// WHY THE NAME: "<file>.test.ts" = the tests for <file>.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { bucketStart, errorRatePct, fillBuckets } from "./metrics";

const NOW = new Date("2026-11-21T20:47:33.000Z");

test("bucketStart cuts to the minute, hour or day in UTC", () => {
  assert.equal(bucketStart(NOW, "1h").toISOString(), "2026-11-21T20:47:00.000Z");
  assert.equal(bucketStart(NOW, "24h").toISOString(), "2026-11-21T20:00:00.000Z");
  assert.equal(bucketStart(NOW, "7d").toISOString(), "2026-11-21T00:00:00.000Z");
});

test("fillBuckets gives one point per bucket, oldest first, ending at the current bucket", () => {
  assert.equal(fillBuckets([], "1h", NOW).length, 60);
  const day = fillBuckets([], "24h", NOW);
  assert.equal(day.length, 24);
  assert.equal(day[0]?.t, "2026-11-20T21:00:00.000Z");
  assert.equal(day.at(-1)?.t, "2026-11-21T20:00:00.000Z");
  assert.equal(fillBuckets([], "7d", NOW).length, 7);
});

test("quiet buckets are zero with no latency; busy buckets keep their numbers", () => {
  const points = fillBuckets(
    [{ bucket: "2026-11-21T19:00:00Z", requests: 12, errors: 1, p50: 97.4, p95: 2085.6 }],
    "24h",
    NOW,
  );
  const busy = points.find((p) => p.t === "2026-11-21T19:00:00.000Z");
  assert.deepEqual(busy, { t: "2026-11-21T19:00:00.000Z", requests: 12, errors: 1, p50_ms: 97, p95_ms: 2086 });
  const quiet = points.find((p) => p.t === "2026-11-21T18:00:00.000Z");
  assert.deepEqual(quiet, { t: "2026-11-21T18:00:00.000Z", requests: 0, errors: 0, p50_ms: null, p95_ms: null });
});

test("error rate is a percentage with 2 decimals, and 0 when there were no requests", () => {
  assert.equal(errorRatePct(0, 0), 0);
  assert.equal(errorRatePct(412, 9), 2.18);
  assert.equal(errorRatePct(3, 3), 100);
});
