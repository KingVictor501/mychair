// app/demo/page.tsx
// WHAT IT'S FOR: the public demo page, at /demo, for showing MyChair to buyers. While demo mode
// is on, each demo shop has one-click buttons to open its owner's view or a pro's view, with no
// sign-up or password. Every demo page then shows a "Demo" banner. While demo mode is off, it
// says "Demo not available".
// WHO USES IT: anyone (buyers, classmates, graders).
// WHY THE NAME: folder path = URL (/demo).

import type { Metadata } from "next";
import Link from "next/link";
import SwitchSessionButton from "@/components/SwitchSessionButton";
import { listDemoViews } from "@/lib/demo/entry";
import { isDemoModeOn } from "@/lib/demo/mode";

export const metadata: Metadata = { title: "Demo · MyChair" };
export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = { barbershop: "Barbershop", nail_salon: "Nail salon", lash_studio: "Lash studio" };

export default async function DemoPage() {
  const on = await isDemoModeOn();
  const shops = on ? await listDemoViews() : [];

  return (
    <main className="!max-w-3xl">
      <Link href="/">← Home</Link>
      <h1 className="!mt-2 !mb-1">MyChair demo</h1>
      {!on ? (
        <p className="rounded-lg border border-border bg-surface p-3">Demo not available right now. Please check back later.</p>
      ) : shops.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-3">The demo shops aren&apos;t set up yet. Please check back later.</p>
      ) : (
        <>
          <p className="!mt-0">Three made-up shops with three months of bookings. Open any view in one click: no account or password. Everything here is demo data.</p>
          {shops.map((s) => (
            <section key={s.id} aria-label={s.name} className="mb-4 rounded-lg border border-border bg-bg p-4">
              <h2 className="!mt-0 !mb-1">{s.name}</h2>
              <p className="!mt-0 text-sm">{TYPE_LABEL[s.businessType] ?? s.businessType}</p>
              <div className="flex flex-wrap gap-2">
                {s.owner && <SwitchSessionButton url="/api/demo/enter" userId={s.owner.id} label={`See the owner view (${s.owner.name})`} />}
                {s.pros.map((p) => (
                  <SwitchSessionButton key={p.id} url="/api/demo/enter" userId={p.id} label={`See ${p.name}'s pro view`} />
                ))}
              </div>
            </section>
          ))}
          <p className="text-sm">
            Or try booking as a customer: <Link href="/guest">Book without an account</Link>.
          </p>
        </>
      )}
    </main>
  );
}
