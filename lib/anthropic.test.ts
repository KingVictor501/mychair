// lib/anthropic.test.ts
// WHAT IT'S FOR: automated checks of the parts of lib/anthropic.ts that don't need the internet:
// reading Claude's reply and choosing the model. Run with `npm test`.
// WHY THE NAME: "<file>.test.ts" = the tests for <file>.ts.

import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { ClaudeError, DEFAULT_ANSWER_MODEL, getAnswerModel, parseClaudeResponse } from "./anthropic";

const originalModel = process.env.ANSWER_MODEL;

afterEach(() => {
  if (originalModel === undefined) delete process.env.ANSWER_MODEL;
  else process.env.ANSWER_MODEL = originalModel;
});

test("parseClaudeResponse returns the text and the usage numbers", () => {
  const parsed = parseClaudeResponse({
    content: [{ type: "text", text: "Hello" }],
    usage: { input_tokens: 12, output_tokens: 3 },
  });
  assert.equal(parsed.text, "Hello");
  assert.equal(parsed.inputTokens, 12);
  assert.equal(parsed.outputTokens, 3);
});

test("parseClaudeResponse keeps only text blocks and joins them", () => {
  const parsed = parseClaudeResponse({
    content: [
      { type: "thinking", thinking: "private reasoning" },
      { type: "text", text: "Part one. " },
      { type: "text", text: "Part two." },
    ],
  });
  assert.equal(parsed.text, "Part one. Part two.");
  assert.equal(parsed.inputTokens, null);
});

test("parseClaudeResponse refuses a reply with the wrong shape or no text", () => {
  assert.throws(() => parseClaudeResponse(null), ClaudeError);
  assert.throws(() => parseClaudeResponse({}), ClaudeError);
  assert.throws(() => parseClaudeResponse({ content: [] }), ClaudeError);
  assert.throws(() => parseClaudeResponse({ content: [{ type: "thinking", thinking: "x" }] }), ClaudeError);
});

test("the answer model is Sonnet 5.5 unless ANSWER_MODEL overrides it", () => {
  delete process.env.ANSWER_MODEL;
  assert.equal(getAnswerModel(), DEFAULT_ANSWER_MODEL);
  assert.equal(DEFAULT_ANSWER_MODEL, "claude-sonnet-5-5");
  process.env.ANSWER_MODEL = "claude-haiku-5-5";
  assert.equal(getAnswerModel(), "claude-haiku-5-5");
  process.env.ANSWER_MODEL = "   ";
  assert.equal(getAnswerModel(), DEFAULT_ANSWER_MODEL);
});
