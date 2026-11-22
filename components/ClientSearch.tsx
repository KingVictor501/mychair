// components/ClientSearch.tsx
// WHAT IT'S FOR: the Client search box. A pro types a caller's full phone number to find them and
// book them in; if nobody has that number, the pro can add the caller as a new client (first name
// and phone). Owners and the Super Admin can also search by name (handled by the same API).
// Uses GET /api/clients/search and POST /api/clients.
// WHO USES IT: app/pro/clients/page.tsx (phone only) and app/owner/page.tsx (name or phone).
// WHY THE NAME: client search; ".tsx" = screen code.

"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { ClientResult } from "@/lib/clients/search";

type State = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "results"; clients: ClientResult[] };

export default function ClientSearch({ mode }: { mode: "phone" | "any" }) {
  const [q, setQ] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });

  async function search(event: FormEvent) {
    event.preventDefault();
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/api/clients/search?q=${encodeURIComponent(q)}`);
      const body = (await res.json()) as { clients?: ClientResult[]; error?: { message: string } };
      if (!res.ok || !body.clients) return setState({ kind: "error", message: body.error?.message ?? "Search didn't work." });
      setState({ kind: "results", clients: body.clients });
    } catch {
      setState({ kind: "error", message: "Couldn't reach the server. Try again." });
    }
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    setAdding({ busy: true, error: null });
    try {
      const res = await fetch("/api/clients", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: newName, phone: q }) });
      const body = (await res.json()) as { client?: ClientResult; error?: { message: string } };
      if (!res.ok || !body.client) return setAdding({ busy: false, error: body.error?.message ?? "Couldn't add the client." });
      setAdding({ busy: false, error: null });
      setNewName("");
      setState({ kind: "results", clients: [body.client] });
    } catch {
      setAdding({ busy: false, error: "Couldn't reach the server. Try again." });
    }
  }

  return (
    <section aria-label="Client search" className="mb-6 rounded-lg border border-border bg-surface p-4">
      <h2 className="!mt-0">Client search</h2>
      <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1">
          <span>{mode === "phone" ? "Client's phone number" : "Name or phone number"}</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} inputMode={mode === "phone" ? "tel" : "text"} placeholder={mode === "phone" ? "(212) 555-0111" : "Name or number"} required />
        </label>
        <button type="submit" disabled={state.kind === "loading"}>
          {state.kind === "loading" ? "Searching…" : "Search"}
        </button>
      </form>
      {mode === "phone" && <p className="!mb-0 !mt-1 text-xs">Search by the full phone number, for a client who calls to book.</p>}

      {state.kind === "error" && (
        <p role="alert" className="!mb-0 text-sm text-text">
          {state.message}
        </p>
      )}

      {state.kind === "results" && state.clients.length > 0 && (
        <ul className="!mb-0 !mt-3 !list-none !p-0 grid gap-2">
          {state.clients.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-bg p-3">
              <span>
                <span className="block font-semibold text-text">{c.name}</span>
                <span className="block text-sm">
                  {c.phone ?? "No phone"}
                  {c.shopName ? ` · ${c.shopName}` : ""}
                  {c.noShows > 0 ? ` · ${c.noShows} no-show${c.noShows === 1 ? "" : "s"}` : ""}
                </span>
              </span>
              {mode === "phone" && (
                <Link href={`/pro/book/${c.id}`} className="rounded border border-border px-3 py-1 !no-underline">
                  Book {c.name}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      {state.kind === "results" && state.clients.length === 0 && (
        <div className="mt-3">
          <p className="!mt-0 text-sm">No client has that number.</p>
          {mode === "phone" && (
            <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="flex flex-1 flex-col gap-1">
                <span>Add as a new client: first name</span>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={40} required />
              </label>
              <button type="submit" disabled={adding.busy}>
                {adding.busy ? "Adding…" : "Add client"}
              </button>
            </form>
          )}
          {adding.error && (
            <p role="alert" className="!mb-0 text-sm text-text">
              {adding.error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
