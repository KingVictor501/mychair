// lib/search.ts
// WHAT IT'S FOR: semantic search: Query -> Embed -> Compare -> Ranked passages, closest first.
//   1. Embed: turn the question into 1,536 numbers (lib/embeddings.ts).
//   2. Compare: ask the database (pgvector) how close the question's numbers are to every
//      stored passage's numbers, using COSINE DISTANCE (0 = same meaning, 2 = opposite).
//   3. Rank: return the closest few, with a score = 1 - distance (so 1 = same meaning).
// WHO USES IT: app/api/search/route.ts (search) and app/api/admin/embeddings/route.ts (status).
// WHY THE NAME: it's the search; ".ts" = no screen code.

// "cosineDistance" and "sql" come from Drizzle (drizzle-orm): the first builds the pgvector
// comparison, the second lets us write a small piece of SQL (the row count).
import { cosineDistance, sql } from "drizzle-orm";
import { getDb } from "./db/client";
import { corpusChunks } from "./db/schema";
import { embedTexts } from "./embeddings";
import type { EmbeddingStatus, SearchResult } from "./types";

// Rounds a number to 4 decimal places, so scores are readable in the page and the logs.
function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

// Finds the "limit" passages closest in meaning to the question.
// The "query" must already be validated (length) by the caller.
export async function searchCorpus(query: string, limit: number): Promise<SearchResult[]> {
  const [queryEmbedding] = await embedTexts([query]);

  // How far each stored passage is from the question (smaller = closer in meaning).
  const distance = sql<number>`(${cosineDistance(corpusChunks.embedding, queryEmbedding)})`;

  const rows = await getDb()
    .select({
      id: corpusChunks.id,
      source: corpusChunks.source,
      heading: corpusChunks.heading,
      text: corpusChunks.body,
      distance,
    })
    .from(corpusChunks)
    .orderBy(distance) // smallest distance first = closest first
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    source: row.source,
    heading: row.heading,
    text: row.text,
    // The database may send the number as text, so we convert. Score = similarity.
    score: round4(1 - Number(row.distance)),
  }));
}

// Reads how many passages are embedded straight from the table (the "vector store" itself).
export async function getEmbeddingStatus(): Promise<EmbeddingStatus> {
  const rows = await getDb()
    .select({
      source: corpusChunks.source,
      model: sql<string>`max(${corpusChunks.model})`,
      count: sql<number>`count(*)`,
    })
    .from(corpusChunks)
    .groupBy(corpusChunks.source)
    .orderBy(corpusChunks.source);

  const bySource = rows.map((row) => ({ source: row.source, count: Number(row.count) }));
  return {
    embeddedChunks: bySource.reduce((sum, row) => sum + row.count, 0),
    model: rows[0]?.model ?? null,
    bySource,
  };
}
