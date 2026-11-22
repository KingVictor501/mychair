// lib/vitals.ts
// WHAT IT'S FOR: site performance (Core Web Vitals) rules that need no database, so they're
// tested exactly:
//   VITALS           the five measures, with plain-English names and Google's good/poor limits
//   vitalInput       what a browser may send to POST /api/vitals
//   pagePattern      turns an address into a page pattern: no ?query, and IDs become [id], so
//                    every client's page counts as one page and no ID is stored
//   rateVital        good / needs work / poor for a value
// WHO USES IT: app/api/vitals/route.ts, lib/vitals-data.ts, app/metrics. Tested by lib/vitals.test.ts.
// WHY THE NAME: web vitals; ".ts" = no screen code.

import { z } from "zod";

export const VITAL_NAMES = ["LCP", "INP", "CLS", "FCP", "TTFB"] as const;
export type VitalName = (typeof VITAL_NAMES)[number];

// Plain names, units, and the limits Google uses (web.dev): at or under "good" is good, over
// "poor" is poor, in between needs work.
export const VITALS: Record<VitalName, { label: string; help: string; unit: "ms" | "score"; good: number; poor: number }> = {
  LCP: { label: "Page load", help: "Time until the main content shows", unit: "ms", good: 2500, poor: 4000 },
  INP: { label: "Responsiveness", help: "Delay after a tap or click", unit: "ms", good: 200, poor: 500 },
  CLS: { label: "Layout shift", help: "How much things jump while loading", unit: "score", good: 0.1, poor: 0.25 },
  FCP: { label: "First content", help: "Time until anything shows", unit: "ms", good: 1800, poor: 3000 },
  TTFB: { label: "Server response", help: "Time until the server answers", unit: "ms", good: 800, poor: 1800 },
};

export type VitalRating = "good" | "needs-improvement" | "poor";

// One reading from a browser. Values are capped so nobody can store nonsense.
export const vitalInput = z
  .object({
    name: z.enum(VITAL_NAMES),
    value: z.number().min(0).max(120_000),
    rating: z.enum(["good", "needs-improvement", "poor"]),
    page: z.string().min(1).max(300),
  })
  .strip(); // the browser sends extra fields (id, delta, entries); they're dropped, never stored

// "/pro/clients/83eb…?x=1" -> "/pro/clients/[id]". Anything that isn't a path becomes "/".
export function pagePattern(raw: string): string {
  const path = raw.split(/[?#]/)[0] ?? "/";
  if (!path.startsWith("/")) return "/";
  return path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[id]").slice(0, 120) || "/";
}

// Good, needs work or poor for a value, using the limits above.
export function rateVital(name: VitalName, value: number): VitalRating {
  const v = VITALS[name];
  return value <= v.good ? "good" : value > v.poor ? "poor" : "needs-improvement";
}

// "1.8 s", "180 ms" or "0.04", for showing a value.
export function formatVital(name: VitalName, value: number): string {
  if (VITALS[name].unit === "score") return value.toFixed(2);
  return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${Math.round(value)} ms`;
}
