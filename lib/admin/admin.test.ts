// lib/admin/admin.test.ts
// WHAT IT'S FOR: automated checks of the Super Admin pages' rules (no database): reading the log
// viewer's filters from the URL safely, and only allowing https:// stack links. Run with `npm test`.
// WHY THE NAME: tests for lib/admin/.

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLogFilters, safeLink } from "./rules";

test("log filters are read safely from the URL", () => {
  const f = parseLogFilters({ level: "error", event: " request_failed ", route: "/api/appointments", range: "7d" });
  assert.equal(f.level, "error");
  assert.equal(f.event, "request_failed", "trimmed");
  assert.equal(f.rangeHours, 24 * 7);
  assert.equal(f.hideDebug, true, "debug hidden unless asked for");
  const bad = parseLogFilters({ level: "loud", range: "forever", shop: "not-an-id", event: "x".repeat(500) });
  assert.equal(bad.level, null, "an unknown level is ignored");
  assert.equal(bad.range, "24h", "an unknown range falls back to 24 hours");
  assert.equal(bad.shopId, null);
  assert.equal(bad.event?.length, 80, "long text is capped");
  assert.equal(parseLogFilters({ debug: "1" }).hideDebug, false);
});

test("stack links must be https:// addresses", () => {
  assert.equal(safeLink("https://console.neon.tech/app/projects"), "https://console.neon.tech/app/projects");
  assert.equal(safeLink("javascript:alert(1)"), null);
  assert.equal(safeLink("http://example.com"), null);
  assert.equal(safeLink("not a url"), null);
  assert.equal(safeLink(undefined), null);
});
