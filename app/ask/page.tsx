// app/ask/page.tsx
// WHAT IT'S FOR: the public "Ask MyChair" page, shown at /ask. Anyone can type a question about
// how MyChair works and get an answer with its exact source shown underneath.
// WHO USES IT: Next.js shows it when someone visits /ask.
// WHY THE NAME: folder name = URL ("app/ask" -> /ask); "page.tsx" = the page for that folder.

import type { Metadata } from "next";
// AskBox comes from components/AskBox.tsx: the interactive question box.
import AskBox from "@/components/AskBox";

export const metadata: Metadata = {
  title: "Ask MyChair",
  description: "Ask how MyChair works. Every answer shows the document and section it came from.",
};

// A server component: it lays out the heading and drops in the interactive box.
export default function AskPage() {
  return (
    <main>
      <h1>Ask MyChair</h1>
      <p>
        Ask how MyChair works: booking, cancellations, refunds, privacy, and more. Answers come only from
        MyChair&apos;s own help documents, and each one shows exactly where it came from. If the documents
        don&apos;t cover your question, it will say so.
      </p>
      <AskBox />
    </main>
  );
}
