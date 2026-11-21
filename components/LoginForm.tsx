// components/LoginForm.tsx
// WHAT IT'S FOR: the login form. Sends the email-or-phone and password to POST /api/auth/login.
// On success the server has already set the session cookie, so this just moves to the right
// home page for the person's role. On failure it shows the server's generic message.
// WHO USES IT: app/login/page.tsx.
// WHY THE NAME: the login form; ".tsx" = screen code.

"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { MeResponse, Role } from "@/lib/types";

// Where each role lands after logging in.
export const HOME_FOR_ROLE: Record<Role, string> = {
  super_admin: "/admin",
  owner: "/owner",
  pro: "/pro",
  client: "/book",
};

export default function LoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const body = (await res.json()) as MeResponse & { error?: { message: string } };
      if (!res.ok || !body.user) {
        setError(body.error?.message ?? "Couldn't log in. Try again.");
        return;
      }
      router.push(HOME_FOR_ROLE[body.user.role]);
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span>Email or phone</span>
        <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required />
      </label>
      <label className="flex flex-col gap-1">
        <span>Password</span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </label>
      {error && (
        <p role="alert" className="m-0 rounded border border-border bg-surface p-2 text-sm text-text">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy}>
        {busy ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
