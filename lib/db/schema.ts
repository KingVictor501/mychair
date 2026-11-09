// lib/db/schema.ts
// WHAT IT'S FOR: describes the database TABLES in TypeScript. Right now there are two:
//   - log_entries: the saved log lines (for the future Super Admin dashboard).
//   - corpus_chunks: the passages of the search corpus plus their embeddings (the "meaning" numbers).
// More tables (users, shops, appointments...) get added here in later sections.
// WHO USES IT: lib/db/client.ts (so queries know the tables), lib/logger.ts (saves log rows),
// lib/search.ts and scripts/corpus-embed.ts (corpus_chunks), and drizzle-kit (reads this file
// to write the migration SQL in the /drizzle folder).
// WHY THE NAME: "schema" = the blueprint of a database; ".ts" = no screen code.
// Matches docs/data-model.md.

// These builders come from Drizzle (drizzle-orm): one per kind of column.
// "pg-core" means "PostgreSQL basics". "vector" is the column type for embeddings (pgvector).
import { index, integer, jsonb, pgTable, text, timestamp, uuid, vector } from "drizzle-orm/pg-core";

// One row per log line. Never holds names, emails, phones, or raw request bodies:
// lib/redact.ts cleans everything before it gets here.
export const logEntries = pgTable(
  "log_entries",
  {
    // A random unique id for the row, made by the database.
    id: uuid("id").defaultRandom().primaryKey(),
    // When it happened. "withTimezone" = stored as an exact moment (see docs/data-model.md: timestamptz).
    ts: timestamp("ts", { withTimezone: true }).defaultNow().notNull(),
    // debug, info, warn or error.
    level: text("level").notNull(),
    // The event name, e.g. request_done. A fact label, not a sentence.
    event: text("event").notNull(),
    // The route pattern, e.g. /api/health. Empty when the line isn't about a request.
    route: text("route"),
    // Which shop / user it was about (IDs only). Empty until accounts exist (Section 3).
    shopId: uuid("shop_id"),
    userId: uuid("user_id"),
    // Ties together the lines from one request.
    requestId: text("request_id"),
    // Everything else (method, status, ms, ...), already cleaned by redaction.
    details: jsonb("details"),
  },
  // Indexes = a book's index: they make the dashboard's "newest first" and "filter by level/event" fast.
  (table) => [
    index("log_entries_ts_idx").on(table.ts),
    index("log_entries_level_ts_idx").on(table.level, table.ts),
    index("log_entries_event_ts_idx").on(table.event, table.ts),
  ],
);

// The size of the list of numbers OpenAI's text-embedding-3-small makes for each text.
export const EMBEDDING_DIMENSIONS = 1536;

// One row per chunk (passage) of the corpus. The corpus FILES stay on your computer; only the
// chunk text and its embedding are stored here. The number of rows is the embedded chunk count.
export const corpusChunks = pgTable(
  "corpus_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Which file the passage came from, e.g. "product-faq.md".
    source: text("source").notNull(),
    // Where in the file, e.g. "Boots" or "6. Pay & Timekeeping > Overtime".
    heading: text("heading").notNull(),
    // Order of the passage within its file (0, 1, 2...).
    position: integer("position").notNull(),
    // The passage text itself (shown in search results).
    body: text("body").notNull(),
    // A fingerprint (SHA-256) of the exact text that was embedded. UNIQUE, so embedding the
    // same chunk twice can never make a duplicate row: this is what makes the command re-runnable.
    contentHash: text("content_hash").notNull().unique(),
    // The embedding: 1,536 numbers capturing the passage's MEANING.
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    // Which embedding model made it, so we never compare numbers from different models.
    model: text("model").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // An HNSW index makes "find the closest passages" fast. "vector_cosine_ops" means it is
    // built for cosine distance, which is how we compare meaning (matches lib/search.ts).
    index("corpus_chunks_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
    index("corpus_chunks_source_idx").on(table.source),
  ],
);
