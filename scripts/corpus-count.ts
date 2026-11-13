// scripts/corpus-count.ts
// WHAT IT'S FOR: reads every file in the mychair-corpus folder, chunks it with
// lib/corpus/chunk.ts, and prints how many chunks each file makes and the TOTAL.
// That total is the "corpus chunk count". Needs no database, no internet, and no API key.
// WHO USES IT: you, with `npm run corpus:count`.
// WHY THE NAME: a one-off command-line "script" (so it lives in /scripts) that counts the corpus.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chunkFile, MAX_CHUNK_CHARS } from "../lib/corpus/chunk";

// The folder holding the corpus documents, relative to the project root.
const CORPUS_DIR = "mychair-corpus";

// Prints one line of text (we avoid console.log in this project).
function say(line: string): void {
  process.stdout.write(`${line}\n`);
}

const files = readdirSync(CORPUS_DIR).filter((name) => !name.startsWith(".")).sort();
let total = 0;
let longest = 0;
let shortest = Number.MAX_SAFE_INTEGER;

say(`Chunking method limits: max ${MAX_CHUNK_CHARS} characters per chunk`);
say("");
for (const name of files) {
  const text = readFileSync(join(CORPUS_DIR, name), "utf8");
  const chunks = chunkFile(name, text);
  for (const chunk of chunks) {
    longest = Math.max(longest, chunk.body.length);
    shortest = Math.min(shortest, chunk.body.length);
  }
  total += chunks.length;
  say(`${String(chunks.length).padStart(4)}  ${name}`);
}
say("");
say(`TOTAL CHUNKS: ${total}`);
say(`Shortest chunk: ${shortest} characters, longest chunk: ${longest} characters`);
