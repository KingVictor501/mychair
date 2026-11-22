// components/NavMenu.tsx
// WHAT IT'S FOR: the links in the site header. Shows which page you're on (the active link), and
// under 640px wide folds the links into a "Menu" button that opens and closes them (plain React
// state, no extra libraries). Also shows who is logged in and a Log out button.
// WHO USES IT: components/SiteHeader.tsx, which decides the links on the server.
// WHY THE NAME: the navigation menu; ".tsx" = screen code. "use client" because it needs the
// current address (usePathname) and the open/closed state.

"use client";

import Link from "next/link";
// usePathname gives the current address without the ?query part, e.g. "/pro/clients".
import { usePathname } from "next/navigation";
import { useState } from "react";
import LogoutButton from "./LogoutButton";

export type NavLink = { href: string; label: string };

// True if this link is the page you're on. "/pro" is active only on /pro itself, so it doesn't
// light up on /pro/clients too; deeper links count their own sub-pages (/pro/clients/<id>).
function isActive(pathname: string, href: string, all: NavLink[]): boolean {
  if (pathname === href) return true;
  if (!pathname.startsWith(href + "/")) return false;
  // A longer link that also matches wins (e.g. /book/mine over /book).
  return !all.some((l) => l.href !== href && l.href.startsWith(href) && (pathname === l.href || pathname.startsWith(l.href + "/")));
}

export default function NavMenu({ links, who }: { links: NavLink[]; who: string | null }) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);

  const list = (
    <ul className="!m-0 !list-none !p-0 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-1">
      {links.map((l) => {
        const active = isActive(pathname, l.href, links);
        return (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={active ? "page" : undefined}
              onClick={() => setOpen(false)}
              className={`block rounded-md px-3 py-2 text-sm !no-underline ${active ? "bg-surface font-semibold text-text" : "text-text-muted hover:text-text"}`}
            >
              {l.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <nav aria-label="Main" className="flex items-center gap-3">
      {/* Wide screens: links in a row. */}
      <div className="hidden items-center gap-3 sm:flex">
        {list}
        {who && <span className="text-xs text-text-muted">{who}</span>}
        {who && <LogoutButton />}
      </div>

      {/* Phones: a Menu button that opens the links underneath the header. */}
      <button type="button" className="sm:hidden !px-3 !py-1.5 text-sm" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(!open)}>
        {open ? "Close" : "Menu"}
      </button>
      {open && (
        <div id="mobile-menu" className="absolute inset-x-0 top-full z-20 border-b border-border bg-bg px-4 pb-4 pt-2 shadow-sm sm:hidden">
          {list}
          {who && (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
              <span className="text-sm text-text-muted">{who}</span>
              <LogoutButton />
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
