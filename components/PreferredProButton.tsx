// components/PreferredProButton.tsx
// WHAT IT'S FOR: on a pro's booking page, lets the client make this pro their preferred pro, or
// remove them. Saves with PUT /api/me/preferred-pro and shows saving and error states.
// WHO USES IT: app/book/[proId]/page.tsx.
// WHY THE NAME: the preferred-pro button; ".tsx" = screen code.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PreferredProButton({ proId, proName, isPreferred }: { proId: string; proName: string; isPreferred: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sets this pro as preferred, or clears it if they already are. Then refreshes the page's data.
  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me/preferred-pro", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proId: isPreferred ? null : proId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message: string } };
        setError(body.error?.message ?? "Couldn't save. Try again.");
      } else {
        router.refresh();
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {isPreferred && (
        <span className="text-sm font-semibold text-text">
          <span className="text-star" aria-hidden="true">
            ★
          </span>{" "}
          {proName} is your preferred pro.
        </span>
      )}
      <button type="button" onClick={() => void toggle()} disabled={busy}>
        {busy ? "Saving…" : isPreferred ? "Remove as preferred pro" : `Make ${proName} my preferred pro`}
      </button>
      {error && (
        <p role="alert" className="!my-0 w-full text-sm text-text">
          {error}
        </p>
      )}
    </div>
  );
}
