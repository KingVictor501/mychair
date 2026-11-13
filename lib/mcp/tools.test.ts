// lib/mcp/tools.test.ts
// WHAT IT'S FOR: automated checks of the MCP tool rules in lib/mcp/tools.ts, with no database or
// internet: the input rules (what is allowed in) and how results are written out as text.
// Run with `npm test`.
// WHY THE NAME: "<file>.test.ts" = the tests for <file>.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  errorReply,
  formatDocumentList,
  formatSearchResults,
  formatSection,
  MAX_QUERY_CHARS,
  MAX_RESULTS,
  readSectionInput,
  searchInput,
  textReply,
} from "./tools";

test("search input accepts a normal question and an optional limit", () => {
  assert.equal(searchInput.safeParse({ query: "How late can I cancel?" }).success, true);
  assert.equal(searchInput.safeParse({ query: "cancel", limit: 5 }).success, true);
});

test("search input refuses a query that is too short, too long, or missing", () => {
  assert.equal(searchInput.safeParse({ query: "a" }).success, false);
  assert.equal(searchInput.safeParse({ query: "x".repeat(MAX_QUERY_CHARS + 1) }).success, false);
  assert.equal(searchInput.safeParse({}).success, false);
});

test("search input refuses a limit that is zero, too big, or not a whole number", () => {
  assert.equal(searchInput.safeParse({ query: "cancel", limit: 0 }).success, false);
  assert.equal(searchInput.safeParse({ query: "cancel", limit: MAX_RESULTS + 1 }).success, false);
  assert.equal(searchInput.safeParse({ query: "cancel", limit: 2.5 }).success, false);
});

test("read-section input accepts a document name and a heading (or an empty heading)", () => {
  assert.equal(readSectionInput.safeParse({ source: "booking-policy.md", heading: "How far ahead you can book" }).success, true);
  assert.equal(readSectionInput.safeParse({ source: "pro-guide.md", heading: "" }).success, true);
});

test("read-section input refuses anything that looks like a path, not a file name", () => {
  for (const source of ["../.env.local", "docs/permissions.md", "a b.md", "", "x".repeat(101)]) {
    assert.equal(readSectionInput.safeParse({ source, heading: "x" }).success, false, source);
  }
});

test("search results are written with the citation label and the score", () => {
  const text = formatSearchResults([
    { id: "1", source: "booking-policy.md", heading: "How far ahead you can book", text: "Up to 5 days.", score: 0.51234 },
    { id: "2", source: "pro-guide.md", heading: "", text: "Intro.", score: 0.3 },
  ]);
  assert.ok(text.includes("1. [booking-policy.md · How far ahead you can book] (score 0.512)\nUp to 5 days."));
  assert.ok(text.includes("2. [pro-guide.md] (score 0.300)"));
  assert.equal(formatSearchResults([]), "No passages found.");
});

test("the document list shows each file with its passage count and the totals", () => {
  const text = formatDocumentList({
    embeddedChunks: 16,
    model: "m",
    bySource: [
      { source: "a.md", count: 7 },
      { source: "b.md", count: 9 },
    ],
  });
  assert.ok(text.startsWith("2 documents, 16 passages in total."));
  assert.ok(text.includes("a.md: 7 passages"));
  assert.equal(formatDocumentList({ embeddedChunks: 0, model: null, bySource: [] }), "No documents are embedded yet.");
});

test("a section is written with its label and its passages in order", () => {
  assert.equal(formatSection("a.md", "Intro", ["one", "two"]), "[a.md · Intro]\none\n\ntwo");
});

test("replies have the MCP shape, and only errors carry isError", () => {
  assert.deepEqual(textReply("hi"), { content: [{ type: "text", text: "hi" }] });
  assert.equal(errorReply("no").isError, true);
});
