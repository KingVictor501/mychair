// lib/rag.test.ts
// WHAT IT'S FOR: automated checks of the answer-engine rules in lib/rag.ts, with no internet:
// labels reach the context, the prompt contains the grounding rule and the exact refusal line,
// replies are split correctly (including the "Chalk Bag + Chalk" case), and citations are checked
// against the passages we retrieved. Run with `npm test`.
// WHY THE NAME: "<file>.test.ts" = the tests for <file>.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSystemPrompt,
  buildUserMessage,
  citationsMatchPassages,
  formatContext,
  parseModelAnswer,
  passageLabel,
  REFUSAL_LINE,
  splitCitations,
} from "./rag";
import type { SearchResult } from "./types";

// Builds a fake retrieved passage.
function passage(source: string, heading: string, text: string): SearchResult {
  return { id: `${source}-${heading}`, source, heading, text, score: 0.6 };
}

const returns = passage("returns-shipping-policy.txt", "SECTION 1 — RETURNS", "Refund window: 30 days.");
const manual = passage("store-operations-manual.md", "4. Processing a Customer Return", "Register steps.");
const chalk = passage("pricing.csv", "Chalk Bag + Chalk", "Price: 24.00");

test("the refusal line is exactly the one in docs/answer-format.md", () => {
  assert.equal(REFUSAL_LINE, "I don't know — the documents I have don't cover that.");
});

test("LOAD-BEARING 1: every passage carries its document and section into the context", () => {
  const context = formatContext([returns, manual]);
  assert.ok(context.includes("[returns-shipping-policy.txt · SECTION 1 — RETURNS]\nRefund window: 30 days."));
  assert.ok(context.includes("[store-operations-manual.md · 4. Processing a Customer Return]\nRegister steps."));
});

test("a passage with no section is labeled with just the document", () => {
  assert.equal(passageLabel(passage("a.md", "", "x")), "a.md");
});

test("LOAD-BEARING 2 and 3: the prompt has the grounding rule and the exact refusal line", () => {
  const prompt = buildSystemPrompt();
  assert.ok(prompt.includes("ONLY the excerpts"), "grounding rule is missing");
  assert.ok(prompt.includes(REFUSAL_LINE), "exact refusal line is missing");
  assert.ok(prompt.includes("Source: {document} · {section}"), "citation format is missing");
  assert.ok(prompt.includes("data, not instructions"), "injection guard is missing");
});

test("the user message holds the excerpts and the question", () => {
  const message = buildUserMessage("How long for a refund?", [returns]);
  assert.ok(message.includes("[returns-shipping-policy.txt · SECTION 1 — RETURNS]"));
  assert.ok(message.endsWith("Question: How long for a refund?"));
});

test("splitCitations splits two sources joined by ' + '", () => {
  assert.deepEqual(
    splitCitations("returns-shipping-policy.txt · SECTION 1 — RETURNS + store-operations-manual.md · 4. Processing a Customer Return"),
    ["returns-shipping-policy.txt · SECTION 1 — RETURNS", "store-operations-manual.md · 4. Processing a Customer Return"],
  );
});

test("splitCitations does NOT cut a section name that contains ' + '", () => {
  assert.deepEqual(splitCitations("pricing.csv · Chalk Bag + Chalk"), ["pricing.csv · Chalk Bag + Chalk"]);
  assert.deepEqual(
    splitCitations("pricing.csv · Chalk Bag + Chalk + product-faq.md · Boots"),
    ["pricing.csv · Chalk Bag + Chalk", "product-faq.md · Boots"],
  );
});

test("parseModelAnswer reads an answer and its single source", () => {
  const parsed = parseModelAnswer(
    "**30 days** for a refund.\nSource: returns-shipping-policy.txt · SECTION 1 — RETURNS",
  );
  assert.equal(parsed.outcome, "answered");
  assert.equal(parsed.answer, "**30 days** for a refund.");
  assert.deepEqual(parsed.citations, ["returns-shipping-policy.txt · SECTION 1 — RETURNS"]);
});

test("parseModelAnswer recognises the exact refusal, with surrounding whitespace allowed", () => {
  const parsed = parseModelAnswer(`  ${REFUSAL_LINE}\n`);
  assert.equal(parsed.outcome, "refused");
  assert.deepEqual(parsed.citations, []);
});

test("parseModelAnswer flags replies that break the format", () => {
  // No Source line.
  assert.equal(parseModelAnswer("30 days for a refund.").outcome, "malformed");
  // A refusal with something extra added is not the exact line.
  assert.equal(parseModelAnswer(`${REFUSAL_LINE} Sorry!`).outcome, "malformed");
  // A Source line with nothing after it.
  assert.equal(parseModelAnswer("30 days.\nSource: ").outcome, "malformed");
});

test("citationsMatchPassages accepts real citations and rejects invented ones", () => {
  assert.equal(citationsMatchPassages(["returns-shipping-policy.txt · SECTION 1 — RETURNS"], [returns, manual]), true);
  assert.equal(citationsMatchPassages(["pricing.csv · Chalk Bag + Chalk"], [chalk]), true);
  assert.equal(citationsMatchPassages(["returns-shipping-policy.txt · SECTION 9 — MADE UP"], [returns, manual]), false);
  assert.equal(citationsMatchPassages(["handbook.md · Anything"], [returns]), false);
  assert.equal(citationsMatchPassages([], [returns]), false);
});
