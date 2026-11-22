// components/LogoutButton.tsx
// WHAT IT'S FOR: the Log out button. Calls POST /api/auth/logout (which clears the session
// cookie), then goes to the login page.
// WHO USES IT: the pro settings page (app/pro/settings/page.tsx); later, the shared page header.
// WHY THE NAME: the logout button; ".tsx" = screen code.

"use client";

import { useRouter } from "next/navigation";

// "label" and "goTo" let the demo banner say "Leave demo" and go back to /demo.
export default function LogoutButton({ label = "Log out", goTo = "/login" }: { label?: string; goTo?: string }) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.push(goTo);
    router.refresh();
  }
  return (
    <button type="button" onClick={() => void logout()}>
      {label}
    </button>
  );
}
