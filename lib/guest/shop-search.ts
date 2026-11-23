// lib/guest/shop-search.ts
// WHAT IT'S FOR: the predictive shop search on /guest. As a guest types a shop's name, this
// ranks the shops closest first, so a few letters are usually enough, and a small typo still
// finds the shop ("fade facotry" finds "Fade Factory"). No database, so it's tested exactly.
//   normalizeName  lowercases and strips punctuation ("Lash & Co." -> "lash and co")
//   shopMatchScore how well one shop name matches what was typed (0 = no match)
//   rankShops      the best matches, closest first
// WHO USES IT: lib/guest/booking.ts (searchGuestShops). Tested by lib/guest/shop-search.test.ts.
// WHY THE NAME: shop search for guests; ".ts" = no screen code.
//
// At today's size (a handful of shops) ranking in code is instant. With thousands of shops this
// would move into the database (Postgres trigram search) behind the same API.

export const SHOP_SUGGESTIONS = 6;

// "Lash & Co." -> "lash and co": lowercase, "&" read as "and", punctuation dropped, single spaces.
export function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // accents: "é" -> "e"
    .replace(/&/g, " and ")
    .replace(/['’]/g, "") // "Dee's" -> "dees"
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// How many single-letter changes turn a into b: add a letter, remove one, change one, or swap two
// side by side ("nial" -> "nail" is one change, the most common typing slip).
function editDistance(a: string, b: string): number {
  // d[i][j] = changes needed to turn the first i letters of a into the first j letters of b.
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) best = Math.min(best, d[i - 2]![j - 2]! + 1);
      d[i]![j] = best;
    }
  }
  return d[a.length]![b.length]!;
}

// True if the typed word is close to the start of a name word: one typo allowed from 3 letters,
// two from 7, so "facotry" still matches "factory".
function nearPrefix(typed: string, word: string): boolean {
  if (typed.length < 3) return false;
  const allowed = typed.length >= 7 ? 2 : 1;
  const start = word.slice(0, typed.length);
  // Also compare against one letter more or less, in case a letter was added or left out.
  return [start, word.slice(0, typed.length + 1), word.slice(0, Math.max(1, typed.length - 1))].some((w) => editDistance(typed, w) <= allowed);
}

// A score for how well "name" matches what was typed. Higher is closer; 0 means not a match.
//   100  the name starts with it                 "fade f"      -> "Fade Factory"
//    85  every typed word starts a name word     "factory fa"  -> "Fade Factory"
//    70  it's somewhere inside the name          "actor"       -> "Fade Factory"
//    40  close, with a typo or two               "fade facotry"-> "Fade Factory"
// Shorter names win ties, so the closest-looking name comes first.
export function shopMatchScore(name: string, typed: string): number {
  const n = normalizeName(name);
  const q = normalizeName(typed);
  if (!q) return 1;
  const words = n.split(" ");
  const typedWords = q.split(" ");
  const tie = Math.max(0, 10 - n.length / 10);
  if (n.startsWith(q)) return 100 + tie;
  if (typedWords.every((t) => words.some((w) => w.startsWith(t)))) return 85 + tie;
  if (n.includes(q)) return 70 + tie;
  if (typedWords.every((t) => words.some((w) => w.startsWith(t) || nearPrefix(t, w)))) return 40 + tie;
  return 0;
}

// The best matches for what was typed, closest first (then A to Z). With nothing typed, the
// first shops A to Z, so tapping the empty box already shows some to choose from.
export function rankShops<T extends { name: string }>(shops: T[], typed: string, limit = SHOP_SUGGESTIONS): T[] {
  return shops
    .map((shop) => ({ shop, score: shopMatchScore(shop.name, typed) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.shop.name.localeCompare(b.shop.name))
    .slice(0, limit)
    .map((r) => r.shop);
}
