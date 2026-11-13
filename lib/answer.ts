// lib/answer.ts
// WHAT IT'S FOR: the answer engine. Given a question it:
//   1. SEARCHES: finds the top 3 closest passages in the vector store (lib/search.ts),
//   2. SCREENS the passages for prompt injection (lib/injection.ts): a passage that tries to give
//      the AI orders is removed and logged as `injection_attempt_detected`,
//   3. BUILDS the context (each passage labeled with its document and section) and the prompt,
//   4. ASKS Claude (lib/anthropic.ts),
//   5. CHECKS the reply: splits answer from citations and verifies each citation matches a
//      passage we really retrieved (lib/rag.ts),
//   6. LOGS one `rag_answer` line (numbers and yes/no facts only).
// WHO USES IT: scripts/ask.ts (the command line). A future API route can use it too, so the
// rules stay on the server and the mobile app gets the same behavior.
// WHY THE NAME: it produces an "answer" from the passages.
//
// PRIVACY: the question text and the answer text are NEVER logged. Only the question's length,
// counts, the top score, the outcome, and timing.

import { askClaude, ClaudeError } from "./anthropic";
import { screenPassages } from "./injection";
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
// "screen" is true for everyone. Only scripts/injection-test.ts passes false, to show what the
// planted document does when the screen is switched off.
export async function answerQuestion(question: string, options: { screen?: boolean } = {}): Promise<RagResult> {
  const startedAt = Date.now();
  const retrieved = await searchCorpus(question, PASSAGES_TO_RETRIEVE);

  // Remove any passage that tries to give the AI orders, and log each one that was caught.
  // The log line says WHAT was attempted (document, section, score, rank, rule) and WHAT blocked
  // it (the screen rule + action). It never contains the passage text.
  const { safe: passages, blocked } = options.screen === false ? { safe: retrieved, blocked: [] } : screenPassages(retrieved);
  for (const item of blocked) {
    log.warn("injection_attempt_detected", {
      source: item.source,
      section: item.heading,
      score: item.score,
      rank: item.rank,
      rule: item.rule,
      blockedBy: "injection_screen",
      action: "passage_removed_before_model",
    });
  }

  // Nothing in the store at all: refuse without paying for a Claude call.
  if (passages.length === 0) {
    const tookMs = Date.now() - startedAt;
    log.info("rag_answer", { questionLength: question.length, passages: 0, outcome: "refused", citationsVerified: false, blockedPassages: blocked.length, ms: tookMs });
    return { outcome: "refused", answer: REFUSAL_LINE, citations: [], citationsVerified: false, passages, blockedPassages: blocked.length, tookMs };
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
    blockedPassages: blocked.length,
    model: reply.model,
    // Named usageIn/usageOut (not "tokens") because the log redaction hides any key containing "token".
    usageIn: reply.inputTokens,
    usageOut: reply.outputTokens,
    ms: tookMs,
  });

  return { outcome: parsed.outcome, answer: parsed.answer, citations: parsed.citations, citationsVerified, passages, blockedPassages: blocked.length, tookMs };
}
