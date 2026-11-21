// components/MetricsDashboard.tsx
// WHAT IT'S FOR: the interactive part of the /metrics page. You type the admin key, pick a time
// range, and see summary numbers plus three charts: requests, server errors, and latency
// (median and 95th percentile). Data comes from GET /api/admin/metrics.
// Every state is shown: locked, loading, error, empty (no requests in the range), and data.
// WHO USES IT: app/metrics/page.tsx.
// WHY THE NAME: the metrics "dashboard"; ".tsx" = screen code.
//
// SAFETY: the key is kept only in this page's memory and sent only in the x-admin-key header.

"use client";

import { useState, type FormEvent } from "react";
// LineChart (components/LineChart.tsx) draws each chart. The types come from lib/metrics.ts.
import LineChart from "./LineChart";
import { RANGE_KEYS, type MetricsRange, type MetricsResponse } from "@/lib/metrics";

type State =
  | { kind: "locked" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: MetricsResponse };

const RANGE_LABEL: Record<MetricsRange, string> = { "1h": "Last hour", "24h": "Last 24 hours", "7d": "Last 7 days" };

// Shows the dashboard.
export default function MetricsDashboard() {
  const [adminKey, setAdminKey] = useState("");
  const [range, setRange] = useState<MetricsRange>("24h");
  const [state, setState] = useState<State>({ kind: "locked" });

  // Loads the numbers for one range.
  async function load(nextRange: MetricsRange) {
    setRange(nextRange);
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/api/admin/metrics?range=${nextRange}`, { headers: { "x-admin-key": adminKey } });
      if (res.status === 401) return setState({ kind: "error", message: "That admin key didn't work." });
      if (!res.ok) return setState({ kind: "error", message: "Metrics couldn't be loaded right now. Try again in a minute." });
      setState({ kind: "ready", data: (await res.json()) as MetricsResponse });
    } catch {
      setState({ kind: "error", message: "Couldn't reach the server. Check your connection and try again." });
    }
  }

  function onUnlock(event: FormEvent) {
    event.preventDefault();
    void load(range);
  }

  // Time labels: hour and minute for short ranges, the date for 7 days.
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString(undefined, range === "7d" ? { month: "short", day: "numeric" } : { hour: "numeric", minute: "2-digit" });

  if (state.kind === "locked" || (state.kind === "error" && !adminKey)) {
    return (
      <form onSubmit={onUnlock} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1">
          <span>Admin key</span>
          <input type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} autoComplete="off" required />
        </label>
        <button type="submit">Show metrics</button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Range picker: one row above the charts. */}
      <div role="group" aria-label="Time range" className="flex flex-wrap gap-2">
        {RANGE_KEYS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => void load(r)}
            aria-pressed={r === range}
            className={r === range ? "!bg-text !text-bg" : ""}
          >
            {RANGE_LABEL[r]}
          </button>
        ))}
      </div>

      {state.kind === "loading" && (
        <div aria-busy className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      )}

      {state.kind === "error" && (
        <div role="alert" className="rounded-lg border border-border bg-surface p-3">
          <p className="m-0 text-text">{state.message}</p>
          <button type="button" className="mt-2" onClick={() => setState({ kind: "locked" })}>
            Enter the key again
          </button>
        </div>
      )}

      {state.kind === "ready" && <MetricsBody data={state.data} formatTime={formatTime} />}
    </div>
  );
}

// The summary numbers and the three charts (or the empty state).
function MetricsBody({ data, formatTime }: { data: MetricsResponse; formatTime: (iso: string) => string }) {
  const { summary, points } = data;
  if (summary.requests === 0) {
    return (
      <p className="rounded-lg border border-border bg-surface p-3">
        No requests in this range yet. Open a page on the site or try a longer range.
      </p>
    );
  }
  const times = points.map((p) => p.t);
  const ms = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`);
  const whole = (v: number) => String(Math.round(v));

  return (
    <>
      <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Requests" value={whole(summary.requests)} />
        <Stat label="Server errors" value={`${summary.errors} (${summary.error_rate_pct}%)`} />
        <Stat label="Median (p50)" value={summary.p50_ms === null ? "–" : ms(summary.p50_ms)} />
        <Stat label="Slowest 5% (p95)" value={summary.p95_ms === null ? "–" : ms(summary.p95_ms)} />
      </dl>
      <LineChart
        title="Requests"
        times={times}
        series={[{ name: "Requests", color: "var(--color-series-1)", values: points.map((p) => p.requests) }]}
        formatValue={whole}
        formatTime={formatTime}
      />
      <LineChart
        title="Server errors (status 500 or more)"
        times={times}
        series={[{ name: "Errors", color: "var(--color-series-1)", values: points.map((p) => p.errors) }]}
        formatValue={whole}
        formatTime={formatTime}
      />
      <LineChart
        title="Response time"
        times={times}
        series={[
          { name: "p50", color: "var(--color-series-1)", values: points.map((p) => p.p50_ms) },
          { name: "p95", color: "var(--color-series-2)", values: points.map((p) => p.p95_ms) },
        ]}
        formatValue={ms}
        formatTime={formatTime}
      />
      <p className="m-0 text-xs">Updated {new Date(data.generated_at).toLocaleTimeString()}. Times are in your time zone.</p>
    </>
  );
}

// One summary number.
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="m-0 text-lg font-semibold text-text">{value}</dd>
    </div>
  );
}
