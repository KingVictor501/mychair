// components/CancelButton.tsx
// WHAT IT'S FOR: the Cancel button on a client's upcoming appointment. Asks to confirm, calls
// POST /api/appointments/<id>/cancel, then refreshes the list. Shows the server's message if
// it's too late to cancel.
// WHO USES IT: app/book/mine/page.tsx.
// WHY THE NAME: the cancel button; ".tsx" = screen code.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CancelButton({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (!window.confirm("Cancel this appointment?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/cancel`, { method: "POST" });
      const body = (await res.json()) as { error?: { message: string } };
      if (!res.ok) setError(body.error?.message ?? "Couldn't cancel.");
      else router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <button type="button" onClick={() => void cancel()} disabled={busy}>
        {busy ? "Cancelling…" : "Cancel"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-text">
          {error}
        </span>
      )}
    </span>
  );
}
