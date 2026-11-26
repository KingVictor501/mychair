// components/OwnerChair.tsx
// WHAT IT'S FOR: the "Your chair" box on the owner dashboard. An owner who also cuts, does nails
// or lashes turns on "Take appointments myself" here. Once it's on, the box links to their own
// schedule (/pro), their prices, and has a "Stop taking appointments" button.
// Saving goes through /api/owner/chair; the server decides everything (this only shows it).
// WHO USES IT: app/owner/page.tsx.
// WHY THE NAME: the owner's chair; ".tsx" = screen code. "use client" because it has a form,
// buttons and "Saving…" states.

"use client";

import Link from "next/link";
// useRouter().refresh() reloads the server parts of the page, so the team list and header
// links update without a full page reload.
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Props = { ownerId: string; takesAppointments: boolean; title: string | null; suggestedTitle: string };
type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string };

export default function OwnerChair({ ownerId, takesAppointments, title, suggestedTitle }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState(suggestedTitle);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });

  // Sends the change and refreshes the page, or shows the server's message.
  async function send(method: "POST" | "DELETE", body?: unknown) {
    setSave({ kind: "saving" });
    try {
      const res = await fetch("/api/owner/chair", { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: { message: string } };
        return setSave({ kind: "error", message: data.error?.message ?? "Couldn't save. Try again." });
      }
      setSave({ kind: "idle" });
      router.refresh();
    } catch {
      setSave({ kind: "error", message: "Couldn't reach the server. Try again." });
    }
  }

  // Turns the chair on with the title typed in.
  function start(e: FormEvent) {
    e.preventDefault();
    void send("POST", { title: draft });
  }

  // Turns the chair off, after a yes from the owner.
  function stop() {
    if (window.confirm("Stop taking appointments? Clients won't be able to book you until you turn it back on.")) void send("DELETE");
  }

  const saving = save.kind === "saving";
  return (
    <section aria-label="Your chair" className="mt-6 rounded-lg border border-border bg-bg p-4">
      <h2 className="!mt-0">Your chair</h2>
      {takesAppointments ? (
        <>
          <p className="!mt-0">
            You take appointments as <strong>{title}</strong>. Clients can book you like any pro on your team.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/pro" className="rounded-md !bg-text px-3 py-2 text-sm font-semibold !text-bg !no-underline">
              Open my schedule
            </Link>
            <Link href="/pro/clients" className="text-sm">
              My clients
            </Link>
            <Link href={`/owner/pros/${ownerId}`} className="text-sm">
              Set my prices
            </Link>
            <button type="button" onClick={stop} disabled={saving} className="!py-1.5 text-sm">
              {saving ? "Saving…" : "Stop taking appointments"}
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={start} className="grid gap-2 sm:max-w-md">
          <p className="!mt-0">Do you also take clients? Turn this on to get your own schedule, clients and style cards, next to the owner view.</p>
          <label htmlFor="chair-title" className="text-sm font-semibold text-text">
            Your title (what clients see)
          </label>
          <input id="chair-title" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={40} required />
          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Take appointments myself"}
          </button>
          <p className="!m-0 text-xs">You start with every service at the standard price and your team&apos;s usual hours.</p>
        </form>
      )}
      {save.kind === "error" && (
        <p role="alert" className="!mb-0 text-sm text-level-error">
          {save.message}
        </p>
      )}
    </section>
  );
}
