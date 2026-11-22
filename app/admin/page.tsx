// app/admin/page.tsx
// WHAT IT'S FOR: the Super Admin dashboard, at /admin:
//   - demo controls: the "Demo mode: on / off" switch and "Reset demo"
//   - every shop: type, demo or real, pros, clients, today's appointments, this month's revenue,
//     and "View as" buttons for the owner and each pro (every "view as" is logged)
//   - links to the log viewer, metrics, the /demo page, and the stack's own dashboards
// Only a real Super Admin can open it (not the demo Super Admin, and not during "view as").
// WHO USES IT: the Super Admin.
// WHY THE NAME: folder path = URL (/admin).

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AdminLocked from "@/components/AdminLocked";
import AdminDemoControls from "@/components/AdminDemoControls";
import SwitchSessionButton from "@/components/SwitchSessionButton";
import { listShopSummaries, stackLinks } from "@/lib/admin/data";
import { canUseAdmin } from "@/lib/auth/admin-access";
import { getCurrentUser, getSessionClaims } from "@/lib/auth/current-user";
import { HOME_FOR_ROLE } from "@/lib/auth/home";
import { isDemoModeOn } from "@/lib/demo/mode";
import { money } from "@/lib/format";
import { shopTheme } from "@/lib/theme";
import Breadcrumbs from "@/components/Breadcrumbs";

export const metadata: Metadata = { title: "Super Admin · MyChair", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = { barbershop: "Barbershop", nail_salon: "Nail salon", lash_studio: "Lash studio" };

export default async function AdminHome() {
  const [user, claims] = await Promise.all([getCurrentUser(), getSessionClaims()]);
  if (!user) redirect("/login");
  // Anyone else goes to their own home. The demo Super Admin gets a short "not in the demo" note.
  if (!canUseAdmin(user, claims)) {
    if (user.role === "super_admin") return <AdminLocked />;
    redirect(HOME_FOR_ROLE[user.role]);
  }

  const [shops, demoOn] = await Promise.all([listShopSummaries(), isDemoModeOn()]);
  const links = stackLinks();

  return (
    <main className="!max-w-5xl">
      <Breadcrumbs items={[{ label: "Super Admin" }]} />
      <h1 className="!mb-1">Super Admin</h1>
      <p className="!mt-0">Hi, {user.name}. Everything across every shop.</p>

      <nav aria-label="Admin tools" className="flex flex-wrap gap-4">
        <Link href="/admin/logs">Logs</Link>
        <Link href="/metrics">Metrics</Link>
        <Link href="/demo">Demo page</Link>
      </nav>

      <section aria-label="Demo" className="mt-6 rounded-lg border border-border bg-surface p-4">
        <h2 className="!mt-0">Demo</h2>
        <p className="!mt-0 text-sm">On: /demo lets visitors open the demo owner and pro views with one click, and demo logins work. Off: both stop; the demo shops are kept.</p>
        <AdminDemoControls demoModeOn={demoOn} />
      </section>

      <section aria-label="Shops" className="mt-6">
        <h2>Shops</h2>
        {shops.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface p-3">No shops yet. Run the demo seed or create a shop.</p>
        ) : (
          <ul className="!list-none !p-0 grid gap-3">
            {shops.map((s) => (
              <li key={s.id} data-shop={shopTheme(s.businessType)} className="shop-accent rounded-lg border border-border bg-bg p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-lg font-semibold text-text">
                    {s.name}
                    {s.isDemo && <span className="ml-2 rounded border border-border px-1 text-xs font-normal">Demo</span>}
                  </span>
                  <span className="text-sm text-text-muted">
                    {TYPE_LABEL[s.businessType] ?? s.businessType} · {s.timezone}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-text-muted">Pros</dt>
                    <dd className="!m-0 font-semibold text-text">{s.pros}</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Clients</dt>
                    <dd className="!m-0 font-semibold text-text">{s.clients}</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Today</dt>
                    <dd className="!m-0 font-semibold text-text">{s.todayAppointments} appointments</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">This month</dt>
                    <dd className="!m-0 font-semibold text-text">{money(s.monthRevenueCents)}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap items-start gap-2">
                  <span className="pt-1 text-sm text-text-muted">View as:</span>
                  {s.people.length === 0 && <span className="pt-1 text-sm">No owner or pros yet.</span>}
                  {s.people.map((p) => (
                    <SwitchSessionButton key={p.id} url="/api/admin/view-as" userId={p.id} label={`${p.name} (${p.role === "owner" ? "owner" : (p.title ?? "pro").toLowerCase()})`} className="!py-1 text-sm" />
                  ))}
                </div>
                {s.isDemo && !demoOn && <p className="!mb-0 text-xs">Turn demo mode on to view as demo accounts.</p>}
              </li>
            ))}
          </ul>
        )}
        <p className="!mt-1 text-xs">Every &quot;view as&quot; is logged (view_as_started and view_as_ended) and ends after an hour.</p>
      </section>

      <section aria-label="Stack links" className="mt-6">
        <h2>Stack</h2>
        {links.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface p-3 text-sm">No stack links set yet. Add the STACK_URL_* settings (see .env.example) in Vercel to show them here.</p>
        ) : (
          <ul className="!list-none !p-0 flex flex-wrap gap-3">
            {links.map((l) => (
              <li key={l.label}>
                <a href={l.url} target="_blank" rel="noopener noreferrer">
                  {l.label} ↗
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

    </main>
  );
}
