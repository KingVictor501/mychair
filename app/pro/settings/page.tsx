// app/pro/settings/page.tsx
// WHAT IT'S FOR: the pro's settings, at /pro/settings: on/off toggles for the pro's own choices.
// For now: "Let other pros book for me", plus a Log out button at the bottom.
// WHO USES IT: pros.
// WHY THE NAME: folder path = URL (/pro/settings).

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HOME_FOR_ROLE } from "@/lib/auth/home";
import LogoutButton from "@/components/LogoutButton";
import ProSettingsToggles from "@/components/ProSettingsToggles";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPro } from "@/lib/booking/data";
import Breadcrumbs from "@/components/Breadcrumbs";

export const metadata: Metadata = { title: "Settings · MyChair" };

export default async function ProSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "pro") redirect(HOME_FOR_ROLE[user.role]);
  const pro = await getPro(user.id);
  if (!pro) redirect("/login");

  return (
    <main className="!max-w-3xl">
      <Breadcrumbs items={[{ label: "My schedule", href: "/pro" }, { label: "Settings" }]} />
      <h1 className="!mt-2">Settings</h1>
      <ProSettingsToggles initial={{ allowOthersToBook: pro.allowOthersToBook }} />
      <section aria-label="Account" className="mt-8 border-t border-border pt-4">
        <h2 className="!mt-0">Account</h2>
        <LogoutButton />
      </section>
    </main>
  );
}
