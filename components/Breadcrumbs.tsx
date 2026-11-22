// components/Breadcrumbs.tsx
// WHAT IT'S FOR: the breadcrumb trail at the top of every page, for example
// "My schedule › My clients › Marcus". Each step before the last is a link back to that page;
// the last step is the page you're on (marked for screen readers with aria-current="page").
// A server component: no "use client", because it only shows links.
// WHO USES IT: every page under app/.
// WHY THE NAME: breadcrumbs, the usual name for this trail; ".tsx" = screen code.

import Link from "next/link";

// One step in the trail. "href" is left out for the page you're on.
export type Crumb = { label: string; href?: string };

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-2 text-sm">
      <ol className="!m-0 !list-none !p-0 flex flex-wrap items-center gap-x-1 gap-y-1">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${i}-${c.label}`} className="flex items-center gap-1">
              {last || !c.href ? (
                <span aria-current={last ? "page" : undefined} className={last ? "font-semibold text-text" : "text-text-muted"}>
                  {c.label}
                </span>
              ) : (
                <Link href={c.href}>{c.label}</Link>
              )}
              {!last && (
                <span aria-hidden="true" className="text-text-muted">
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
