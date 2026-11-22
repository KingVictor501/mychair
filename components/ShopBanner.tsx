// components/ShopBanner.tsx
// WHAT IT'S FOR: the soft gradient band at the top of a shop's pages, in that shop's colors
// (app/globals.css, chosen by lib/theme.ts). Holds the page title, a short line under it, and
// anything passed in "children" on the right (for example a button).
// WHO USES IT: the client, guest, pro and owner pages.
// WHY THE NAME: a banner for a shop; ".tsx" = screen code. A server component.

import type { ReactNode } from "react";
import { shopTheme } from "@/lib/theme";

type Props = { businessType: string | null | undefined; title: ReactNode; subtitle?: ReactNode; children?: ReactNode };

export default function ShopBanner({ businessType, title, subtitle, children }: Props) {
  return (
    <header data-shop={shopTheme(businessType)} className="shop-gradient mb-5 flex flex-wrap items-end justify-between gap-3 rounded-xl px-4 py-5 sm:px-5">
      <div>
        <h1 className="!m-0">{title}</h1>
        {subtitle && <p className="!mb-0 !mt-1 text-text">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}
