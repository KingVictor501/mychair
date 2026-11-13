// lib/report.ts
// WHAT IT'S FOR: the rules of the WEEKLY APP HEALTH + SECURITY REPORT, kept apart from the
// database so they can be tested with plain numbers:
//   1. the thresholds that decide whether the security status is "ok" or "attention",
//   2. buildReport: turns raw counts into ONE flat row (one value per column), which is exactly
//      the shape a spreadsheet row needs.
// The report holds counts and yes/no checks only: no emails, no question text, no key values.
// WHO USES IT: lib/report-data.ts (gathers the counts), app/api/admin/weekly-report/route.ts,
// and lib/report.test.ts.
// WHY THE NAME: it builds the "report"; ".ts" = plain logic, no screen code.

// The thresholds. They live here, in code and in git, so the rules for "attention" are written
// down in advance and not decided after seeing the numbers.
export const AUTH_FAILURES_ATTENTION_AT = 10; // this many wrong admin keys in a week
export const LOG_STALE_AFTER_HOURS = 24; // newest log line older than this = logging looks dead

// Everything the database and the server's settings can tell us. All plain numbers or yes/no.
export type ReportInputs = {
  now: Date;
  requests: number; // request_done lines in the last 7 days
  serverErrors5xx: number;
  unauthorized401: number;
  forbidden403: number;
  tooMany429: number;
  badRequests400: number;
  p50Ms: number | null; // null when there were no requests
  p95Ms: number | null;
  questionsAsked: number; // ask_received lines
  answered: number; // rag_answer lines with outcome "answered"
  refused: number; // rag_answer lines with outcome "refused"
  injectionBlocked: number; // injection_attempt_detected lines
  authFailures: number; // admin_auth_failed lines
  capHits: number; // ask_cap_reached lines
  corpusChunks: number; // passages stored right now
  corpusChunksFlagged: number; // stored passages the injection screen would block
  newestLogAt: Date | null;
  adminKeySet: boolean; // yes/no only, never the value
  anthropicKeySet: boolean;
  logLevelOk: boolean; // production must log at "info" or the counts above would be empty
};

// One flat row: one value per spreadsheet column.
export type WeeklyReport = {
  status: "ok" | "empty"; // "empty" = no requests at all this week (Make sends this to the Flags tab)
  week_start: string; // YYYY-MM-DD, 7 days before generated_at
  week_end: string; // YYYY-MM-DD
  generated_at: string; // full timestamp
  requests: number;
  server_errors_5xx: number;
  error_rate_pct: number;
  p50_ms: number | null;
  p95_ms: number | null;
  questions_asked: number;
  answered: number;
  refused: number;
  bad_requests_400: number;
  unauthorized_401: number;
  forbidden_403: number;
  too_many_429: number;
  auth_failures: number;
  injection_blocked: number;
  cap_hits: number;
  corpus_chunks: number;
  corpus_chunks_flagged: number;
  admin_key_set: boolean;
  anthropic_key_set: boolean;
  log_level_ok: boolean;
  logging_alive: boolean;
  security_status: "ok" | "attention";
  security_notes: string; // short codes joined by ";" or "none"
};

// Rounds to 2 decimal places.
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Decides the security status. "alerts" make the status "attention"; "notices" are written in
// the notes but do not change it (one blocked injection means the defense worked).
export function evaluateSecurity(input: ReportInputs): { status: "ok" | "attention"; notes: string[] } {
  const alerts: string[] = [];
  const notices: string[] = [];

  if (input.corpusChunksFlagged > 0) alerts.push("corpus_chunk_flagged");
  if (input.authFailures >= AUTH_FAILURES_ATTENTION_AT) alerts.push("auth_failures_high");
  if (!input.adminKeySet) alerts.push("admin_key_missing");
  if (!input.anthropicKeySet) alerts.push("anthropic_key_missing");
  if (!input.logLevelOk) alerts.push("log_level_not_info");
  if (!isLoggingAlive(input)) alerts.push("logging_stale");
  if (input.capHits > 0) alerts.push("hourly_cap_hit");

  if (input.injectionBlocked > 0) notices.push("injection_blocked");
  if (input.authFailures > 0 && input.authFailures < AUTH_FAILURES_ATTENTION_AT) notices.push("auth_failures_some");

  return { status: alerts.length > 0 ? "attention" : "ok", notes: [...alerts, ...notices] };
}

// True when the newest log line is recent enough.
export function isLoggingAlive(input: Pick<ReportInputs, "now" | "newestLogAt">): boolean {
  if (!input.newestLogAt) return false;
  return input.now.getTime() - input.newestLogAt.getTime() < LOG_STALE_AFTER_HOURS * 60 * 60 * 1000;
}

// Turns the raw inputs into the flat report row.
export function buildReport(input: ReportInputs): WeeklyReport {
  const security = evaluateSecurity(input);
  const weekStart = new Date(input.now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return {
    status: input.requests === 0 ? "empty" : "ok",
    week_start: weekStart.toISOString().slice(0, 10),
    week_end: input.now.toISOString().slice(0, 10),
    generated_at: input.now.toISOString(),
    requests: input.requests,
    server_errors_5xx: input.serverErrors5xx,
    error_rate_pct: input.requests === 0 ? 0 : round2((input.serverErrors5xx / input.requests) * 100),
    p50_ms: input.p50Ms === null ? null : Math.round(input.p50Ms),
    p95_ms: input.p95Ms === null ? null : Math.round(input.p95Ms),
    questions_asked: input.questionsAsked,
    answered: input.answered,
    refused: input.refused,
    bad_requests_400: input.badRequests400,
    unauthorized_401: input.unauthorized401,
    forbidden_403: input.forbidden403,
    too_many_429: input.tooMany429,
    auth_failures: input.authFailures,
    injection_blocked: input.injectionBlocked,
    cap_hits: input.capHits,
    corpus_chunks: input.corpusChunks,
    corpus_chunks_flagged: input.corpusChunksFlagged,
    admin_key_set: input.adminKeySet,
    anthropic_key_set: input.anthropicKeySet,
    log_level_ok: input.logLevelOk,
    logging_alive: isLoggingAlive(input),
    security_status: security.status,
    security_notes: security.notes.length > 0 ? security.notes.join(";") : "none",
  };
}
