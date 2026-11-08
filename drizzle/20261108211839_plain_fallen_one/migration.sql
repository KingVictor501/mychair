CREATE TABLE "log_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"level" text NOT NULL,
	"event" text NOT NULL,
	"route" text,
	"shop_id" uuid,
	"user_id" uuid,
	"request_id" text,
	"details" jsonb
);
--> statement-breakpoint
CREATE INDEX "log_entries_ts_idx" ON "log_entries" ("ts");--> statement-breakpoint
CREATE INDEX "log_entries_level_ts_idx" ON "log_entries" ("level","ts");--> statement-breakpoint
CREATE INDEX "log_entries_event_ts_idx" ON "log_entries" ("event","ts");