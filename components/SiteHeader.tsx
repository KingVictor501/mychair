// components/SiteHeader.tsx
// WHAT IT'S FOR: the bar across the top of every page: the MyChair name (a link home), the links
// for the person's role, who is logged in, and Log out. Logged-out visitors get Book, Demo and
// Log in. A server component: it reads the session on the server, then hands the links to
// NavMenu (the only part that runs in the browser, for the active link and the phone menu).
// WHO USES IT: app/layout.tsx.
// WHY THE NAME: the site's header; ".tsx" = screen code.

import Link from "next/link";
import { canUseAdmin } from "@/lib/auth/access-rules";
import { getCurrentUser, getSessionClaims } from "@/lib/auth/current-user";
import { HOME_FOR_ROLE } from "@/lib/auth/home";
import { worksAsPro } from "@/lib/auth/permissions";
import type { Role } from "@/lib/types";
import NavMenu, { type NavLink } from "./NavMenu";

// The links each role sees, in order.
const LINKS: Record<Role | "guest" | "owner_with_chair", NavLink[]> = {
  guest: [
    { href: "/guest", label: "Book" },
    { href: "/demo", label: "Demo" },
    { href: "/login", label: "Log in" },
  ],
  client: [
    { href: "/book", label: "Pros" },
    { href: "/book/mine", label: "My appointments" },
  ],
  pro: [
    { href: "/pro", label: "Schedule" },
    { href: "/pro/clients", label: "Clients" },
    { href: "/pro/settings", label: "Settings" },
  ],
  owner: [{ href: "/owner", label: "My shop" }],
  // An owner who also takes appointments gets the pro links too, so they can switch views.
  owner_with_chair: [
    { href: "/owner", label: "My shop" },
    { href: "/pro", label: "My schedule" },
    { href: "/pro/clients", label: "My clients" },
    { href: "/pro/settings", label: "Settings" },
  ],
  super_admin: [
    { href: "/admin", label: "Admin" },
    { href: "/admin/logs", label: "Logs" },
    { href: "/metrics", label: "Metrics" },
    { href: "/demo", label: "Demo" },
  ],
};

const ROLE_LABEL: Record<Role, string> = { super_admin: "Super Admin", owner: "Owner", pro: "Pro", client: "Client" };

export default async function SiteHeader() {
  const [user, claims] = await Promise.all([getCurrentUser(), getSessionClaims()]);
  // The demo Super Admin has no admin tools, so no admin links.
  const links = !user
    ? LINKS.guest
    : user.role === "super_admin" && !canUseAdmin(user, claims)
      ? [{ href: "/demo", label: "Demo" }]
      : user.role === "owner" && worksAsPro(user)
        ? LINKS.owner_with_chair
        : LINKS[user.role];

  return (
    <div className="relative border-b border-border bg-bg">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href={user ? HOME_FOR_ROLE[user.role] : "/"} className="text-lg font-bold tracking-tight !no-underline">
          MyChair
        </Link>
        <NavMenu links={links} who={user ? `${user.displayName ?? user.name} · ${ROLE_LABEL[user.role]}` : null} />
      </div>
    </div>
  );
}
