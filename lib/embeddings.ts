// lib/embeddings.ts
// WHAT IT'S FOR: turns text into "embeddings": lists of 1,536 numbers that capture the MEANING
// of the text, using OpenAI's text-embedding-3-small model. Two texts with similar meaning get
// similar numbers, even if they share no words. That is what makes search work by meaning.
// WHO USES IT: lib/search.ts (embeds the question) and scripts/corpus-embed.ts (embeds every chunk).
// Tested by lib/embeddings.test.ts.
// WHY THE NAME: it makes embeddings; ".ts" = no screen code.
//
// It calls OpenAI's HTTP address directly with fetch (built into Node), so no extra package is needed.
// The API key comes from the OPENAI_API_KEY environment variable and is never logged or returned.
// Docs: https://developers.openai.com/api/docs/guides/embeddings

// The model name. Part of every chunk's fingerprint, so switching models re-embeds everything.
export const EMBEDDING_MODEL = "text-embedding-3-small";
// How many numbers one embedding holds. Must match the vector(1536) column in lib/db/schema.ts.
export const EXPECTED_DIMENSIONS = 1536;

const ENDPOINT = "https://api.openai.com/v1/embeddings";
// How many texts we send to OpenAI in one request.
export const BATCH_SIZE = 96;
// Give up on a request after this long, so a stuck call can't hang the app.
const TIMEOUT_MS = 30_000;

// Splits a list into groups of at most "size". (Exported so it can be tested.)
export function splitIntoBatches<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

// Checks OpenAI's answer has the shape we expect and returns the embeddings IN THE ORDER we
// sent the texts. We validate because we are trusting data from outside our own code.
export function parseEmbeddingResponse(json: unknown, expectedCount: number): number[][] {
  const data = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(data) || data.length !== expectedCount) {
    throw new Error("Embedding response did not have the expected number of items");
  }
  const ordered: number[][] = new Array<number[]>(expectedCount);
  for (const item of data as Array<{ index?: unknown; embedding?: unknown }>) {
    const index = item.index;
    const embedding = item.embedding;
    if (
      typeof index !== "number" ||
      index < 0 ||
      index >= expectedCount ||
      !Array.isArray(embedding) ||
      embedding.length !== EXPECTED_DIMENSIONS ||
      !embedding.every((n) => typeof n === "number")
    ) {
      throw new Error("Embedding response item was not in the expected shape");
    }
    ordered[index] = embedding as number[];
  }
  // A plain loop on purpose: .some() skips empty slots, which would hide a missing item.
  for (let i = 0; i < expectedCount; i++) {
    if (ordered[i] === undefined) throw new Error("Embedding response was missing an item");
  }
  return ordered;
}

// Embeds a list of texts. Returns one list of 1,536 numbers per text, in the same order.
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  if (texts.length === 0) return [];
  // OpenAI rejects empty text, so we refuse it here with a clear message.
  if (texts.some((text) => text.trim().length === 0)) throw new Error("Cannot embed empty text");

  const embeddings: number[][] = [];
  for (const batch of splitIntoBatches(texts, BATCH_SIZE)) {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        // The secret key goes ONLY in this header, never in logs or error messages.
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: batch }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      // Only the status number (like 401 = bad key, 429 = out of credit or too fast).
      // We never copy OpenAI's reply body into an error.
      throw new Error(`OpenAI embeddings request failed with status ${response.status}`);
    }
    embeddings.push(...parseEmbeddingResponse(await response.json(), batch.length));
  }
  return embeddings;
}
