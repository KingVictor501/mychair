// lib/vitals-data.ts
// WHAT IT'S FOR: reads the saved Core Web Vitals for the Site performance panel: for each page,
// the 75th-percentile value of each measure (the number Google uses: 3 in 4 visits were at least
// this good) and how many readings it's based on, over the last few days.
// WHO USES IT: app/metrics/page.tsx (only for a real Super Admin).
// WHY THE NAME: web vitals data; ".ts" = no screen code.

import { and, gte, sql } from "drizzle-orm";
import { getDb } from "./db/client";
import { webVitals } from "./db/schema";
import { VITAL_NAMES, type VitalName } from "./vitals";

export type PageVitals = { page: string; samples: number; values: Partial<Record<VitalName, number>> };

// Pages with readings in the last "days" days, the busiest first.
export async function pageVitals(days = 7): Promise<PageVitals[]> {
  const rows = await getDb()
    .select({
      page: webVitals.page,
      name: webVitals.name,
      p75: sql<number>`percentile_cont(0.75) within group (order by ${webVitals.value})`,
      n: sql<number>`count(*)::int`,
    })
    .from(webVitals)
    .where(and(gte(webVitals.ts, new Date(Date.now() - days * 24 * 60 * 60 * 1000))))
    .groupBy(webVitals.page, webVitals.name);
  const pages = new Map<string, PageVitals>();
  for (const r of rows) {
    const p = pages.get(r.page) ?? { page: r.page, samples: 0, values: {} };
    if ((VITAL_NAMES as readonly string[]).includes(r.name)) p.values[r.name as VitalName] = Number(r.p75);
    p.samples = Math.max(p.samples, Number(r.n));
    pages.set(r.page, p);
  }
  return [...pages.values()].sort((a, b) => b.samples - a.samples);
}
