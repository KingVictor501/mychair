// lib/db/schema.ts
// WHAT IT'S FOR: describes the database TABLES in TypeScript. Right now there is one:
// log_entries (the saved log lines the Super Admin dashboard will read in Section 4).
// More tables (users, shops, appointments...) get added here in later sections.
// WHO USES IT: lib/db/client.ts (so queries know the tables), lib/logger.ts (saves log rows),
// and drizzle-kit (reads this file to write the migration SQL in the /drizzle folder).
// WHY THE NAME: "schema" = the blueprint of a database; ".ts" = no screen code.
// Matches the log_entries table in docs/data-model.md.

// These builders come from Drizzle (drizzle-orm): one per kind of column.
// "pg-core" means "PostgreSQL basics".
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
