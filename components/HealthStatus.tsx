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
// The agreed shapes of the API's good answer and error answer, from lib/types.ts.
import type { ApiErrorBody, HealthResponse } from "@/lib/types";

// The three situations the widget can be in.
type ViewState =
  | { kind: "loading" }
  | { kind: "ok" }
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
        const body = (await res.json()) as HealthResponse | ApiErrorBody;
        if (cancelled) return;

        if ("status" in body && body.status === "ok") {
          setView({ kind: "ok" });
        } else if ("error" in body) {
          setView({ kind: "error", message: body.error.message });
        } else {
          setView({ kind: "error", message: "Something went wrong." });
        }
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
    return <p role="alert">Health check: error. {view.message}</p>;
  }

  return <p role="status">Health check: ok. The app is running and the database is reachable.</p>;
}
