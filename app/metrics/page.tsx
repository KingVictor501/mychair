// app/metrics/page.tsx
// WHAT IT'S FOR: the metrics page, shown at /metrics. Requests, server errors and response
// times over time, read from the app's own log table. Opens straight away for a logged-in Super
// Admin; anyone else needs the admin key (the server checks either way).
// WHO USES IT: Next.js shows it when someone visits /metrics.
// WHY THE NAME: folder name = URL ("app/metrics" -> /metrics); "page.tsx" = the page for that folder.

import type { Metadata } from "next";
import Link from "next/link";
// MetricsDashboard (components/MetricsDashboard.tsx) is the interactive part: key, range, charts.
import MetricsDashboard from "@/components/MetricsDashboard";
import { canUseAdmin } from "@/lib/auth/admin-access";
import { getCurrentUser, getSessionClaims } from "@/lib/auth/current-user";

// Ask search engines not to list this admin page.
export const metadata: Metadata = {
  title: "Metrics",
  robots: { index: false, follow: false },
};

// A server component: it lays out the heading and drops in the interactive dashboard.
export default async function MetricsPage() {
  const [user, claims] = await Promise.all([getCurrentUser(), getSessionClaims()]);
  return (
    <main className="!max-w-3xl">
      <h1>Metrics</h1>
      <p>Requests, server errors and response times, from the app&apos;s own request logs.</p>
      {canUseAdmin(user, claims) && (
        <p className="!mt-0">
          <Link href="/admin">← Super Admin</Link>
        </p>
      )}
      <MetricsDashboard signedIn={canUseAdmin(user, claims)} />
    </main>
  );
}
