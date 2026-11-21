// components/StyleCardPhotos.tsx
// WHAT IT'S FOR: the photos part of a style card: a grid of the client's photos (the finished
// cut, or styles they like), an "Add a photo" button with an optional caption, and Remove on each
// photo. Uploads go to POST /api/pro/clients/<id>/photos; images load from /api/photos/<id>,
// which checks who is asking. JPG, PNG or WebP up to 4 MB.
// WHO USES IT: components/StyleCardEditor.tsx (right after "Add a preference").
// WHY THE NAME: the style card's photos; ".tsx" = screen code.

"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { PhotoSummary } from "@/lib/photos/data";

type Props = { clientId: string; clientName: string; photos: PhotoSummary[]; storageReady: boolean };

export default function StyleCardPhotos({ clientId, clientName, photos, storageReady }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Uploads the chosen file, then refreshes the card so the new photo appears.
  async function upload(file: File) {
    setError(null);
    if (file.size > 4 * 1024 * 1024) return setError("Photos can be up to 4 MB. Try a smaller one.");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (caption.trim()) form.append("caption", caption.trim());
      const res = await fetch(`/api/pro/clients/${clientId}/photos`, { method: "POST", body: form });
      const body = (await res.json()) as { error?: { message: string } };
      if (!res.ok) return setError(body.error?.message ?? "Couldn't upload that photo.");
      setCaption("");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this photo?")) return;
    setError(null);
    const res = await fetch(`/api/photos/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return setError("Couldn't remove that photo.");
    router.refresh();
  }

  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-1 font-semibold text-text">Photos</legend>

      {photos.length === 0 ? (
        <p className="!m-0 text-sm">No photos yet. Add the finished look or styles {clientName} likes.</p>
      ) : (
        <ul className="!m-0 !list-none !p-0 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((p, i) => (
            <li key={p.id} className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-1">
              {/* Served by our own route after a permission check, so a plain img tag is used. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/photos/${p.id}`} alt={p.caption ? `${clientName}: ${p.caption}` : `Style photo ${i + 1} for ${clientName}`} loading="lazy" className="aspect-square w-full rounded object-cover" />
              <span className="flex items-center justify-between gap-1 px-1 text-xs">
                <span className="truncate">{p.caption ?? ""}</span>
                <button type="button" onClick={() => void remove(p.id)} className="!px-2 !py-0.5 text-xs" aria-label={`Remove photo ${i + 1}`}>
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {storageReady ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span>Caption (optional)</span>
            <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={120} placeholder="e.g. Fresh skin fade, Nov 21" />
          </label>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label="Choose a photo"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className="self-start">
            {busy ? "Uploading…" : "Add a photo"}
          </button>
        </div>
      ) : (
        <p className="!m-0 text-sm">Photo uploads aren&apos;t set up on this server yet.</p>
      )}
      <p className="!m-0 text-xs">JPG, PNG or WebP, up to 4 MB.</p>
      {error && (
        <p role="alert" className="!m-0 text-sm text-text">
          {error}
        </p>
      )}
    </fieldset>
  );
}
