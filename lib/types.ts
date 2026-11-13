// lib/types.ts
// WHAT IT'S FOR: shared "shapes" (TypeScript types) for data that more than one file uses.
// WHO USES IT: app/api/health/route.ts, lib/with-logging.ts (build the answers) and
//              components/HealthStatus.tsx (reads the answer).
// WHY THE NAME: "types" = shapes of data; ".ts" because it holds no screen code (no HTML),
//               so it does not need the ".tsx" ending.
// Later sections add one shared type per main thing (shop, pro, client, service, appointment).

// The answer the health route sends when everything works.
// (Being able to answer at all means the app is running AND the database replied.)
export type HealthResponse = {
  status: "ok";
};

// One passage returned by the search. "score" is cosine similarity: closer to 1 = closer in meaning.
export type SearchResult = {
  id: string;
  source: string; // file the passage came from
  heading: string; // where in the file
  text: string; // the passage itself
  score: number;
};

// The answer of GET /api/search: passages ranked closest first.
export type SearchResponse = {
  results: SearchResult[];
  tookMs: number;
};

// The answer of GET /api/admin/embeddings: how many passages are embedded, read from the database itself.
export type EmbeddingStatus = {
  embeddedChunks: number;
  model: string | null;
  bySource: Array<{ source: string; count: number }>;
};

// The standard shape of EVERY error the API sends back (see docs/api-design.md).
// Short and friendly: never a stack trace or connection details.
export type ApiErrorBody = {
  error: {
    code: string; // e.g. "DB_UNREACHABLE"
    message: string; // e.g. "Database unreachable"
  };
};

// The result of asking the answer engine one question (lib/answer.ts).
export type RagResult = {
  // "answered": a cited answer. "refused": the exact refusal line. "malformed": Claude's reply broke our format.
  outcome: "answered" | "refused" | "malformed";
  answer: string;
  citations: string[]; // each "{document} · {section}"
  citationsVerified: boolean; // every citation matched a passage we really retrieved
  passages: SearchResult[]; // what was shown to Claude (after the injection screen), closest first
  blockedPassages: number; // how many retrieved passages the injection screen removed
  tookMs: number;
};
