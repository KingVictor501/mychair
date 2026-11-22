// components/AdminDemoControls.tsx
// WHAT IT'S FOR: the Super Admin's demo controls: the "Demo mode: on / off" switch and the
// "Reset demo" button (puts the demo shops back to a clean state). Both call POST /api/admin/demo
// with the Super Admin's login, and show working, done and error states.
// WHO USES IT: app/admin/page.tsx.
// WHY THE NAME: admin demo controls; ".tsx" = screen code.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type State = { kind: "idle" } | { kind: "working"; what: string } | { kind: "done"; message: string } | { kind: "error"; message: string };

export default function AdminDemoControls({ demoModeOn }: { demoModeOn: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(demoModeOn);
  const [state, setState] = useState<State>({ kind: "idle" });

  // Sends one action to the server and reports how it went.
  async function run(action: "mode_on" | "mode_off" | "reset") {
    if (action === "reset" && !window.confirm("Reset the demo shops? Anything visitors booked or changed in the demo will be replaced.")) return;
    setState({ kind: "working", what: action === "reset" ? "Resetting the demo… this takes up to a minute." : "Saving…" });
    try {
      const res = await fetch("/api/admin/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const body = (await res.json().catch(() => ({}))) as { shops?: number; appointments?: number; demoMode?: boolean; error?: { message: string } };
      if (!res.ok) return setState({ kind: "error", message: body.error?.message ?? "That didn't work. Try again." });
      if (action === "reset") setState({ kind: "done", message: `Demo reset: ${body.shops} shops, ${body.appointments} appointments.` });
      else {
        setOn(action === "mode_on");
        setState({ kind: "done", message: action === "mode_on" ? "Demo mode is on." : "Demo mode is off. Demo logins and /demo stop working." });
      }
      router.refresh();
    } catch {
      setState({ kind: "error", message: "Couldn't reach the server. Try again." });
    }
  }

  const busy = state.kind === "working";
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span id="demo-mode-label" className="font-semibold text-text">
          Demo mode
        </span>
        <button type="button" role="switch" aria-checked={on} aria-labelledby="demo-mode-label" disabled={busy} onClick={() => void run(on ? "mode_off" : "mode_on")} className={on ? "!bg-text !text-bg" : ""}>
          {on ? "On" : "Off"}
        </button>
        <button type="button" disabled={busy} onClick={() => void run("reset")}>
          Reset demo
        </button>
      </div>
      <p role="status" className="!my-0 text-sm">
        {state.kind === "working" ? state.what : state.kind === "done" ? state.message : ""}
      </p>
      {state.kind === "error" && (
        <p role="alert" className="!my-0 text-sm text-text">
          {state.message}
        </p>
      )}
    </div>
  );
}
