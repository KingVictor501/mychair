// app/api/admin/embeddings/route.ts
// WHAT IT'S FOR: reports how many corpus passages are embedded, counted straight from the
// vector table (not from a file or a guess). Admin-key protected.
// WHO USES IT: components/CorpusSearch.tsx (the "Embedded chunks" panel on /search).
// WHY THE NAME: folder path = URL (app/api/admin/embeddings -> /api/admin/embeddings).

import { ApiError } from "@/lib/api-error";
import { requireAdminKey } from "@/lib/admin-auth";
import { getEmbeddingStatus } from "@/lib/search";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const GET = withLogging("/api/admin/embeddings", async (request) => {
  requireAdminKey(request);

  try {
    return Response.json(await getEmbeddingStatus());
  } catch (cause) {
    // Most likely the table doesn't exist yet or the database is down. Safe message out,
    // real reason into the logs.
    throw new ApiError(503, "STATUS_UNAVAILABLE", "Could not read the embedding status.", { cause });
  }
});
