// components/HealthStatus.tsx
// WHAT IT'S FOR: a small widget that calls /api/health and shows the result on screen.
// It has the states every data widget needs: loading, error, and data. (There is no "empty"
// state because a health check always returns something.)
// WHO USES IT: app/page.tsx (the hello-world page).
// WHY THE NAME: components are named for what they show (PascalCase); ".tsx" because it
// contains screen code (HTML-like JSX).

// "use client" means this runs in the visitor's BROWSER, which it must because it uses
// state and effects (things that change after the page loads). Without it, Next.js
// treats the file as a server component and useState would crash.
"use client";

// useState remembers a value between redraws; useEffect runs code once the page appears.
// Both come from React, the library Next.js is built on.
import { useEffect, useState } from "react";
// HealthResponse comes from lib/types.ts so this file and the API agree on the answer's shape.
import type { HealthResponse } from "@/lib/types";

// The four situations the widget can be in.
type ViewState =
  | { kind: "loading" }
  | { kind: "data"; health: HealthResponse }
  | { kind: "error"; message: string };

// Shows "Checking...", then either the app/database status or a friendly error.
export default function HealthStatus() {
  const [view, setView] = useState<ViewState>({ kind: "loading" });

  useEffect(() => {
    // Lets us ignore the answer if the page was closed before it arrived.
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/health");
        const health = (await res.json()) as HealthResponse;
        if (!cancelled) setView({ kind: "data", health });
      } catch {
        // The request itself failed (for example, no internet).
        if (!cancelled) {
          setView({ kind: "error", message: "Could not reach the server." });
        }
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (view.kind === "loading") {
    return <p role="status">Checking the app and database…</p>;
  }

  if (view.kind === "error") {
    return <p role="alert">{view.message}</p>;
  }

  // "data": the server answered. It may still say the database is down.
  return view.health.status === "ok" ? (
    <p role="status">Health check: ok. The app is running and the database is reachable.</p>
  ) : (
    <p role="alert">
      Health check: error. {view.health.message ?? "Something went wrong."}
    </p>
  );
}
