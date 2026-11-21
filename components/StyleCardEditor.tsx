// components/StyleCardEditor.tsx
// WHAT IT'S FOR: the form for a pro's style card on one client: labeled preferences (for example
// "Guard" = "#2 on the sides"), photos (right after the preferences), notes, the usual service
// and the time estimate in minutes. Photos save on their own as soon as they're added.
// Saves with PUT /api/pro/clients/<id>/style-card. The time estimate is used when this client
// books that service with this pro.
// WHO USES IT: app/pro/clients/[clientId]/page.tsx.
// WHY THE NAME: edits a style card; ".tsx" = screen code.

"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
// The photo grid and upload button, placed right after "Add a preference".
import StyleCardPhotos from "./StyleCardPhotos";
import type { PhotoSummary } from "@/lib/photos/data";

type Props = {
  clientId: string;
  clientName: string;
  photos: PhotoSummary[];
  storageReady: boolean;
  initial: { preferences: Record<string, string>; notes: string; usualServiceId: string | null; timeEstimateMin: number | null } | null;
  services: Array<{ id: string; name: string; durationMin: number }>;
};
type Row = { key: string; value: string };

export default function StyleCardEditor({ clientId, clientName, photos, storageReady, initial, services }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => {
    const entries = Object.entries(initial?.preferences ?? {}).map(([key, value]) => ({ key, value }));
    return entries.length ? entries : [{ key: "", value: "" }];
  });
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [usual, setUsual] = useState(initial?.usualServiceId ?? "");
  const [minutes, setMinutes] = useState(initial?.timeEstimateMin ? String(initial.timeEstimateMin) : "");
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" } | { kind: "error"; message: string }>({ kind: "idle" });

  // Updates one preference row.
  const setRow = (i: number, change: Partial<Row>) => setRows((all) => all.map((r, j) => (j === i ? { ...r, ...change } : r)));

  async function save(event: FormEvent) {
    event.preventDefault();
    setState({ kind: "saving" });
    const preferences = Object.fromEntries(rows.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value.trim()]));
    try {
      const res = await fetch(`/api/pro/clients/${clientId}/style-card`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ preferences, notes, usualServiceId: usual || null, timeEstimateMin: minutes ? Number(minutes) : null }),
      });
      const body = (await res.json()) as { error?: { message: string } };
      if (!res.ok) return setState({ kind: "error", message: body.error?.message ?? "Couldn't save." });
      setState({ kind: "saved" });
      router.refresh();
    } catch {
      setState({ kind: "error", message: "Couldn't reach the server. Try again." });
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4 rounded-lg border border-border bg-bg p-4">
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 font-semibold text-text">Preferences</legend>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-2">
            <input aria-label={`Preference ${i + 1} name`} placeholder="e.g. Guard" value={r.key} onChange={(e) => setRow(i, { key: e.target.value })} maxLength={40} />
            <input aria-label={`Preference ${i + 1} value`} placeholder="e.g. #2 on the sides" value={r.value} onChange={(e) => setRow(i, { value: e.target.value })} maxLength={200} />
            <button type="button" aria-label={`Remove preference ${i + 1}`} onClick={() => setRows((all) => (all.length > 1 ? all.filter((_, j) => j !== i) : [{ key: "", value: "" }]))} className="!px-3">
              ×
            </button>
          </div>
        ))}
        {rows.length < 12 && (
          <button type="button" onClick={() => setRows((all) => [...all, { key: "", value: "" }])} className="self-start !px-3 !py-1 text-sm">
            Add a preference
          </button>
        )}
      </fieldset>

      <StyleCardPhotos clientId={clientId} clientName={clientName} photos={photos} storageReady={storageReady} />

      <label className="flex flex-col gap-1">
        <span>Notes</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} className="rounded border border-border p-2" />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span>Usual service</span>
          <select value={usual} onChange={(e) => setUsual(e.target.value)} className="rounded border border-border bg-bg p-2">
            <option value="">None</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.durationMin} min)
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span>Time estimate (minutes)</span>
          <input type="number" min={5} max={480} step={5} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={state.kind === "saving"}>
          {state.kind === "saving" ? "Saving…" : "Save style card"}
        </button>
        {state.kind === "saved" && <span role="status">Saved.</span>}
        {state.kind === "error" && (
          <span role="alert" className="text-text">
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
