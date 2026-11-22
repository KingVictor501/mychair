// components/SwitchSessionButton.tsx
// WHAT IT'S FOR: one button that switches who the browser is logged in as, then opens that
// person's home page. Used three ways:
//   - "View as Ben" on /admin           -> POST /api/admin/view-as       { userId }
//   - "Stop viewing as" in the banner   -> POST /api/admin/view-as/stop
//   - "See Ben's owner view" on /demo   -> POST /api/demo/enter          { userId }
// The server decides whether the switch is allowed and answers with the home page to open.
// WHO USES IT: app/admin/page.tsx, components/SessionBanner.tsx, app/demo/page.tsx.
// WHY THE NAME: it switches the session; ".tsx" = screen code.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { url: "/api/admin/view-as" | "/api/admin/view-as/stop" | "/api/demo/enter"; userId?: string; label: string; className?: string };

export default function SwitchSessionButton({ url, userId, label, className }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(userId ? { userId } : {}) });
      const body = (await res.json().catch(() => ({}))) as { home?: string; error?: { message: string } };
      if (!res.ok || !body.home) {
        setBusy(false);
        return setError(body.error?.message ?? "That didn't work. Try again.");
      }
      router.push(body.home);
      router.refresh();
    } catch {
      setBusy(false);
      setError("Couldn't reach the server. Try again.");
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={() => void go()} disabled={busy} className={className}>
        {busy ? "Opening…" : label}
      </button>
      {error && (
        <span role="alert" className="text-xs text-text">
          {error}
        </span>
      )}
    </span>
  );
}
