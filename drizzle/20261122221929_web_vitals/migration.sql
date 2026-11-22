CREATE TABLE "web_vitals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"page" text NOT NULL,
	"name" text NOT NULL,
	"value" real NOT NULL,
	"rating" text NOT NULL,
	CONSTRAINT "web_vitals_name_check" CHECK ("name" in ('LCP', 'INP', 'CLS', 'FCP', 'TTFB'))
);
--> statement-breakpoint
CREATE INDEX "web_vitals_ts_idx" ON "web_vitals" ("ts");