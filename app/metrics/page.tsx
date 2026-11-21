// app/metrics/page.tsx
// WHAT IT'S FOR: the metrics page, shown at /metrics. Requests, server errors and response
// times over time, read from the app's own log table. Unlocks with the admin key.
// WHO USES IT: Next.js shows it when someone visits /metrics.
// WHY THE NAME: folder name = URL ("app/metrics" -> /metrics); "page.tsx" = the page for that folder.

import type { Metadata } from "next";
// MetricsDashboard (components/MetricsDashboard.tsx) is the interactive part: key, range, charts.
import MetricsDashboard from "@/components/MetricsDashboard";

// Ask search engines not to list this admin page.
export const metadata: Metadata = {
  title: "Metrics",
  robots: { index: false, follow: false },
};

// A server component: it lays out the heading and drops in the interactive dashboard.
export default function MetricsPage() {
  return (
    <main className="!max-w-3xl">
      <h1>Metrics</h1>
      <p>Requests, server errors and response times, from the app&apos;s own request logs.</p>
      <MetricsDashboard />
    </main>
  );
}
