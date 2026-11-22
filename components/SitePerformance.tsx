// components/SitePerformance.tsx
// WHAT IT'S FOR: the Site performance panel. For each page, the Core Web Vitals from real visits
// over the last 7 days (the 75th-percentile value: 3 in 4 visits were at least this good), each
// labeled Good, Needs work or Poor in words and color, plus how many readings it's based on.
// Loading isn't needed (the server reads it before the page is sent); it has empty and data states.
// WHO USES IT: app/metrics/page.tsx, for a real Super Admin only.
// WHY THE NAME: site performance; ".tsx" = screen code. A server component.

import type { PageVitals } from "@/lib/vitals-data";
import { formatVital, rateVital, VITAL_NAMES, VITALS } from "@/lib/vitals";

const RATING = {
  good: { label: "Good", style: "text-rating-good" },
  "needs-improvement": { label: "Needs work", style: "text-level-warn" },
  poor: { label: "Poor", style: "font-semibold text-level-error" },
} as const;

export default function SitePerformance({ pages }: { pages: PageVitals[] }) {
  return (
    <section aria-label="Site performance" className="mt-8">
      <h2>Site performance</h2>
      <p className="!mt-0 text-sm">From real visits in the last 7 days. Each number is what 3 in 4 visits were at least as good as.</p>
      <dl className="mb-3 grid gap-1 text-xs sm:grid-cols-2">
        {VITAL_NAMES.map((n) => (
          <div key={n}>
            <dt className="inline font-semibold text-text">{VITALS[n].label}:</dt> <dd className="!m-0 inline">{VITALS[n].help}</dd>
          </div>
        ))}
      </dl>
      {pages.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-3">No readings yet. Open a few pages on the site and check back in a minute.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs text-text-muted">
              <tr>
                <th scope="col" className="px-3 py-2">Page</th>
                {VITAL_NAMES.map((n) => (
                  <th key={n} scope="col" className="px-3 py-2">{VITALS[n].label}</th>
                ))}
                <th scope="col" className="px-3 py-2">Visits</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pages.map((p) => (
                <tr key={p.page}>
                  <th scope="row" className="px-3 py-2 font-mono text-xs font-normal text-text">{p.page}</th>
                  {VITAL_NAMES.map((n) => {
                    const v = p.values[n];
                    if (v === undefined) return <td key={n} className="px-3 py-2 text-text-muted">–</td>;
                    const r = RATING[rateVital(n, v)];
                    return (
                      <td key={n} className="px-3 py-2">
                        <span className="block text-text">{formatVital(n, v)}</span>
                        <span className={`block text-xs ${r.style}`}>{r.label}</span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-text-muted">{p.samples}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
