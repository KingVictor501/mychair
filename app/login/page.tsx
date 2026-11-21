// app/login/page.tsx
// WHAT IT'S FOR: the login page, shown at /login. Someone already logged in is sent straight
// to their home page.
// WHO USES IT: Next.js shows it when someone visits /login.
// WHY THE NAME: folder name = URL ("app/login" -> /login); "page.tsx" = the page for that folder.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm, { HOME_FOR_ROLE } from "@/components/LoginForm";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Log in · MyChair" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(HOME_FOR_ROLE[user.role]);

  return (
    <main className="!max-w-sm">
      <h1>Log in</h1>
      <p>Owners, pros and clients all log in here.</p>
      <LoginForm />
    </main>
  );
}
