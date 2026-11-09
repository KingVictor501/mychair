// lib/corpus/chunk.ts
// WHAT IT'S FOR: cuts the corpus documents into "chunks": small passages that are each
// embedded (turned into a list of numbers) so search can find the passage closest in MEANING
// to a question. The number of chunks this file produces IS the corpus chunk count.
// WHO USES IT: scripts/corpus-count.ts (prints the count), and later the embed command.
// Tested by lib/corpus/chunk.test.ts.
// WHY THE NAME: "chunk" = the thing it makes; it lives in lib/corpus/ with other corpus code;
// ".ts" = plain logic, no screen code.
//
// THE CHUNKING METHOD (written down so the count can be reproduced and explained):
//   1. Markdown files (.md): split at every heading (#, ##, ###). The text under a heading is
//      one chunk if it is at most 1,200 characters; longer sections are cut at paragraph
//      breaks (then sentence/line breaks if a paragraph is itself too long), packing as much
//      as fits under 1,200 characters per chunk.
//   2. Plain text file (.txt): same idea, but headings are the ALL-CAPS lines
//      ("SECTION 3 — NON-RETURNABLE ITEMS"). The page footers ("Page 4 of 15", the repeated
//      "Confidential" line) are thrown away, and "(CONTINUED)" sections share one heading.
//   3. CSV file (.csv): one chunk per row (one product), written as "Column: value" lines.
//   4. Sections with fewer than 40 characters of text (a heading with nothing under it) are skipped.
//   5. Every chunk remembers its file and heading, and that "context line" is put in front of
//      the text when it is embedded, so a passage like "30 days" still knows what it's about.
//
// NOTE: imports in this folder stay relative (no "@/") so the test runner loads them simply.

// The longest chunk body we allow, in characters. About 300 words / 300 tokens: small enough
// to be about ONE idea, big enough to be understandable on its own.
export const MAX_CHUNK_CHARS = 1200;
// A section with less text than this (after trimming) is not worth a chunk.
export const MIN_CHUNK_CHARS = 40;

// One passage of the corpus.
export type CorpusChunk = {
  source: string; // file name, e.g. "product-faq.md"
  heading: string; // where in the file it sits, e.g. "Boots" or "6. Pay & Timekeeping > Overtime"
  position: number; // 0, 1, 2... order within the file
  body: string; // the passage text
  embedText: string; // what actually gets embedded: context line + body
};

// ---------- small helpers ----------

// Joins the context line to the body. This is the text that gets turned into numbers.
function makeChunk(source: string, heading: string, position: number, body: string): CorpusChunk {
  const context = heading ? `${source} > ${heading}` : source;
  return { source, heading, position, body, embedText: `${context}\n${body}` };
}

// Cuts one too-long block into pieces of at most MAX_CHUNK_CHARS, breaking after sentences
// or at line breaks, so we never cut a word in half (unless one "sentence" is huge, then we hard-cut).
function splitLongBlock(block: string): string[] {
  // Break after . ! ? followed by space, or at a new line.
  const units = block.split(/(?<=[.!?])\s+|\n/).filter((unit) => unit.trim().length > 0);
  const pieces: string[] = [];
  let current = "";
  for (const unit of units) {
    if (unit.length > MAX_CHUNK_CHARS) {
      // A single enormous "sentence": flush what we have, then hard-cut it.
      if (current) pieces.push(current);
      current = "";
      for (let i = 0; i < unit.length; i += MAX_CHUNK_CHARS) {
        pieces.push(unit.slice(i, i + MAX_CHUNK_CHARS));
      }
      continue;
    }
    const joined = current ? `${current} ${unit}` : unit;
    if (joined.length > MAX_CHUNK_CHARS) {
      pieces.push(current);
      current = unit;
    } else {
      current = joined;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

// Packs the text of one section into chunk bodies of at most MAX_CHUNK_CHARS.
// Splits on blank lines first (paragraphs), because paragraphs are the natural "one idea" unit.
function packSection(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.length < MIN_CHUNK_CHARS) return [];
  if (trimmed.length <= MAX_CHUNK_CHARS) return [trimmed];

  const paragraphs = trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const bodies: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    // A paragraph too long on its own is cut into smaller pieces first.
    const parts = paragraph.length > MAX_CHUNK_CHARS ? splitLongBlock(paragraph) : [paragraph];
    for (const part of parts) {
      const joined = current ? `${current}\n\n${part}` : part;
      if (joined.length > MAX_CHUNK_CHARS) {
        if (current) bodies.push(current);
        current = part;
      } else {
        current = joined;
      }
    }
  }
  if (current) bodies.push(current);
  // Drop any leftover that is too tiny to stand alone.
  return bodies.filter((body) => body.length >= MIN_CHUNK_CHARS);
}

// A section = a heading path plus the lines under it. Turns a list of sections into chunks.
type Section = { heading: string; lines: string[] };

function sectionsToChunks(source: string, sections: Section[]): CorpusChunk[] {
  const chunks: CorpusChunk[] = [];
  for (const section of sections) {
    for (const body of packSection(section.lines.join("\n"))) {
      chunks.push(makeChunk(source, section.heading, chunks.length, body));
    }
  }
  return chunks;
}

// ---------- the three file types ----------

// Markdown: sections start at lines beginning with 1 to 3 "#". The heading path joins the
// current title levels, e.g. "6. Pay & Timekeeping > Overtime".
export function chunkMarkdown(source: string, text: string): CorpusChunk[] {
  const sections: Section[] = [];
  const path: string[] = []; // path[0] = level-1 title, path[1] = level-2 ...
  let current: Section = { heading: "", lines: [] };

  for (const line of text.split(/\r?\n/)) {
    const match = /^(#{1,3})\s+(.*\S)\s*$/.exec(line);
    if (match) {
      sections.push(current);
      const level = match[1].length;
      path.length = level - 1; // forget this level and everything deeper
      path[level - 1] = match[2];
      // The top title (level 1) is the same for the whole file, so leave it out of the path.
      current = { heading: path.slice(1).filter(Boolean).join(" > "), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);
  return sectionsToChunks(source, sections);
}

// A line is a plain-text heading if it is ALL CAPS (letters, digits, and a few symbols).
const PLAIN_HEADING = /^[A-Z0-9][A-Z0-9 &,'’/()—–:.-]{3,}$/;
// Page furniture that repeats on every page and carries no meaning.
const PAGE_NUMBER = /^Page \d+ of \d+$/;
const CONFIDENTIAL_LINE = /^.+ — Confidential$/;

// Plain text: sections start at ALL-CAPS lines. "(CONTINUED)" is removed so a section that
// carries over a page break keeps one heading.
export function chunkPlainText(source: string, text: string): CorpusChunk[] {
  const sections: Section[] = [];
  let current: Section = { heading: "", lines: [] };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (PAGE_NUMBER.test(line) || CONFIDENTIAL_LINE.test(line)) continue; // page furniture
    if (PLAIN_HEADING.test(line)) {
      sections.push(current);
      current = { heading: line.replace(/\s*\(CONTINUED\)\s*$/, ""), lines: [] };
    } else {
      current.lines.push(raw);
    }
  }
  sections.push(current);

  // Merge sections that share a heading (the "(CONTINUED)" ones) so they pack together.
  const merged: Section[] = [];
  for (const section of sections) {
    const last = merged[merged.length - 1];
    if (last && last.heading === section.heading && section.heading !== "") {
      last.lines.push("", ...section.lines);
    } else {
      merged.push({ heading: section.heading, lines: [...section.lines] });
    }
  }
  return sectionsToChunks(source, merged);
}

// Splits one CSV line into cells. Handles "quoted, cells" and doubled quotes ("").
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

// CSV: the first line holds the column names; every other non-empty line is one chunk, written
// as "Column: value" lines. The heading is the product name (the "Product" column if present).
export function chunkCsv(source: string, text: string): CorpusChunk[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];
  const columns = parseCsvLine(lines[0]).map((name) => name.trim());
  const productColumn = columns.findIndex((name) => name.toLowerCase() === "product");

  return lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line);
    const body = columns.map((name, i) => `${name}: ${(cells[i] ?? "").trim()}`).join("\n");
    const heading = productColumn >= 0 ? (cells[productColumn] ?? "").trim() : `Row ${index + 1}`;
    return makeChunk(source, heading, index, body);
  });
}

// ---------- the front door ----------

// Chooses the right chunker from the file's ending. Unknown endings are skipped on purpose.
export function chunkFile(source: string, text: string): CorpusChunk[] {
  const lower = source.toLowerCase();
  if (lower.endsWith(".md")) return chunkMarkdown(source, text);
  if (lower.endsWith(".txt")) return chunkPlainText(source, text);
  if (lower.endsWith(".csv")) return chunkCsv(source, text);
  return [];
}
