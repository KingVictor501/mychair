// components/AskBox.tsx
// WHAT IT'S FOR: the question box on /ask. Type a question, press Ask, and see:
//   - the answer, or the exact "I don't know" line when the documents can't answer, and
//   - for an answer, the SOURCE RECEIPT: the document and section it came from and the passage
//     itself, visible on the page (not hidden in the data).
// Has all four states: idle (empty, with example questions), loading, error, and data.
// WHO USES IT: app/ask/page.tsx.
// WHY THE NAME: components are named for what they show; ".tsx" = screen code.

// "use client": this runs in the browser because it keeps state and handles typing and clicks.
"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type { ApiErrorBody, AskResponse } from "@/lib/types";

const MAX_LENGTH = 300;

// Questions a visitor can tap to try.
const EXAMPLES = [
  "How late can I cancel an appointment?",
  "Can a pro see my email address?",
  "How long does a client invite link last?",
];

type AskState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "data"; response: AskResponse };

// The answers use **bold** for the key figure. We turn those into <strong> ourselves, so we never
// need dangerouslySetInnerHTML (React escapes everything else).
function renderBold(text: string): ReactNode[] {
  return text.split("**").map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

// Reads the friendly message out of the API's standard error body.
async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    return body.error?.message ?? "Something went wrong. Please try again.";
  } catch {
    return "Something went wrong. Please try again.";
  }
}

export default function AskBox() {
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<AskState>({ kind: "idle" });

  async function ask(text: string) {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      if (!res.ok) {
        setState({ kind: "error", message: await errorMessage(res) });
        return;
      }
      setState({ kind: "data", response: (await res.json()) as AskResponse });
    } catch {
      setState({ kind: "error", message: "Could not reach the server. Please try again." });
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void ask(question.trim());
  }

  const tooShort = question.trim().length < 3;

  return (
    <section>
      <form onSubmit={handleSubmit} className="stack">
        <label htmlFor="question">Your question</label>
        <input
          id="question"
          type="text"
          maxLength={MAX_LENGTH}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button type="submit" disabled={tooShort || state.kind === "loading"}>
          {state.kind === "loading" ? "Looking it up…" : "Ask"}
        </button>
      </form>

      {/* Empty state: a helpful next step. */}
      {state.kind === "idle" && (
        <div>
          <p>Not sure what to ask? Try one of these:</p>
          <ul className="examples">
            {EXAMPLES.map((example) => (
              <li key={example}>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setQuestion(example);
                    void ask(example);
                  }}
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.kind === "loading" && <p role="status">Searching MyChair&apos;s documents…</p>}
      {state.kind === "error" && <p role="alert">{state.message}</p>}

      {state.kind === "data" && (
        <div role="status">
          <div className={state.response.outcome === "refused" ? "panel refusal" : "panel answer"}>
            <p className="answer-text">{renderBold(state.response.answer)}</p>
          </div>

          {/* The visible receipt: exact document and section, plus the passage itself. */}
          {state.response.sources.length > 0 && (
            <div>
              <h2 className="sources-heading">Source</h2>
              <ul className="results">
                {state.response.sources.map((source) => (
                  <li key={source.label} className="result">
                    <p className="result-meta">
                      <strong>{source.document}</strong>
                      {source.section ? ` · ${source.section}` : ""}
                    </p>
                    <p className="result-text">{source.excerpt}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
