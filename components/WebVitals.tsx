// components/WebVitals.tsx
// WHAT IT'S FOR: measures how each page performs in the visitor's own browser (Core Web Vitals:
// page load, responsiveness, layout shift, first content, server response) using Next.js's
// built-in useReportWebVitals, and sends each reading to POST /api/vitals. Shows nothing.
// WHO USES IT: app/layout.tsx, so every page is measured.
// WHY THE NAME: web vitals; ".tsx" = screen code. "use client" because it runs in the browser.

"use client";

// useReportWebVitals (from Next.js) calls our function with each measurement as it's ready.
import { useReportWebVitals } from "next/web-vitals";

type Metric = Parameters<Parameters<typeof useReportWebVitals>[0]>[0];

// Defined once, outside the component, as the Next.js docs advise: a new function on every
// render would report the same readings again.
function report(metric: Metric) {
  // Only what the panel needs: never the page's ?query, which could hold something personal.
  const body = JSON.stringify({ name: metric.name, value: metric.value, rating: metric.rating, page: window.location.pathname });
  // sendBeacon still delivers when the visitor is leaving the page; fetch is the fallback.
  if (!navigator.sendBeacon?.("/api/vitals", body)) {
    void fetch("/api/vitals", { method: "POST", body, keepalive: true }).catch(() => undefined);
  }
}

export default function WebVitals() {
  useReportWebVitals(report);
  return null;
}
