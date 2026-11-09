// lib/answer.ts
// WHAT IT'S FOR: the answer engine. Given a question it:
//   1. SEARCHES: finds the top 3 closest passages in the vector store (lib/search.ts),
//   2. BUILDS the context (each passage labeled with its document and section) and the prompt,
//   3. ASKS Claude (lib/anthropic.ts),
//   4. CHECKS the reply: splits answer from citations and verifies each citation matches a
//      passage we really retrieved (lib/rag.ts),
//   5. LOGS one `rag_answer` line (numbers and yes/no facts only).
// WHO USES IT: scripts/ask.ts (the command line). A future API route can use it too, so the
// rules stay on the server and the mobile app gets the same behavior.
// WHY THE NAME: it produces an "answer" from the passages.
//
// PRIVACY: the question text and the answer text are NEVER logged. Only the question's length,
// counts, the top score, the outcome, and timing.

import { askClaude, ClaudeError } from "./anthropic";
import { log } from "./logger";
import {
  buildSystemPrompt,
  buildUserMessage,
  citationsMatchPassages,
  parseModelAnswer,
  PASSAGES_TO_RETRIEVE,
  REFUSAL_LINE,
} from "./rag";
import { searchCorpus } from "./search";
import type { RagResult } from "./types";

// Answers one question. Throws ClaudeError if the Claude call fails.
export async function answerQuestion(question: string): Promise<RagResult> {
  const startedAt = Date.now();
  const passages = await searchCorpus(question, PASSAGES_TO_RETRIEVE);

  // Nothing in the store at all: refuse without paying for a Claude call.
  if (passages.length === 0) {
    const tookMs = Date.now() - startedAt;
    log.info("rag_answer", { questionLength: question.length, passages: 0, outcome: "refused", citationsVerified: false, ms: tookMs });
    return { outcome: "refused", answer: REFUSAL_LINE, citations: [], citationsVerified: false, passages, tookMs };
  }

  let reply;
  try {
    reply = await askClaude(buildSystemPrompt(), buildUserMessage(question, passages));
  } catch (error) {
    // Log the status number only (never the key, the question, or any response body).
    const status = error instanceof ClaudeError ? error.status : null;
    log.error("rag_failed", { questionLength: question.length, status, ms: Date.now() - startedAt });
    throw error;
  }

  const parsed = parseModelAnswer(reply.text);
  // A refusal has no citations to check. An answer is "verified" only if every citation is real.
  const citationsVerified =
    parsed.outcome === "refused" ? true : citationsMatchPassages(parsed.citations, passages);
  const tookMs = Date.now() - startedAt;

  log.info("rag_answer", {
    questionLength: question.length,
    passages: passages.length,
    topScore: passages[0]?.score ?? null,
    outcome: parsed.outcome,
    citationsVerified,
    model: reply.model,
    // Named usageIn/usageOut (not "tokens") because the log redaction hides any key containing "token".
    usageIn: reply.inputTokens,
    usageOut: reply.outputTokens,
    ms: tookMs,
  });

  return { outcome: parsed.outcome, answer: parsed.answer, citations: parsed.citations, citationsVerified, passages, tookMs };
}
