-- Turns on pgvector, the Postgres add-on that stores embeddings (lists of numbers) and can
-- compare them. Drizzle can't create extensions, so we do it here by hand.
-- "IF NOT EXISTS" makes it safe to run again. Neon says pgvector is free on every plan, and
-- it must be turned on once in EACH database (development and production).
-- This runs BEFORE the corpus_chunks table is created (migrations run in filename order).
CREATE EXTENSION IF NOT EXISTS vector;
