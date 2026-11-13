// app/api/ask/route.ts
// WHAT IT'S FOR: the public question endpoint. POST /api/ask with {"question": "..."} returns a
// cited answer, or the exact refusal line when the documents don't cover it. No login: it is the
// public "ask MyChair" feature, so it protects itself three ways:
//   1. the question is checked on the server (3 to 300 characters, and the body is tiny),
//   2. a global hourly cap (from the log table) answers 429 "busy" once it is reached,
//   3. a spending limit in the Anthropic Console (set outside the code).
// WHO USES IT: components/AskBox.tsx (the /ask page), and you in Postman or curl.
// WHY THE NAME: folder path = URL (app/api/ask -> /api/ask); "route.ts" = an API route.
//
// PRIVACY: the question and the answer are never logged. Only counts and timing.

import { ApiError } from "@/lib/api-error";
import { answerQuestion } from "@/lib/answer";
import {
  ASK_EVENT,
  askInputSchema,
  buildAskResponse,
  countAsksLastHour,
  isOverCap,
  MAX_BODY_CHARS,
  parseHourlyCap,
} from "@/lib/ask";
import { log } from "@/lib/logger";
import { withLogging } from "@/lib/with-logging";

// Never cache: every question is live.
export const dynamic = "force-dynamic";
// Room for the search plus the Claude call.
export const maxDuration = 60;

export const POST = withLogging("/api/ask", async (request) => {
  // 1. Read the body, but refuse anything oversized before parsing it.
  const raw = await request.text();
  if (raw.length > MAX_BODY_CHARS) {
    throw new ApiError(400, "BAD_QUESTION", "That question is too long. Please keep it under 300 characters.");
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ApiError(400, "BAD_QUESTION", "Please send your question as text.");
  }
  const parsed = askInputSchema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError(400, "BAD_QUESTION", "Please type a question between 3 and 300 characters.");
  }
  const question = parsed.data.question;

  // 2. The global hourly cap. If the log table can't be read we refuse (fail closed): better a
  //    "try later" than an uncapped bill.
  let askedLastHour: number;
  try {
    askedLastHour = await countAsksLastHour();
  } catch (cause) {
    throw new ApiError(503, "TEMPORARILY_UNAVAILABLE", "Questions are unavailable right now. Please try again soon.", { cause });
  }
  const cap = parseHourlyCap(process.env.ASK_HOURLY_CAP);
  if (isOverCap(askedLastHour, cap)) {
    log.warn("ask_cap_reached", { askedLastHour, cap });
    throw new ApiError(429, "BUSY", "Lots of people are asking right now. Please try again in a little while.");
  }

  // This line is what the cap counts. Length only, never the question.
  log.info(ASK_EVENT, { questionLength: question.length });

  // 3. Answer. If Claude, OpenAI or the database fails, the visitor gets a safe message and the
  //    real reason (a status number) is logged by the wrapper.
  let result;
  try {
    result = await answerQuestion(question);
  } catch (cause) {
    throw new ApiError(502, "ANSWER_FAILED", "I couldn't answer that right now. Please try again.", { cause });
  }

  // 4. Only show an answer whose citations check out.
  const body = buildAskResponse(result);
  if (!body) {
    throw new ApiError(502, "ANSWER_UNVERIFIED", "I couldn't produce a verified answer. Please try rephrasing your question.");
  }
  return Response.json(body);
});
