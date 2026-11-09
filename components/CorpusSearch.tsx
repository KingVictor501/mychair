// components/CorpusSearch.tsx
// WHAT IT'S FOR: the search screen. Step 1: type your admin key and unlock (it shows how many
// passages are embedded, read from the database). Step 2: type a question and see the closest
// passages, each with its score. Has all four states: loading, error, empty, and data.
// WHO USES IT: app/search/page.tsx.
// WHY THE NAME: components are named for what they show; ".tsx" = screen code.

// "use client": this runs in the browser because it keeps state and handles typing/clicks.
"use client";

import { useState, type FormEvent } from "react";
import type { ApiErrorBody, EmbeddingStatus, SearchResponse } from "@/lib/types";

// The unlock step and the search step each have their own states.
type UnlockState =
  | { kind: "locked" }
  | { kind: "checking" }
  | { kind: "error"; message: string }
  | { kind: "unlocked"; status: EmbeddingStatus };

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "data"; response: SearchResponse; queryLength: number };

// Reads the friendly message out of the API's standard error body.
async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

export default function CorpusSearch() {
  // The key lives only in this page's memory (not in storage), so it is gone when you refresh.
  const [adminKey, setAdminKey] = useState("");
  const [unlock, setUnlock] = useState<UnlockState>({ kind: "locked" });
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState>({ kind: "idle" });

  // Step 1: check the key by asking for the embedding status.
  async function handleUnlock(event: FormEvent) {
    event.preventDefault();
    setUnlock({ kind: "checking" });
    try {
      const res = await fetch("/api/admin/embeddings", { headers: { "x-admin-key": adminKey } });
      if (!res.ok) {
        setUnlock({ kind: "error", message: await errorMessage(res, "Could not unlock.") });
        return;
      }
      setUnlock({ kind: "unlocked", status: (await res.json()) as EmbeddingStatus });
    } catch {
      setUnlock({ kind: "error", message: "Could not reach the server." });
    }
  }

  // Step 2: run the search.
  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    setSearch({ kind: "loading" });
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        headers: { "x-admin-key": adminKey },
      });
      if (!res.ok) {
        setSearch({ kind: "error", message: await errorMessage(res, "Search failed.") });
        return;
      }
      setSearch({
        kind: "data",
        response: (await res.json()) as SearchResponse,
        queryLength: query.trim().length,
      });
    } catch {
      setSearch({ kind: "error", message: "Could not reach the server." });
    }
  }

  return (
    <section>
      {/* ---- Step 1: unlock ---- */}
      <form onSubmit={handleUnlock} className="stack">
        <label htmlFor="admin-key">Admin key</label>
        <input
          id="admin-key"
          type="password"
          autoComplete="off"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          disabled={unlock.kind === "unlocked"}
        />
        {unlock.kind !== "unlocked" && (
          <button type="submit" disabled={adminKey.length === 0 || unlock.kind === "checking"}>
            {unlock.kind === "checking" ? "Checking…" : "Unlock"}
          </button>
        )}
        {unlock.kind === "error" && <p role="alert">{unlock.message}</p>}
      </form>

      {unlock.kind === "unlocked" && (
        <>
          {/* The "Service search" panel from the plan: the count comes from the table itself. */}
          <p role="status" className="panel">
            Embedded chunks: <strong>{unlock.status.embeddedChunks}</strong>
            {unlock.status.model ? ` (model: ${unlock.status.model})` : ""}
          </p>

          {/* ---- Step 2: search ---- */}
          <form onSubmit={handleSearch} className="stack">
            <label htmlFor="query">Ask a question</label>
            <input
              id="query"
              type="text"
              maxLength={200}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" disabled={query.trim().length < 2 || search.kind === "loading"}>
              {search.kind === "loading" ? "Searching…" : "Search"}
            </button>
          </form>

          {search.kind === "loading" && <p role="status">Searching by meaning…</p>}
          {search.kind === "error" && <p role="alert">{search.message}</p>}

          {search.kind === "data" && search.response.results.length === 0 && (
            <p role="status">
              No passages found. If the count above is 0, run <code>npm run corpus:embed</code> first.
            </p>
          )}

          {search.kind === "data" && search.response.results.length > 0 && (
            <>
              <p role="status">
                {search.response.results.length} closest passages in {search.response.tookMs} ms
                (closest first; a score closer to 1 means closer in meaning)
              </p>
              <ol className="results">
                {search.response.results.map((result) => (
                  <li key={result.id} className="result">
                    <p className="result-meta">
                      <strong>Score {result.score.toFixed(3)}</strong> · {result.source} ·{" "}
                      {result.heading || "(no heading)"}
                    </p>
                    {/* Plain text only: React escapes it, and we never use dangerouslySetInnerHTML. */}
                    <p className="result-text">{result.text}</p>
                  </li>
                ))}
              </ol>
            </>
          )}
        </>
      )}
    </section>
  );
}
