CREATE TABLE "corpus_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"source" text NOT NULL,
	"heading" text NOT NULL,
	"position" integer NOT NULL,
	"body" text NOT NULL,
	"content_hash" text NOT NULL UNIQUE,
	"embedding" vector(1536) NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "corpus_chunks_embedding_idx" ON "corpus_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "corpus_chunks_source_idx" ON "corpus_chunks" ("source");