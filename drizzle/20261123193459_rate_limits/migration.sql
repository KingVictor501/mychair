CREATE TABLE "rate_limits" (
	"key" text,
	"window_start" timestamp with time zone,
	"count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "rate_limits_pkey" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE INDEX "rate_limits_window_idx" ON "rate_limits" ("window_start");