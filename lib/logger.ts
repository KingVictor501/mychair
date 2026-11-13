// lib/logger.ts
// WHAT IT'S FOR: the app's logger. Use it instead of console.log:
//     log.info("request_done", { method: "GET", status: 200 });
// Each call makes ONE line of JSON (timestamp, level, event name, details) that goes to two places:
//   1. Standard output / error, which Vercel's log stream shows (the free plan keeps only 1 hour).
//   2. The log_entries table in the database, so the Super Admin dashboard can search it (14 days).
// Details are always cleaned by lib/redact.ts first, so a secret logged by mistake is hidden.
// WHO USES IT: lib/with-logging.ts (every API route), app/api/health/route.ts, scripts/migrate.ts.
// WHY THE NAME: it's the logger; ".ts" = no screen code.

// Cleans details so no secret or personal detail gets logged.
import { redactDetails, scrubString } from "./redact";

// The four levels, from chattiest to most serious.
export type LogLevel = "debug" | "info" | "warn" | "error";

// One log line, exactly as printed and saved.
export type LogEntry = {
  ts: string; // time, e.g. 2026-11-07T19:42:10.120Z
  level: LogLevel;
  event: string; // a fact label like request_done (not a sentence)
  details: Record<string, unknown>;
};

// Ranking so we can say "only show info and above".
const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

// Keep logs this many days in the database.
export const LOG_RETENTION_DAYS = 14;
// Run the clean-up of old rows at most this often (per server instance).
const PRUNE_EVERY_MS = 60 * 60 * 1000;
// If the database is down, don't let waiting lines pile up forever.
const MAX_PENDING = 500;

// Lines printed but not yet saved to the database. lib/with-logging.ts saves them
// after each response is sent.
const pending: LogEntry[] = [];
let lastPruneAt = 0;

// Reads the LOG_LEVEL environment variable: "debug" on your computer, "info" on the live site.
// Anything missing or misspelled falls back to "info" (the safer, quieter choice).
export function getActiveLevel(): LogLevel {
  const value = process.env.LOG_LEVEL?.toLowerCase();
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }
  return "info";
}

// Builds, prints, and queues one log line (if its level is loud enough).
function emit(level: LogLevel, event: string, details?: Record<string, unknown>): void {
  // Below the active level? Drop it completely: not printed, not saved.
  if (LEVEL_RANK[level] < LEVEL_RANK[getActiveLevel()]) return;

  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    event,
    // Every log passes through redaction right here, with no way around it.
    details: redactDetails(details),
  };

  const line = `${JSON.stringify(entry)}\n`;
  // Errors go to "standard error" (Vercel marks those red); everything else to "standard output".
  // EXCEPTION: when LOG_TO_STDERR=1 (set by mcp/server.ts), EVERY line goes to standard error.
  // An MCP server talks to Claude over standard output, so a stray log line there would corrupt
  // the conversation and break the connection.
  if (level === "error" || process.env.LOG_TO_STDERR === "1") {
    process.stderr.write(line);
  } else {
    process.stdout.write(line);
  }

  pending.push(entry);
  if (pending.length > MAX_PENDING) pending.shift();
}

// The logger you import. Four levels, same shape: log.level(eventName, detailsObject).
export const log = {
  debug: (event: string, details?: Record<string, unknown>) => emit("debug", event, details),
  info: (event: string, details?: Record<string, unknown>) => emit("info", event, details),
  warn: (event: string, details?: Record<string, unknown>) => emit("warn", event, details),
  error: (event: string, details?: Record<string, unknown>) => emit("error", event, details),
};

// Takes everything waiting to be saved and empties the waiting list. (Also used by tests.)
export function drainPendingLogs(): LogEntry[] {
  return pending.splice(0, pending.length);
}

// A value is only saved in the shop_id / user_id columns if it is a real UUID;
// otherwise it stays in the details and the column stays empty.
function asUuid(value: unknown): string | null {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

// Saves the waiting log lines to the log_entries table, and now and then deletes lines older
// than 14 days. Never throws: a logging problem must not break a visitor's request.
export async function flushLogs(): Promise<void> {
  const batch = drainPendingLogs();
  if (batch.length === 0) return;

  try {
    // Loaded only now, so tests of the logger don't need a database.
    const { getDb } = await import("./db/client");
    const { logEntries } = await import("./db/schema");
    const { lt } = await import("drizzle-orm");
    const db = getDb();

    await db.insert(logEntries).values(
      batch.map((entry) => ({
        ts: new Date(entry.ts),
        level: entry.level,
        event: entry.event,
        route: typeof entry.details.route === "string" ? entry.details.route : null,
        shopId: asUuid(entry.details.shopId),
        userId: asUuid(entry.details.userId),
        requestId: typeof entry.details.requestId === "string" ? entry.details.requestId : null,
        details: entry.details,
      })),
    );

    // Retention rule: delete rows older than 14 days, at most once an hour per server instance.
    if (Date.now() - lastPruneAt > PRUNE_EVERY_MS) {
      lastPruneAt = Date.now();
      const cutoff = new Date(Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      await db.delete(logEntries).where(lt(logEntries.ts, cutoff));
      log.info("logs_pruned", { retentionDays: LOG_RETENTION_DAYS });
    }
  } catch (error) {
    // We can't save to the database (table missing, database down...). Say so in the stream only,
    // using a cleaned message, and do NOT re-queue (that could loop forever).
    const message = error instanceof Error ? scrubString(error.message) : "unknown";
    process.stderr.write(
      `${JSON.stringify({
        ts: new Date().toISOString(),
        level: "warn",
        event: "log_persist_failed",
        details: { lines: batch.length, message },
      })}\n`,
    );
  }
}
