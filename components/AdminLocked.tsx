// components/AdminLocked.tsx
// WHAT IT'S FOR: what the demo Super Admin sees on the Super Admin pages: a short note that these
// tools aren't part of the demo. (Sending them to /login instead would bounce straight back here,
// because a logged-in Super Admin's home is /admin.)
// WHO USES IT: app/admin/page.tsx and app/admin/logs/page.tsx.
// WHY THE NAME: the admin pages, locked; ".tsx" = screen code.

import Link from "next/link";
import LogoutButton from "./LogoutButton";

export default function AdminLocked() {
  return (
    <main className="!max-w-md">
      <h1>Super Admin</h1>
      <p>The Super Admin tools aren&apos;t part of the demo. Open an owner or pro view from the demo page instead.</p>
      <p className="flex items-center gap-4">
        <Link href="/demo">Demo page</Link>
        <LogoutButton />
      </p>
    </main>
  );
}
