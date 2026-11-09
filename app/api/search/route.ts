// app/api/search/route.ts
// WHAT IT'S FOR: the search endpoint. GET /api/search?q=your+question returns the 5 passages
// closest in meaning, with scores. Admin-key protected (temporary stand-in for login).
// WHO USES IT: components/CorpusSearch.tsx (the /search page), and you in Postman or curl.
// WHY THE NAME: folder path = URL (app/api/search -> /api/search); "route.ts" = an API route.

import { ApiError } from "@/lib/api-error";
// requireAdminKey comes from lib/admin-auth.ts: stops the request unless the secret key is right.
import { requireAdminKey } from "@/lib/admin-auth";
import { log } from "@/lib/logger";
// searchCorpus comes from lib/search.ts: embeds the question and ranks the passages.
import { searchCorpus } from "@/lib/search";
import type { SearchResponse } from "@/lib/types";
import { withLogging } from "@/lib/with-logging";

// Never cache: every search is live.
export const dynamic = "force-dynamic";

// How many passages come back, and how long a question may be.
const RESULT_LIMIT = 5;
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 200;

export const GET = withLogging("/api/search", async (request) => {
  // 1. Lock: wrong or missing key stops here with a 401.
  requireAdminKey(request);

  // 2. Validate the input on the server (the browser can be bypassed). Friendly error if bad.
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (query.length < MIN_QUERY_LENGTH || query.length > MAX_QUERY_LENGTH) {
    throw new ApiError(
      400,
      "BAD_QUERY",
      `Please type a question between ${MIN_QUERY_LENGTH} and ${MAX_QUERY_LENGTH} characters.`,
    );
  }

  // 3. Search. If OpenAI or the database fails, the visitor gets a safe message and the real
  //    reason (for example "OpenAI embeddings request failed with status 401") is logged.
  const startedAt = performance.now();
  let results;
  try {
    results = await searchCorpus(query, RESULT_LIMIT);
  } catch (cause) {
    throw new ApiError(502, "SEARCH_FAILED", "Search is unavailable right now. Please try again.", {
      cause,
    });
  }
  const tookMs = Math.round(performance.now() - startedAt);

  // 4. Log the facts about the search. NEVER the question text: only its length.
  log.info("semantic_search", {
    route: "/api/search",
    queryLength: query.length,
    resultCount: results.length,
    topScore: results[0]?.score ?? null,
    ms: tookMs,
  });

  const body: SearchResponse = { results, tookMs };
  return Response.json(body);
});
