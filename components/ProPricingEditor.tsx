// components/ProPricingEditor.tsx
// WHAT IT'S FOR: the owner's price editor for one pro. Pick "Standard price" (the shop's price
// list) or "Custom prices", and type a custom price per service (blank = standard). Saves with
// PUT /api/owner/pros/<pro ID>/pricing and shows saving, saved and error states.
// WHO USES IT: app/owner/pros/[proId]/page.tsx.
// WHY THE NAME: the pro pricing editor; ".tsx" = screen code.

"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { money } from "@/lib/format";

type Service = { id: string; name: string; durationMin: number; standardCents: number; customCents: number | null };
type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

// "35.00" from 3500 cents (blank for none), for the price boxes.
const toDollars = (cents: number | null) => (cents === null ? "" : (cents / 100).toFixed(2));

export default function ProPricingEditor({ proId, proName, initialMode, services }: { proId: string; proName: string; initialMode: string; services: Service[] }) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode === "custom" ? "custom" : "standard");
  const [prices, setPrices] = useState<Record<string, string>>(Object.fromEntries(services.map((s) => [s.id, toDollars(s.customCents)])));
  const [save, setSave] = useState<SaveState>({ kind: "idle" });

  // Turns the boxes into cents (blank = standard). Returns an error message for a bad box.
  function readPrices(): { ok: true; list: Array<{ serviceId: string; priceCents: number | null }> } | { ok: false; message: string } {
    const list: Array<{ serviceId: string; priceCents: number | null }> = [];
    for (const s of services) {
      const raw = (prices[s.id] ?? "").trim().replace(/^\$/, "");
      if (raw === "") {
        list.push({ serviceId: s.id, priceCents: null });
        continue;
      }
      if (!/^\d{1,4}(\.\d{1,2})?$/.test(raw)) return { ok: false, message: `Check the price for ${s.name} (for example 35 or 35.50).` };
      list.push({ serviceId: s.id, priceCents: Math.round(Number(raw) * 100) });
    }
    return { ok: true, list };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const read = readPrices();
    if (!read.ok) return setSave({ kind: "error", message: read.message });
    setSave({ kind: "saving" });
    try {
      const res = await fetch(`/api/owner/pros/${proId}/pricing`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ priceMode: mode, prices: read.list }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message: string } };
        return setSave({ kind: "error", message: body.error?.message ?? "Couldn't save. Try again." });
      }
      setSave({ kind: "saved" });
      router.refresh();
    } catch {
      setSave({ kind: "error", message: "Couldn't reach the server. Try again." });
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <fieldset className="grid gap-2 rounded-lg border border-border p-3">
        <legend className="px-1 font-semibold text-text">How {proName} is priced</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="mode" value="standard" checked={mode === "standard"} onChange={() => setMode("standard")} />
          <span>Standard price (the shop&apos;s price list)</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="mode" value="custom" checked={mode === "custom"} onChange={() => setMode("custom")} />
          <span>Custom prices</span>
        </label>
      </fieldset>

      {services.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-3">{proName} doesn&apos;t offer any services yet.</p>
      ) : (
        <ul className="!list-none !p-0 grid gap-2">
          {services.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-bg p-3">
              <span>
                <span className="block font-semibold text-text">{s.name}</span>
                <span className="block text-sm">
                  {s.durationMin} min · standard {money(s.standardCents)}
                </span>
              </span>
              <label className="flex items-center gap-2">
                <span className="text-sm">Custom $</span>
                <input
                  value={prices[s.id] ?? ""}
                  onChange={(e) => setPrices({ ...prices, [s.id]: e.target.value })}
                  inputMode="decimal"
                  placeholder={toDollars(s.standardCents)}
                  disabled={mode === "standard"}
                  aria-label={`Custom price for ${s.name}`}
                  className="w-24"
                />
              </label>
            </li>
          ))}
        </ul>
      )}
      {mode === "standard" && <p className="!my-0 text-sm">With Standard price on, clients see the standard prices. Custom prices are kept for when you switch back.</p>}
      {mode === "custom" && <p className="!my-0 text-sm">Leave a box blank to use the standard price for that service.</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={save.kind === "saving"}>
          {save.kind === "saving" ? "Saving…" : "Save prices"}
        </button>
        <span role="status" className="text-sm">
          {save.kind === "saved" ? "Saved." : ""}
        </span>
      </div>
      {save.kind === "error" && (
        <p role="alert" className="!my-0 text-sm text-text">
          {save.message}
        </p>
      )}
    </form>
  );
}
