// app/search/page.tsx
// WHAT IT'S FOR: the search page, shown at /search. It asks for your admin key, then lets you
// ask a question and see the passages closest in meaning.
// WHO USES IT: Next.js shows it when someone visits /search.
// WHY THE NAME: folder name = URL ("app/search" -> /search); "page.tsx" = the page for that folder.

import type { Metadata } from "next";
// CorpusSearch comes from components/CorpusSearch.tsx: the interactive search widget.
import CorpusSearch from "@/components/CorpusSearch";

// Ask search engines not to list this admin page.
export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: false },
};

// A server component: it only lays out the heading and drops in the interactive widget.
export default function SearchPage() {
  return (
    <main>
      <h1>Search by meaning</h1>
      <p>Type a question. Results are ranked by meaning, not by matching words.</p>
      <CorpusSearch />
    </main>
  );
}
