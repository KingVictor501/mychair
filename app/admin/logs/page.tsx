// app/admin/logs/page.tsx
// WHAT IT'S FOR: the log viewer, at /admin/logs. The app's structured log lines, newest first,
// filtered by level (Debug, Info, Warn, Error), event name, route, shop and time range. Each line
// opens to show its details. The filters are a plain form, so the URL can be bookmarked.
// Only a real Super Admin can open it.
// WHO USES IT: the Super Admin.
// WHY THE NAME: folder path = URL (/admin/logs).
//
// PRIVACY: log lines were already cleaned when they were written (lib/redact.ts), so they hold
// IDs and facts, never passwords, emails or phones. Details are shown as text, never as HTML.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AdminLocked from "@/components/AdminLocked";
import { listShopSummaries, searchLogs } from "@/lib/admin/data";
import { LOG_LEVELS, LOG_RANGES, parseLogFilters } from "@/lib/admin/rules";
import { canUseAdmin } from "@/lib/auth/admin-access";
import { getCurrentUser, getSessionClaims } from "@/lib/auth/current-user";
import { HOME_FOR_ROLE } from "@/lib/auth/home";

export const metadata: Metadata = { title: "Logs · MyChair", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// The look of each level, so errors and warnings stand out (colors are defined in globals.css).
const LEVEL_STYLE: Record<string, string> = {
  debug: "text-text-muted",
  info: "text-text",
  warn: "font-semibold text-level-warn",
  error: "font-semibold text-level-error",
};

export default async function LogsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [user, claims] = await Promise.all([getCurrentUser(), getSessionClaims()]);
  if (!user) redirect("/login");
  // Anyone else goes to their own home. The demo Super Admin gets a short "not in the demo" note.
  if (!canUseAdmin(user, claims)) {
    if (user.role === "super_admin") return <AdminLocked />;
    redirect(HOME_FOR_ROLE[user.role]);
  }

  const filters = parseLogFilters(await searchParams);
  const [rows, shops] = await Promise.all([searchLogs(filters), listShopSummaries()]);
  const shopName = new Map(shops.map((s) => [s.id, s.name]));

  return (
    <main className="!max-w-6xl">
      <Link href="/admin">← Super Admin</Link>
      <h1 className="!mt-2">Logs</h1>

      <form method="get" className="grid gap-2 rounded-lg border border-border bg-surface p-3 sm:grid-cols-6 sm:items-end">
        <label className="flex flex-col gap-1">
          <span>Level</span>
          <select name="level" defaultValue={filters.level ?? ""}>
            <option value="">Any</option>
            {LOG_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l[0]!.toUpperCase() + l.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span>Event</span>
          <input name="event" defaultValue={filters.event ?? ""} placeholder="request_failed" />
        </label>
        <label className="flex flex-col gap-1">
          <span>Route</span>
          <input name="route" defaultValue={filters.route ?? ""} placeholder="/api/appointments" />
        </label>
        <label className="flex flex-col gap-1">
          <span>Shop</span>
          <select name="shop" defaultValue={filters.shopId ?? ""}>
            <option value="">Any</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span>Time</span>
          <select name="range" defaultValue={filters.range}>
            {Object.entries(LOG_RANGES).map(([k, r]) => (
              <option key={k} value={k}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="debug" value="1" defaultChecked={!filters.hideDebug} />
            <span>Include debug</span>
          </label>
          <button type="submit">Filter</button>
        </div>
      </form>

      <p className="text-sm">
        {rows.length === 200 ? "Newest 200 lines" : `${rows.length} ${rows.length === 1 ? "line" : "lines"}`} · newest first. Logs are kept 14 days.
      </p>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-3">No log lines match. Try a longer time range or fewer filters.</p>
      ) : (
        <ul className="!list-none !p-0 grid gap-1">
          {rows.map((r) => (
            <li key={r.id} className="rounded border border-border bg-bg">
              <details>
                <summary className="flex cursor-pointer flex-wrap gap-x-3 gap-y-1 px-3 py-2 text-sm">
                  <span className="font-mono text-xs text-text-muted">{new Date(r.ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" })}</span>
                  <span className={`w-12 uppercase ${LEVEL_STYLE[r.level] ?? ""}`}>{r.level}</span>
                  <span className="font-mono text-text">{r.event}</span>
                  {r.route && <span className="font-mono text-text-muted">{r.route}</span>}
                  {r.shopId && <span className="text-text-muted">{shopName.get(r.shopId) ?? "shop"}</span>}
                </summary>
                {/* JSON shown as plain text; React escapes it, so nothing in a log line can run. */}
                <pre className="!m-0 overflow-x-auto border-t border-border bg-surface px-3 py-2 text-xs">
                  {JSON.stringify({ requestId: r.requestId, userId: r.userId, shopId: r.shopId, details: r.details }, null, 2)}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
