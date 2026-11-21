// components/AppointmentActions.tsx
// WHAT IT'S FOR: the buttons that move one appointment along: Check in (into the chair),
// No-show, Cancel, and Complete (with how it was paid). Only the steps allowed from the current
// status are shown; the server enforces the same rules. Saves with
// POST /api/appointments/<id>/status, then refreshes the page.
// WHO USES IT: app/pro/page.tsx (and later the owner dashboard).
// WHY THE NAME: the actions on an appointment; ".tsx" = screen code.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { nextSteps } from "@/lib/pro/lifecycle";

const LABEL: Record<string, string> = { in_chair: "Check in", no_show: "No-show", cancelled: "Cancel", completed: "Complete" };

export default function AppointmentActions({ appointmentId, status }: { appointmentId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState<"paid" | "cash" | "deposit_held">("paid");
  const [error, setError] = useState<string | null>(null);
  const steps = nextSteps(status);
  if (steps.length === 0) return null;

  async function move(to: string) {
    if ((to === "no_show" || to === "cancelled") && !window.confirm(`Mark this appointment as ${LABEL[to]?.toLowerCase()}?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(to === "completed" ? { status: to, paymentStatus: payment } : { status: to }),
      });
      const body = (await res.json()) as { error?: { message: string } };
      if (!res.ok) setError(body.error?.message ?? "Couldn't update.");
      else router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {steps.includes("completed") && (
          <label className="flex items-center gap-1 text-sm">
            <span className="sr-only">Payment</span>
            <select value={payment} onChange={(e) => setPayment(e.target.value as typeof payment)} className="rounded border border-border bg-bg p-1">
              <option value="paid">Paid</option>
              <option value="cash">Cash</option>
              <option value="deposit_held">Deposit held</option>
            </select>
          </label>
        )}
        {steps.map((s) => (
          <button key={s} type="button" disabled={busy} onClick={() => void move(s)} className="!px-3 !py-1 text-sm">
            {LABEL[s] ?? s}
          </button>
        ))}
      </div>
      {error && (
        <span role="alert" className="text-xs text-text">
          {error}
        </span>
      )}
    </div>
  );
}
