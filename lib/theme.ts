// lib/theme.ts
// WHAT IT'S FOR: which color gradient a shop uses. Each kind of shop has its own soft gradient
// (blue for barbershops, blush-to-peach for nail salons, lavender for lash studios), defined once
// in app/globals.css under [data-shop="..."]. This turns a shop's business type into that value.
// WHO USES IT: components/ShopBanner.tsx and the pages that show shop cards.
// WHY THE NAME: the shop's theme; ".ts" = no screen code.

const THEMES = ["barbershop", "nail_salon", "lash_studio"] as const;

// The data-shop value for a business type. Unknown types get the plain gray default.
export function shopTheme(businessType: string | null | undefined): string {
  return (THEMES as readonly string[]).includes(businessType ?? "") ? businessType! : "default";
}
