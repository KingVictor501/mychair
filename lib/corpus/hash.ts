// lib/corpus/hash.ts
// WHAT IT'S FOR: makes a "fingerprint" (SHA-256 hash) of a chunk plus the model name. The same
// text and model always give the same fingerprint, so the embed command can tell which chunks
// are already stored and only embed the new or changed ones. That's what makes it safe to re-run.
// WHO USES IT: scripts/corpus-embed.ts. Tested by lib/corpus/hash.test.ts.
// WHY THE NAME: it makes hashes; ".ts" = no screen code.

// "createHash" is built into Node.js. SHA-256 turns any text into 64 letters/numbers; a tiny
// change to the text gives a completely different result.
import { createHash } from "node:crypto";

// Fingerprint of "which model + which exact text". Changing either one changes the fingerprint.
export function chunkHash(embedText: string, model: string): string {
  return createHash("sha256").update(`${model}\n${embedText}`).digest("hex");
}
