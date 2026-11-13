// lib/eval.ts
// WHAT IT'S FOR: the rules of the eval ("evaluation"): how one question from the golden set is
// scored, how the scores are compared with the pass/fail gate, and how the one-page report is
// written. No database or internet is needed here, so every rule can be tested (lib/eval.test.ts).
//   TWO MEASURES, scored separately and never blended:
//     RETRIEVAL = did the search bring back the right section? (the librarian)
//     ANSWER    = did the engine give the right answer WITH a matching citation, or refuse
//                 correctly when the documents are silent? (the writer)
// The questions live in eval/golden-set.json and the thresholds in eval/gate.json. Both are
// committed to git BEFORE the first run, so the verdict is a decision made in advance.
// WHO USES IT: scripts/eval.ts (runs the eval) and lib/eval.test.ts.
// WHY THE NAME: "eval" = evaluation, measuring how good the engine is.

// "z" comes from the zod package: it describes what a valid golden-set file looks like and
// refuses anything else, so a typo in the file is caught before a run is scored.
import { z } from "zod";
import { passageLabel } from "./rag";
import type { RagResult } from "./types";

// One question the system must get right, forever.
export const goldenItemSchema = z.object({
  id: z.number().int().positive(),
  kind: z.enum(["answerable", "refuse"]),
  question: z.string().min(2).max(500),
  expectedAnswer: z.string().min(1),
  // The document and section that must be among the retrieved passages (null for refusals).
  expectedSource: z.object({ document: z.string().min(1), section: z.string() }).nullable(),
  // Every inner list is one required fact; the answer must contain at least ONE of its words.
  requiredPhrases: z.array(z.array(z.string().min(1)).min(1)),
  passCriteria: z.string().min(1),
});
export type GoldenItem = z.infer<typeof goldenItemSchema>;

export const goldenSetSchema = z.object({
  version: z.number().int(),
  description: z.string(),
  items: z.array(goldenItemSchema).min(1),
});
export type GoldenSet = z.infer<typeof goldenSetSchema>;

// The gate: thresholds chosen in advance.
export const gateSchema = z.object({
  version: z.number().int(),
  description: z.string(),
  retrieval: z.object({ measure: z.string(), passMin: z.number().int(), outOf: z.number().int() }),
  answer: z.object({ measure: z.string(), passMin: z.number().int(), outOf: z.number().int() }),
  refusalsMustAllPass: z.boolean(),
});
export type Gate = z.infer<typeof gateSchema>;

// The result of one question.
export type ItemScore = {
  id: number;
  kind: "answerable" | "refuse";
  question: string;
  // true/false for answerable items; null for refusals (there is no source to find).
  retrievalHit: boolean | null;
  answerPass: boolean;
  // Plain-English reasons for a failure (empty when everything passed).
  reasons: string[];
  topScore: number | null;
  outcome: string;
  citations: string[];
  failed: boolean; // the engine itself could not run (for example a Claude error)
};

// "document · section", the same label the engine uses for citations.
export function expectedLabel(item: GoldenItem): string | null {
  return item.expectedSource ? passageLabel({ source: item.expectedSource.document, heading: item.expectedSource.section }) : null;
}

// Lower-case and drop markdown bold, so "**2 hours**" matches "2 hours".
function normalize(text: string): string {
  return text.replace(/\*\*/g, "").toLowerCase();
}

// RETRIEVAL measure for one item: was the expected section among the retrieved passages?
export function scoreRetrieval(item: GoldenItem, result: RagResult): boolean | null {
  const label = expectedLabel(item);
  if (label === null) return null;
  return result.passages.some((p) => passageLabel(p) === label);
}

// ANSWER measure for one item. A right fact with no matching citation FAILS.
export function scoreAnswer(item: GoldenItem, result: RagResult): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (item.kind === "refuse") {
    if (result.outcome !== "refused") reasons.push("the question must be refused, but the engine answered");
    return { pass: reasons.length === 0, reasons };
  }

  if (result.outcome === "refused") reasons.push("the engine refused a question the documents can answer");
  if (result.outcome === "malformed") reasons.push("the reply did not follow the answer format");

  const answer = normalize(result.answer);
  item.requiredPhrases.forEach((alternatives) => {
    if (!alternatives.some((word) => answer.includes(normalize(word)))) {
      reasons.push(`the answer is missing the fact "${alternatives[0]}"`);
    }
  });

  const label = expectedLabel(item);
  if (result.outcome === "answered") {
    if (!result.citationsVerified) reasons.push("a citation did not match any retrieved passage");
    if (label !== null && !result.citations.includes(label)) {
      reasons.push(`the expected source "${label}" was not cited`);
    }
  }
  return { pass: reasons.length === 0, reasons };
}

// Scores one item from the engine's result.
export function scoreItem(item: GoldenItem, result: RagResult): ItemScore {
  const { pass, reasons } = scoreAnswer(item, result);
  const retrievalHit = scoreRetrieval(item, result);
  if (retrievalHit === false) reasons.unshift("retrieval missed the expected section");
  return {
    id: item.id,
    kind: item.kind,
    question: item.question,
    retrievalHit,
    answerPass: pass,
    reasons,
    topScore: result.passages[0]?.score ?? null,
    outcome: result.outcome,
    citations: result.citations,
    failed: false,
  };
}

// An item where the engine itself failed (for example Claude was unreachable). Counts as a fail.
export function failedItem(item: GoldenItem, why: string): ItemScore {
  return {
    id: item.id,
    kind: item.kind,
    question: item.question,
    retrievalHit: item.kind === "answerable" ? false : null,
    answerPass: false,
    reasons: [why],
    topScore: null,
    outcome: "error",
    citations: [],
    failed: true,
  };
}

// The two scores compared with the gate.
export type Verdict = {
  retrievalScore: number;
  retrievalOutOf: number;
  answerScore: number;
  answerOutOf: number;
  refusalsPassed: number;
  refusalsTotal: number;
  retrievalPass: boolean;
  answerPass: boolean;
  refusalsPass: boolean;
  ship: boolean;
};

// Applies the gate. It refuses to run if the gate's "out of" numbers do not match the real
// item counts: that would mean the set or the gate was changed without the other.
export function applyGate(scores: ItemScore[], gate: Gate): Verdict {
  const answerable = scores.filter((s) => s.kind === "answerable");
  const refusals = scores.filter((s) => s.kind === "refuse");
  if (gate.retrieval.outOf !== answerable.length || gate.answer.outOf !== scores.length) {
    throw new Error("The gate's 'out of' numbers do not match the golden set. Fix one of them and commit both.");
  }
  const retrievalScore = answerable.filter((s) => s.retrievalHit === true).length;
  const answerScore = scores.filter((s) => s.answerPass).length;
  const refusalsPassed = refusals.filter((s) => s.answerPass).length;
  const retrievalPass = retrievalScore >= gate.retrieval.passMin;
  const answerPass = answerScore >= gate.answer.passMin;
  const refusalsPass = !gate.refusalsMustAllPass || refusalsPassed === refusals.length;
  return {
    retrievalScore,
    retrievalOutOf: answerable.length,
    answerScore,
    answerOutOf: scores.length,
    refusalsPassed,
    refusalsTotal: refusals.length,
    retrievalPass,
    answerPass,
    refusalsPass,
    ship: retrievalPass && answerPass && refusalsPass,
  };
}

// What the report needs to know about the run, beyond the scores.
export type RunInfo = {
  label: string; // e.g. "v1"
  ranAt: string; // ISO time
  model: string;
  chunksStored: number;
  goldenSetSha: string; // fingerprint of eval/golden-set.json, proving the set did not change
  gateCommit: string; // e.g. "a1b2c3d 2026-11-13T10:00:00-07:00"
  setCommit: string;
};

const passWord = (ok: boolean): string => (ok ? "PASS" : "FAIL");

// Writes the one-page baseline report (markdown) from the scores.
export function renderReport(scores: ItemScore[], verdict: Verdict, gate: Gate, info: RunInfo): string {
  const rows = scores
    .map((s) => {
      const retrieval = s.retrievalHit === null ? "n/a" : s.retrievalHit ? "hit" : "MISS";
      const answer = s.answerPass ? "pass" : "FAIL";
      const top = s.topScore === null ? "" : s.topScore.toFixed(3);
      return `| ${s.id} | ${s.kind} | ${s.question} | ${retrieval} | ${answer} | ${top} |`;
    })
    .join("\n");
  const misses = scores.filter((s) => s.reasons.length > 0);
  const missLines =
    misses.length === 0
      ? "No misses: every item passed both measures."
      : misses.map((s) => `- **Item ${s.id}** (${s.question}): ${s.reasons.join("; ")}.`).join("\n");

  return `# MyChair RAG engine: baseline report ${info.label}

Golden set: ${scores.length} questions, frozen. Engine: the Day 1 build over the MyChair corpus (${info.chunksStored} chunks), model \`${info.model}\`. Run: ${info.ranAt}.

## A. The two measures, scored separately

| Measure | Score | Gate | Result |
|---|---|---|---|
| Retrieval (the right section was among the top 3 passages) | ${verdict.retrievalScore}/${verdict.retrievalOutOf} | at least ${gate.retrieval.passMin}/${gate.retrieval.outOf} | **${passWord(verdict.retrievalPass)}** |
| Answer (right answer with a matching citation, or an exact refusal) | ${verdict.answerScore}/${verdict.answerOutOf} | at least ${gate.answer.passMin}/${gate.answer.outOf} | **${passWord(verdict.answerPass)}** |
| Refusals (every must-refuse question refused) | ${verdict.refusalsPassed}/${verdict.refusalsTotal} | ${gate.refusalsMustAllPass ? "all of them" : "not required"} | **${passWord(verdict.refusalsPass)}** |

### Every item

| # | Kind | Question | Retrieval | Answer | Top score |
|---|---|---|---|---|---|
${rows}

### Misses on record

${missLines}

## B. The gate, written before the run

The thresholds above are in \`eval/gate.json\` and the questions are in \`eval/golden-set.json\`. Both were committed before this run:

- gate.json last committed: \`${info.gateCommit}\`
- golden-set.json last committed: \`${info.setCommit}\`
- golden-set.json fingerprint (SHA-256): \`${info.goldenSetSha}\`

The run script refuses to start if either file has uncommitted changes. The verdict is a decision made in advance; the run only shows which side of it the system is on.

**Gate verdict: ${verdict.ship ? "SHIP, all three conditions clear" : "DO NOT SHIP, at least one condition failed"}.**

## How the scores are decided

- **Retrieval** is a hit when the expected \`document · section\` is among the 3 passages the search returned. Refusal questions have no expected source, so they are not counted here.
- **Answer** is a pass when the engine's reply contains every required fact from the golden item, cites the expected \`document · section\`, and every citation matches a retrieved passage. A right fact with no matching citation fails. A must-refuse question passes only when the reply is the exact refusal line.
- Facts are checked as plain words in the reply (see \`requiredPhrases\` in the golden set), not by another AI, so the same reply always gets the same score.
`;
}
