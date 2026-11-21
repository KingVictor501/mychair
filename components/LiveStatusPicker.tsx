// components/LiveStatusPicker.tsx
// WHAT IT'S FOR: the three live-status buttons on the pro page: Available, With a client,
// Unavailable. Saves with PATCH /api/pro/status; clients see it on the pros list.
// WHO USES IT: app/pro/page.tsx.
// WHY THE NAME: picks the live status; ".tsx" = screen code.

"use client";

import { useState } from "react";
import { LIVE_STATUS } from "@/lib/format";

const OPTIONS = ["available", "with_client", "unavailable"] as const;

export default function LiveStatusPicker({ initial }: { initial: string }) {
  const [status, setStatus] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function choose(next: (typeof OPTIONS)[number]) {
    const before = status;
    setStatus(next);
    setError(null);
    try {
      const res = await fetch("/api/pro/status", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ liveStatus: next }) });
      if (!res.ok) throw new Error("save failed");
    } catch {
      setStatus(before);
      setError("Couldn't update your status. Try again.");
    }
  }

  return (
    <div>
      <div role="group" aria-label="Live status" className="flex flex-wrap gap-2">
        {OPTIONS.map((o) => (
          <button key={o} type="button" aria-pressed={status === o} onClick={() => void choose(o)} className={status === o ? "!bg-text !text-bg" : ""}>
            {LIVE_STATUS[o]}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="!mt-1 text-sm text-text">
          {error}
        </p>
      )}
    </div>
  );
}
