// lib/ask.ts
// WHAT IT'S FOR: the rules for the PUBLIC "ask a question" feature, kept apart from the route so
// they can be tested without a database or internet:
//   1. askInputSchema: what a visitor may send (a question of 3 to 300 characters),
//   2. the hourly cap: a global limit on how many questions the whole site answers per hour,
//      counted from the `ask_received` lines in the log table (so it works across servers),
//   3. buildAskResponse: turns the engine's result into what the visitor sees, with every cited
//      source attached as a "receipt". An answer whose citations don't check out is never shown.
// WHO USES IT: app/api/ask/route.ts, and lib/ask.test.ts.
// WHY THE NAME: it is the "ask" feature; ".ts" = plain logic, no screen code.
//
// WHY A CAP: every question costs money (an embedding plus a Claude call) and the page is public.
// Two brakes: question length limits (here) and a global hourly cap (here). The third brake is a
// spending limit set in the Anthropic Console, outside the code.

// "z" comes from zod: checks the shape and size of data that arrives from outside.
import { z } from "zod";
// "and", "eq", "gte", "sql" come from Drizzle: they build the "count recent lines" query.
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "./db/client";
import { logEntries } from "./db/schema";
import { passageLabel } from "./rag";
import type { AskResponse, AskSource, RagResult } from "./types";

export const MIN_QUESTION_LENGTH = 3;
export const MAX_QUESTION_LENGTH = 300;

// The most text we will even read from a request body (a question is at most 300 characters).
export const MAX_BODY_CHARS = 1000;

// The shape of the request body: { "question": "..." }.
export const askInputSchema = z.object({
  question: z.string().trim().min(MIN_QUESTION_LENGTH).max(MAX_QUESTION_LENGTH),
});

// The log event written once for every question that arrives. The cap counts these lines.
export const ASK_EVENT = "ask_received";

// The default cap: 60 questions per hour for the whole site. Override with ASK_HOURLY_CAP.
export const DEFAULT_HOURLY_CAP = 60;

// Reads the cap from the environment text. Anything that isn't a whole number from 1 to 10,000
// falls back to the default, so a typo can't switch the limit off.
export function parseHourlyCap(value: string | undefined): number {
  if (value === undefined || !/^\d+$/.test(value)) return DEFAULT_HOURLY_CAP;
  const n = Number(value);
  return n >= 1 && n <= 10_000 ? n : DEFAULT_HOURLY_CAP;
}

// True when the site has already answered as many questions as the cap allows this hour.
export function isOverCap(askedLastHour: number, cap: number): boolean {
  return askedLastHour >= cap;
}

// How many questions arrived in the last hour, counted from the log table itself.
export async function countAsksLastHour(now: Date = new Date()): Promise<number> {
  const since = new Date(now.getTime() - 60 * 60 * 1000);
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(logEntries)
    .where(and(eq(logEntries.event, ASK_EVENT), gte(logEntries.ts, since)));
  return Number(row?.count ?? 0);
}

// Turns the engine's result into the visitor's response, or returns null when the result must
// NOT be shown (a reply that broke the format, or a citation that doesn't match a retrieved passage).
export function buildAskResponse(result: RagResult): AskResponse | null {
  if (result.outcome === "refused") {
    return { outcome: "refused", answer: result.answer, sources: [] };
  }
  if (result.outcome !== "answered" || !result.citationsVerified) return null;

  // Attach each cited passage as a receipt. Verified citations always match a passage.
  const sources: AskSource[] = [];
  for (const citation of result.citations) {
    const passage = result.passages.find((p) => passageLabel(p) === citation);
    if (!passage) return null;
    sources.push({ document: passage.source, section: passage.heading, label: citation, excerpt: passage.text });
  }
  if (sources.length === 0) return null;
  return { outcome: "answered", answer: result.answer, sources };
}
