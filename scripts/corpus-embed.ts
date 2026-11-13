// scripts/corpus-embed.ts
// WHAT IT'S FOR: the "embed the corpus" command. It reads the documents in mychair-corpus/,
// cuts them into chunks (lib/corpus/chunk.ts), asks OpenAI for each chunk's embedding, and
// saves chunk + embedding into the corpus_chunks table. The documents themselves are never
// uploaded anywhere except to OpenAI for embedding; they are in git, since they are the app's own help documents.
//   - SAFE TO RE-RUN: each chunk has a fingerprint. Chunks already stored are skipped, so there
//     are no duplicates and no repeat cost. If a document changes, only the changed chunks are
//     re-embedded, and chunks that no longer exist are removed.
//   - Logs `corpus_embedded` with the chunk counts when it finishes.
// WHO USES IT: you, from your computer:
//     npm run corpus:embed                        -> your DEVELOPMENT database (.env.local)
//     npm run corpus:embed -- --env=production    -> your PRODUCTION database (.env.production.local)
// WHY THE NAME: a one-off command-line "script" that embeds the corpus.
//
// SAFETY: it only touches production when you pass --env=production, and it stops if
// .env.production.local does not provide its own DATABASE_URL (so it can never quietly use
// the development database while claiming to be production). It never prints secrets.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { notInArray, sql } from "drizzle-orm";
import { chunkFile } from "../lib/corpus/chunk";
import { chunkHash } from "../lib/corpus/hash";
import { getDb } from "../lib/db/client";
import { corpusChunks } from "../lib/db/schema";
import { embedTexts, EMBEDDING_MODEL } from "../lib/embeddings";
import { flushLogs, log } from "../lib/logger";

const CORPUS_DIR = "mychair-corpus";
// Safety brake: if a run would embed more than this many NEW chunks, stop (guards against a
// mistake like pointing at the wrong folder and paying to embed it).
const MAX_NEW_CHUNKS = 600;
// How many rows we insert per database request.
const INSERT_BATCH = 40;

const isProduction = process.argv.includes("--env=production");
const target = isProduction ? "production" : "development";

// Load the environment file(s) BEFORE touching the database. Built into Node; it never
// overwrites a variable that is already set.
if (isProduction) {
  try {
    process.loadEnvFile(".env.production.local");
  } catch {
    throw new Error(".env.production.local was not found. Create it with a DATABASE_URL line first.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error(".env.production.local does not contain DATABASE_URL, so nothing was done.");
  }
}
try {
  // Provides OPENAI_API_KEY (and, for development, DATABASE_URL).
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: fine if the variables are already set some other way.
}

async function main(): Promise<void> {
  log.info("corpus_embed_start", { target, model: EMBEDDING_MODEL });

  // 1. Read and chunk every file in the corpus folder.
  const names = readdirSync(CORPUS_DIR).filter((name) => !name.startsWith(".")).sort();
  const chunks = names.flatMap((name) => chunkFile(name, readFileSync(join(CORPUS_DIR, name), "utf8")));
  const withHash = chunks.map((chunk) => ({ chunk, hash: chunkHash(chunk.embedText, EMBEDDING_MODEL) }));
  if (withHash.length === 0) throw new Error("No chunks were produced from the corpus folder");

  // 2. Find out which fingerprints are already in the table.
  const db = getDb();
  const storedRows = await db.select({ hash: corpusChunks.contentHash }).from(corpusChunks);
  const stored = new Set(storedRows.map((row) => row.hash));
  const fresh = withHash.filter((item) => !stored.has(item.hash));
  if (fresh.length > MAX_NEW_CHUNKS) {
    throw new Error(`Refusing to embed ${fresh.length} new chunks (limit ${MAX_NEW_CHUNKS})`);
  }

  // 3. Embed only the new chunks, then save them. onConflictDoNothing = if a fingerprint is
  //    somehow already there, skip it instead of failing.
  if (fresh.length > 0) {
    const embeddings = await embedTexts(fresh.map((item) => item.chunk.embedText));
    for (let i = 0; i < fresh.length; i += INSERT_BATCH) {
      await db
        .insert(corpusChunks)
        .values(
          fresh.slice(i, i + INSERT_BATCH).map((item, offset) => ({
            source: item.chunk.source,
            heading: item.chunk.heading,
            position: item.chunk.position,
            body: item.chunk.body,
            contentHash: item.hash,
            embedding: embeddings[i + offset],
            model: EMBEDDING_MODEL,
          })),
        )
        .onConflictDoNothing({ target: corpusChunks.contentHash });
    }
  }

  // 4. Remove rows for chunks that are no longer in the corpus (a document was edited).
  const removed = await db
    .delete(corpusChunks)
    .where(notInArray(corpusChunks.contentHash, withHash.map((item) => item.hash)))
    .returning({ id: corpusChunks.id });

  // 5. Count what is stored now, from the table itself.
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(corpusChunks);

  log.info("corpus_embedded", {
    target,
    model: EMBEDDING_MODEL,
    chunksInCorpus: withHash.length,
    newlyEmbedded: fresh.length,
    removedStale: removed.length,
    chunksStored: Number(count),
  });
  await flushLogs();
}

main().catch(async (error: unknown) => {
  // Only the (cleaned by the logger) message, never the whole error.
  log.error("corpus_embed_failed", {
    target,
    message: error instanceof Error ? error.message : "unknown",
  });
  await flushLogs();
  process.exit(1);
});
