// scripts/eval.ts
// WHAT IT'S FOR: runs the golden set (eval/golden-set.json) through the answer engine, scores it
// on the TWO measures (retrieval and answer), applies the pass/fail gate (eval/gate.json), prints
// the scores, and writes the one-page baseline report to docs/.
// WHO USES IT: you, from your computer:
//     npm run eval                      -> writes docs/eval-baseline-report.md (label v1)
//     npm run eval -- --label=v2 --out=docs/eval-rerun-v2.md
// It uses your DEVELOPMENT database (.env.local) and the real Claude API (about 10 questions,
// well under a dollar). The exit code is 1 when the gate says DO NOT SHIP, so the gate is real.
// WHY THE NAME: "eval" = evaluation; a one-off command-line "script".
//
// THE RULE THAT MAKES THE GATE REAL: the script REFUSES to run if eval/golden-set.json or
// eval/gate.json has uncommitted changes or was never committed. The numbers and the questions
// are fixed in git history before any score exists.
//
// SAFETY: nothing secret is printed or written. The report contains the golden questions and the
// engine's scores, never keys. The question text is not written to the log table.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { ClaudeError, getAnswerModel } from "../lib/anthropic";
import { answerQuestion } from "../lib/answer";
import {
  applyGate,
  failedItem,
  gateSchema,
  goldenSetSchema,
  renderReport,
  scoreItem,
  type ItemScore,
} from "../lib/eval";
import { flushLogs, log } from "../lib/logger";
import { getEmbeddingStatus } from "../lib/search";

// Load the keys (DATABASE_URL, OPENAI_API_KEY, ANTHROPIC_API_KEY) from .env.local.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: fine if the variables are already set some other way.
}

const SET_FILE = "eval/golden-set.json";
const GATE_FILE = "eval/gate.json";

// Prints one line (we avoid console.log in this project).
function print(line: string): void {
  process.stdout.write(`${line}\n`);
}

// Reads a "--name=value" option, or the default.
function option(name: string, fallback: string): string {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3) : fallback;
}

// Runs git with a fixed list of arguments (never a shell string) and returns its text.
function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

// The "committed first" rule. Returns "<short hash> <commit date>" for a file, or stops the run.
function requireCommitted(file: string): string {
  if (git(["status", "--porcelain", "--", file]) !== "") {
    throw new Error(`${file} has uncommitted changes. Commit the golden set and the gate BEFORE running the eval.`);
  }
  const last = git(["log", "-1", "--format=%h %cI", "--", file]);
  if (last === "") throw new Error(`${file} has never been committed. Commit it BEFORE running the eval.`);
  return last;
}

async function main(): Promise<number> {
  const label = option("label", "v1");
  const out = option("out", "docs/eval-baseline-report.md");
  if (!/^[A-Za-z0-9._-]{1,20}$/.test(label)) throw new Error("--label may only use letters, digits, dots, dashes");
  if (!/^docs\/[A-Za-z0-9._-]+\.md$/.test(out)) throw new Error("--out must look like docs/some-name.md");

  // 1. The frozen files, checked and committed.
  const setText = readFileSync(SET_FILE, "utf8");
  const goldenSet = goldenSetSchema.parse(JSON.parse(setText));
  const gate = gateSchema.parse(JSON.parse(readFileSync(GATE_FILE, "utf8")));
  const setCommit = requireCommitted(SET_FILE);
  const gateCommit = requireCommitted(GATE_FILE);
  const goldenSetSha = createHash("sha256").update(setText).digest("hex");

  // 2. Run every question through the real engine.
  const startedAt = Date.now();
  const scores: ItemScore[] = [];
  for (const item of goldenSet.items) {
    try {
      const result = await answerQuestion(item.question);
      const score = scoreItem(item, result);
      scores.push(score);
      print(`#${item.id} ${item.kind.padEnd(10)} retrieval ${String(score.retrievalHit ?? "n/a").padEnd(5)} answer ${score.answerPass ? "pass" : "FAIL"}  ${item.question}`);
    } catch (error) {
      const why = error instanceof ClaudeError ? `the engine failed (status ${error.status})` : "the engine failed";
      scores.push(failedItem(item, why));
      print(`#${item.id} ${item.kind.padEnd(10)} ENGINE ERROR  ${item.question}`);
    }
  }

  // 3. Score, apply the gate, write the report.
  const verdict = applyGate(scores, gate);
  const status = await getEmbeddingStatus();
  const report = renderReport(scores, verdict, gate, {
    label,
    ranAt: new Date().toISOString(),
    model: getAnswerModel(),
    chunksStored: status.embeddedChunks,
    goldenSetSha,
    gateCommit,
    setCommit,
  });
  writeFileSync(out, report);

  print("");
  print(`RETRIEVAL  ${verdict.retrievalScore}/${verdict.retrievalOutOf}  (gate: at least ${gate.retrieval.passMin})  ${verdict.retrievalPass ? "PASS" : "FAIL"}`);
  print(`ANSWER     ${verdict.answerScore}/${verdict.answerOutOf}  (gate: at least ${gate.answer.passMin})  ${verdict.answerPass ? "PASS" : "FAIL"}`);
  print(`REFUSALS   ${verdict.refusalsPassed}/${verdict.refusalsTotal}  (gate: ${gate.refusalsMustAllPass ? "all" : "not required"})  ${verdict.refusalsPass ? "PASS" : "FAIL"}`);
  print(`VERDICT    ${verdict.ship ? "SHIP" : "DO NOT SHIP"}`);
  print(`Report written to ${out}`);

  // Numbers and yes/no facts only (no question text).
  log.info("eval_run", {
    label,
    items: scores.length,
    retrievalScore: verdict.retrievalScore,
    answerScore: verdict.answerScore,
    refusalsPassed: verdict.refusalsPassed,
    ship: verdict.ship,
    ms: Date.now() - startedAt,
  });
  return verdict.ship ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    // A short message only (never the whole error).
    print(error instanceof Error ? error.message : "The eval could not run.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await flushLogs();
  });
