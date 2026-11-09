// lib/corpus/chunk.test.ts
// WHAT IT'S FOR: automated checks of the chunker, using tiny made-up documents (so they don't
// depend on your real corpus files). Run with `npm test`.
// WHO USES IT: the test runner (`tsx --test`), never the app.
// WHY THE NAME: "<file>.test.ts" = the tests for <file>.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkCsv, chunkFile, chunkMarkdown, chunkPlainText, MAX_CHUNK_CHARS } from "./chunk";

// A sentence long enough to be a real paragraph body, repeated to make long text.
const SENTENCE = "Boots should be broken in over several short walks before a long trip. ";

test("markdown: each heading with text becomes a chunk that remembers its heading path", () => {
  const text = [
    "# Handbook",
    "intro that is ignored because it sits under the title only and is long enough to count",
    "## 1. Pay",
    "### Overtime",
    "Overtime is paid at one and a half times the regular rate after forty hours.",
    "### Pay schedule",
    "Pay is issued every second Friday by direct deposit to your account.",
  ].join("\n");
  const chunks = chunkMarkdown("handbook.md", text);
  const headings = chunks.map((c) => c.heading);
  assert.ok(headings.includes("1. Pay > Overtime"));
  assert.ok(headings.includes("1. Pay > Pay schedule"));
});

test("markdown: a heading with nothing under it makes no chunk", () => {
  const text = "# Title\n## Empty section\n## Real section\nThis section has plenty of real words in it.";
  const chunks = chunkMarkdown("a.md", text);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].heading, "Real section");
});

test("long sections are cut into chunks no longer than the limit, and no text is lost", () => {
  const long = SENTENCE.repeat(60); // about 4,200 characters
  const chunks = chunkMarkdown("a.md", `# T\n## Big\n${long}`);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) assert.ok(chunk.body.length <= MAX_CHUNK_CHARS);
  const joined = chunks.map((c) => c.body).join(" ").replace(/\s+/g, " ");
  assert.ok(joined.includes("broken in over several short walks"));
  // Every word of the original is still present somewhere (count of sentences is preserved).
  assert.equal(joined.split("Boots should").length - 1, 60);
});

test("every chunk's embedText starts with its file and heading", () => {
  const [chunk] = chunkMarkdown("faq.md", "# T\n## Boots\nBoots need breaking in before long trips, always.");
  assert.ok(chunk.embedText.startsWith("faq.md > Boots\n"));
});

test("plain text: page footers are dropped and (CONTINUED) sections merge", () => {
  const text = [
    "POLICY TITLE",
    "SECTION 1 — RETURNS",
    "Items may be returned within thirty days of delivery in original condition.",
    "Page 1 of 3",
    "Acme Co. — Confidential",
    "SECTION 1 — RETURNS (CONTINUED)",
    "Refunds go back to the original payment method within five business days.",
    "SECTION 2 — EXCHANGES",
    "Exchanges are free for a different size of the same product within the window.",
  ].join("\n");
  const chunks = chunkPlainText("policy.txt", text);
  assert.equal(chunks.length, 2); // merged RETURNS + EXCHANGES
  assert.equal(chunks[0].heading, "SECTION 1 — RETURNS");
  assert.ok(!chunks.some((c) => c.body.includes("Page 1 of 3")));
  assert.ok(!chunks.some((c) => c.body.includes("Confidential")));
  assert.ok(chunks[0].body.includes("thirty days"));
  assert.ok(chunks[0].body.includes("five business days"));
});

test("csv: one chunk per row, written as Column: value lines, headed by the product name", () => {
  const text = 'SKU,Product,Price\nB-1,"Boot, Granite Peak",185.00\nJ-1,Hardshell,240.00\n';
  const chunks = chunkCsv("pricing.csv", text);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].heading, "Boot, Granite Peak");
  assert.ok(chunks[0].body.includes("Price: 185.00"));
});

test("chunkFile picks the right chunker and skips unknown file types", () => {
  assert.ok(chunkFile("a.md", "# T\n## S\nA section with enough text to become a chunk here.").length === 1);
  assert.equal(chunkFile("picture.png", "whatever").length, 0);
});

test("the same input always gives the same chunks (so the count is reproducible)", () => {
  const text = `# T\n## S\n${SENTENCE.repeat(40)}`;
  assert.deepEqual(chunkMarkdown("a.md", text), chunkMarkdown("a.md", text));
});
