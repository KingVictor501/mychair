// lib/report-data.ts
// WHAT IT'S FOR: gathers the raw numbers for the weekly report: it counts log lines from the
// last 7 days in the log table, runs the injection screen over every stored corpus passage, and
// reads yes/no facts about the server's settings (never the setting values).
// WHO USES IT: app/api/admin/weekly-report/route.ts.
// WHY THE NAME: it fetches the data for lib/report.ts; ".ts" = no screen code.
//
// PRIVACY: it reads only event names, status numbers and timings from the log table, plus the
// text of the public help-document passages (to screen them). It returns numbers and yes/no.

import { sql } from "drizzle-orm";
import { getDb } from "./db/client";
import { corpusChunks, logEntries } from "./db/schema";
import { findInjectionRule } from "./injection";
import { getActiveLevel } from "./logger";
import type { ReportInputs } from "./report";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Collects every number the report needs.
export async function gatherReportInputs(now: Date = new Date()): Promise<ReportInputs> {
  const db = getDb();
  const since = new Date(now.getTime() - WEEK_MS);

  // One pass over the last 7 days of log lines. "count(*) filter (where ...)" counts only the rows
  // that match. The status and ms live inside the JSON "details" column; the CASE keeps the casts
  // from running on lines that don't have those fields.
  const status = sql`(case when ${logEntries.event} = 'request_done' then (${logEntries.details}->>'status')::int end)`;
  const ms = sql`(case when ${logEntries.event} = 'request_done' then (${logEntries.details}->>'ms')::float end)`;
  const [row] = await db
    .select({
      requests: sql<number>`count(*) filter (where ${logEntries.event} = 'request_done')`,
      serverErrors5xx: sql<number>`count(*) filter (where ${status} >= 500)`,
      unauthorized401: sql<number>`count(*) filter (where ${status} = 401)`,
      forbidden403: sql<number>`count(*) filter (where ${status} = 403)`,
      tooMany429: sql<number>`count(*) filter (where ${status} = 429)`,
      badRequests400: sql<number>`count(*) filter (where ${status} = 400)`,
      p50Ms: sql<number | null>`percentile_cont(0.5) within group (order by ${ms})`,
      p95Ms: sql<number | null>`percentile_cont(0.95) within group (order by ${ms})`,
      questionsAsked: sql<number>`count(*) filter (where ${logEntries.event} = 'ask_received')`,
      answered: sql<number>`count(*) filter (where ${logEntries.event} = 'rag_answer' and ${logEntries.details}->>'outcome' = 'answered')`,
      refused: sql<number>`count(*) filter (where ${logEntries.event} = 'rag_answer' and ${logEntries.details}->>'outcome' = 'refused')`,
      injectionBlocked: sql<number>`count(*) filter (where ${logEntries.event} = 'injection_attempt_detected')`,
      authFailures: sql<number>`count(*) filter (where ${logEntries.event} = 'admin_auth_failed')`,
      capHits: sql<number>`count(*) filter (where ${logEntries.event} = 'ask_cap_reached')`,
    })
    .from(logEntries)
    .where(sql`${logEntries.ts} >= ${since}`);

  // The newest log line of any kind: if it is old, logging has stopped.
  const [newest] = await db.select({ ts: sql<Date | null>`max(${logEntries.ts})` }).from(logEntries);

  // Screen every stored passage the way live questions are screened.
  const passages = await db.select({ heading: corpusChunks.heading, body: corpusChunks.body }).from(corpusChunks);
  const flagged = passages.filter((p) => findInjectionRule(`${p.heading}\n${p.body}`) !== null).length;

  // Percentiles come back as numbers or text depending on the driver, so convert carefully.
  const num = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));
  return {
    now,
    requests: Number(row?.requests ?? 0),
    serverErrors5xx: Number(row?.serverErrors5xx ?? 0),
    unauthorized401: Number(row?.unauthorized401 ?? 0),
    forbidden403: Number(row?.forbidden403 ?? 0),
    tooMany429: Number(row?.tooMany429 ?? 0),
    badRequests400: Number(row?.badRequests400 ?? 0),
    p50Ms: num(row?.p50Ms),
    p95Ms: num(row?.p95Ms),
    questionsAsked: Number(row?.questionsAsked ?? 0),
    answered: Number(row?.answered ?? 0),
    refused: Number(row?.refused ?? 0),
    injectionBlocked: Number(row?.injectionBlocked ?? 0),
    authFailures: Number(row?.authFailures ?? 0),
    capHits: Number(row?.capHits ?? 0),
    corpusChunks: passages.length,
    corpusChunksFlagged: flagged,
    newestLogAt: newest?.ts ? new Date(newest.ts) : null,
    // Only whether they are set, never the values.
    adminKeySet: Boolean(process.env.ADMIN_API_KEY),
    anthropicKeySet: Boolean(process.env.ANTHROPIC_API_KEY),
    // Production must log at "info", or request_done lines would never be saved.
    logLevelOk: getActiveLevel() === "info",
  };
}
