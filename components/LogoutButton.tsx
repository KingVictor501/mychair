// components/LogoutButton.tsx
// WHAT IT'S FOR: the Log out button. Calls POST /api/auth/logout (which clears the session
// cookie), then goes to the login page.
// WHO USES IT: the pro settings page (app/pro/settings/page.tsx); later, the shared page header.
// WHY THE NAME: the logout button; ".tsx" = screen code.

"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.push("/login");
    router.refresh();
  }
  return (
    <button type="button" onClick={() => void logout()}>
      Log out
    </button>
  );
}
