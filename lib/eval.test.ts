// lib/eval.test.ts
// WHAT IT'S FOR: automated checks of the eval rules in lib/eval.ts, with no database or
// internet. It also runs the "scout pass": every item in eval/golden-set.json is checked against
// the real documents in mychair-corpus/, so a wrong expected source can never poison a run.
// Run with `npm test`.
// WHY THE NAME: "<file>.test.ts" = the tests for <file>.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chunkFile } from "./corpus/chunk";
import {
  applyGate,
  expectedLabel,
  failedItem,
  gateSchema,
  goldenSetSchema,
  renderReport,
  scoreItem,
  type GoldenItem,
} from "./eval";
import { REFUSAL_LINE } from "./rag";
import type { RagResult } from "./types";

const answerable: GoldenItem = {
  id: 1,
  kind: "answerable",
  question: "How late can a client cancel?",
  expectedAnswer: "2 hours",
  expectedSource: { document: "cancellation-and-no-show-policy.md", section: "The cancellation window" },
  requiredPhrases: [["2 hours"]],
  passCriteria: "States 2 hours and cites the section.",
};
const refuse: GoldenItem = {
  id: 2,
  kind: "refuse",
  question: "Do you sell hair gel?",
  expectedAnswer: REFUSAL_LINE,
  expectedSource: null,
  requiredPhrases: [],
  passCriteria: "Exact refusal.",
};
const LABEL = "cancellation-and-no-show-policy.md · The cancellation window";

// Builds a fake engine result.
function result(overrides: Partial<RagResult>): RagResult {
  return {
    outcome: "answered",
    answer: "You can cancel up to **2 hours** before.",
    citations: [LABEL],
    citationsVerified: true,
    passages: [{ id: "1", source: "cancellation-and-no-show-policy.md", heading: "The cancellation window", text: "x", score: 0.52 }],
    tookMs: 1,
    ...overrides,
  };
}

test("a right answer with the right citation passes both measures", () => {
  const score = scoreItem(answerable, result({}));
  assert.equal(score.retrievalHit, true);
  assert.equal(score.answerPass, true);
  assert.deepEqual(score.reasons, []);
});

test("a right number with NO citation fails the answer measure (the receipt is required)", () => {
  const score = scoreItem(answerable, result({ citations: [], citationsVerified: false, outcome: "malformed" }));
  assert.equal(score.answerPass, false);
});

test("a right number citing the WRONG section fails the answer measure", () => {
  const score = scoreItem(answerable, result({ citations: ["booking-policy.md · How far ahead you can book"] }));
  assert.equal(score.answerPass, false);
  assert.ok(score.reasons.some((r) => r.includes("was not cited")));
});

test("a missing required fact fails the answer measure", () => {
  const score = scoreItem(answerable, result({ answer: "You can cancel before the appointment." }));
  assert.equal(score.answerPass, false);
});

test("retrieval misses are scored separately from the answer", () => {
  const score = scoreItem(answerable, result({ passages: [] }));
  assert.equal(score.retrievalHit, false);
  assert.equal(score.answerPass, true); // the answer measure does not depend on the search measure
});

test("alternative words count: any one word of a required fact is enough", () => {
  const item: GoldenItem = { ...answerable, requiredPhrases: [["once", "one time"]] };
  assert.equal(scoreItem(item, result({ answer: "It works one time only." })).answerPass, true);
});

test("a refusal question passes only when the engine refuses", () => {
  assert.equal(scoreItem(refuse, result({ outcome: "refused", answer: REFUSAL_LINE, citations: [] })).answerPass, true);
  assert.equal(scoreItem(refuse, result({})).answerPass, false);
  assert.equal(scoreItem(refuse, result({ outcome: "refused", citations: [] })).retrievalHit, null);
});

test("refusing a question the documents can answer fails", () => {
  const score = scoreItem(answerable, result({ outcome: "refused", answer: REFUSAL_LINE, citations: [] }));
  assert.equal(score.answerPass, false);
});

test("the gate: thresholds met means ship, a missed refusal blocks shipping", () => {
  const gate = gateSchema.parse({
    version: 1,
    description: "d",
    retrieval: { measure: "m", passMin: 1, outOf: 1 },
    answer: { measure: "m", passMin: 1, outOf: 2 },
    refusalsMustAllPass: true,
  });
  const good = [scoreItem(answerable, result({})), scoreItem(refuse, result({ outcome: "refused", answer: REFUSAL_LINE, citations: [] }))];
  assert.equal(applyGate(good, gate).ship, true);
  const badRefusal = [scoreItem(answerable, result({})), scoreItem(refuse, result({}))];
  const verdict = applyGate(badRefusal, gate);
  assert.equal(verdict.answerPass, true); // 1 of 2 meets "at least 1"
  assert.equal(verdict.refusalsPass, false);
  assert.equal(verdict.ship, false);
});

test("the gate refuses to run if its 'out of' numbers do not match the set", () => {
  const gate = gateSchema.parse({
    version: 1,
    description: "d",
    retrieval: { measure: "m", passMin: 1, outOf: 5 },
    answer: { measure: "m", passMin: 1, outOf: 2 },
    refusalsMustAllPass: false,
  });
  assert.throws(() => applyGate([scoreItem(answerable, result({})), scoreItem(refuse, result({}))], gate));
});

test("an engine failure counts as a fail on both measures", () => {
  const score = failedItem(answerable, "Claude could not be reached");
  assert.equal(score.retrievalHit, false);
  assert.equal(score.answerPass, false);
  assert.equal(score.failed, true);
});

test("the report shows the two scores, the gate, and the commits", () => {
  const gate = gateSchema.parse(JSON.parse(readFileSync("eval/gate.json", "utf8")));
  const scores = [scoreItem(answerable, result({}))];
  const loose = { ...gate, retrieval: { ...gate.retrieval, outOf: 1, passMin: 1 }, answer: { ...gate.answer, outOf: 1, passMin: 1 } };
  const report = renderReport(scores, applyGate(scores, loose), loose, {
    label: "v1",
    ranAt: "now",
    model: "m",
    chunksStored: 118,
    goldenSetSha: "abc",
    gateCommit: "g1",
    setCommit: "s1",
  });
  assert.ok(report.includes("baseline report v1"));
  assert.ok(report.includes("Retrieval"));
  assert.ok(report.includes("gate.json last committed: `g1`"));
  assert.ok(report.includes("SHIP"));
});

// ---------- the scout pass: the real frozen files against the real documents ----------

const goldenSet = goldenSetSchema.parse(JSON.parse(readFileSync("eval/golden-set.json", "utf8")));
const gate = gateSchema.parse(JSON.parse(readFileSync("eval/gate.json", "utf8")));

test("scout pass: the golden set has 10 items, 7 answerable and 3 refusals, with unique ids", () => {
  assert.equal(goldenSet.items.length, 10);
  assert.equal(goldenSet.items.filter((i) => i.kind === "answerable").length, 7);
  assert.equal(goldenSet.items.filter((i) => i.kind === "refuse").length, 3);
  assert.equal(new Set(goldenSet.items.map((i) => i.id)).size, 10);
});

test("scout pass: the gate's numbers match the golden set", () => {
  assert.equal(gate.retrieval.outOf, 7);
  assert.equal(gate.answer.outOf, 10);
});

test("scout pass: every expected source is a real section of a real document", () => {
  const labels = new Set<string>();
  for (const name of readdirSync("mychair-corpus").filter((n) => !n.startsWith("."))) {
    for (const chunk of chunkFile(name, readFileSync(join("mychair-corpus", name), "utf8"))) {
      labels.add(chunk.heading ? `${chunk.source} · ${chunk.heading}` : chunk.source);
    }
  }
  for (const item of goldenSet.items.filter((i) => i.kind === "answerable")) {
    const label = expectedLabel(item);
    assert.ok(label !== null && labels.has(label), `item ${item.id}: "${label}" is not a section of the corpus`);
  }
});

test("scout pass: every must-refuse question's key word appears nowhere in the corpus", () => {
  const corpusText = readdirSync("mychair-corpus")
    .map((name) => readFileSync(join("mychair-corpus", name), "utf8").toLowerCase())
    .join("\n");
  const keyWords: Record<number, string> = { 8: "gel", 9: "spreadsheet", 10: "loyalty" };
  for (const item of goldenSet.items.filter((i) => i.kind === "refuse")) {
    const word = keyWords[item.id];
    assert.ok(word !== undefined, `no key word recorded for refusal item ${item.id}`);
    assert.equal(corpusText.includes(word), false, `item ${item.id}: "${word}" is in the corpus, so this is not a refusal question`);
  }
});

test("scout pass: each expected answer's key fact appears in the expected section's text", () => {
  const byLabel = new Map<string, string>();
  for (const name of readdirSync("mychair-corpus").filter((n) => !n.startsWith("."))) {
    for (const chunk of chunkFile(name, readFileSync(join("mychair-corpus", name), "utf8"))) {
      const label = chunk.heading ? `${chunk.source} · ${chunk.heading}` : chunk.source;
      byLabel.set(label, `${byLabel.get(label) ?? ""}\n${chunk.body}`.toLowerCase());
    }
  }
  const facts: Record<number, string[]> = {
    1: ["2 hours"], 2: ["24 hours", "once"], 3: ["never see", "phone number", "style card"],
    4: ["jpg, png, or webp", "5 mb"], 5: ["5 days"], 6: ["cannot issue refunds"], 7: ["super admin"],
  };
  for (const [id, needles] of Object.entries(facts)) {
    const item = goldenSet.items.find((i) => i.id === Number(id));
    assert.ok(item !== undefined);
    const text = byLabel.get(expectedLabel(item) ?? "") ?? "";
    for (const needle of needles) assert.ok(text.includes(needle), `item ${id}: "${needle}" is not in the expected section`);
  }
});
