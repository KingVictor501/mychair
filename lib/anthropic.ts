// lib/anthropic.ts
// WHAT IT'S FOR: sends the instructions + passages + question to Claude through the Claude API
// and returns Claude's text reply. This is the one step of the answer engine that leaves your
// computer. It uses a plain web request (fetch), so no extra package is needed.
// Docs used: https://platform.claude.com/docs/en/manage-claude/authentication (headers) and
// https://platform.claude.com/docs/en/api/messages/create (request shape).
// WHO USES IT: lib/answer.ts.
// WHY THE NAME: it is the code that talks to Anthropic, the company that makes Claude.
//
// SAFETY: the API key is read from the environment and goes ONLY in the Authorization header.
// Errors carry the HTTP status number and nothing else: never the key, never the question,
// never the response body.

const ENDPOINT = "https://api.anthropic.com/v1/messages";
// The API version the docs show in their examples.
const API_VERSION = "2026-10-21";
// Room for Claude's reply (the model may also "think" before answering, which uses some of this).
const MAX_TOKENS = 2048;
// Give up after 60 seconds so a stuck request can't hang forever.
const TIMEOUT_MS = 60_000;

// The model used unless ANSWER_MODEL says otherwise. Sonnet 5.5, as chosen for this project.
export const DEFAULT_ANSWER_MODEL = "claude-sonnet-5-5";

// An error from the Claude call. "status" is the HTTP status (or null if the request never got one).
export class ClaudeError extends Error {
  readonly status: number | null;
  constructor(message: string, status: number | null) {
    super(message);
    this.name = "ClaudeError";
    this.status = status;
  }
}

// What a successful call gives back.
export type ClaudeReply = {
  text: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

// Which model to use: the ANSWER_MODEL variable if set, otherwise the default.
export function getAnswerModel(): string {
  const fromEnv = process.env.ANSWER_MODEL?.trim();
  return fromEnv ? fromEnv : DEFAULT_ANSWER_MODEL;
}

// Reads Claude's JSON reply. The reply holds a list of "content blocks"; we keep only the
// text blocks (the model may also include thinking blocks, which we ignore).
// Throws if the shape is not what we expect.
export function parseClaudeResponse(json: unknown): Omit<ClaudeReply, "model"> {
  const body = json as { content?: unknown; usage?: { input_tokens?: unknown; output_tokens?: unknown } } | null;
  if (!body || !Array.isArray(body.content)) {
    throw new ClaudeError("Claude response did not have the expected shape", null);
  }
  const text = (body.content as Array<{ type?: unknown; text?: unknown }>)
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("")
    .trim();
  if (text.length === 0) throw new ClaudeError("Claude response had no text", null);
  const inputTokens = typeof body.usage?.input_tokens === "number" ? body.usage.input_tokens : null;
  const outputTokens = typeof body.usage?.output_tokens === "number" ? body.usage.output_tokens : null;
  return { text, inputTokens, outputTokens };
}

// Sends one question to Claude and returns the text reply.
export async function askClaude(system: string, userMessage: string): Promise<ClaudeReply> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new ClaudeError("ANTHROPIC_API_KEY is not set", null);

  const model = getAnswerModel();
  const headers: Record<string, string> = {
    // The secret key goes ONLY here.
    Authorization: `Bearer ${apiKey}`,
    "anthropic-version": API_VERSION,
    "content-type": "application/json",
  };
  // A key that is not tied to one workspace must say which workspace to use. Optional.
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  if (workspaceId) headers["anthropic-workspace-id"] = workspaceId;

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: "user", content: userMessage }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Network failure or timeout. No details: they could include request information.
    throw new ClaudeError("Could not reach the Claude API", null);
  }

  // Status only; the response body is never put in an error.
  if (!response.ok) throw new ClaudeError(`Claude API returned status ${response.status}`, response.status);

  const parsed = parseClaudeResponse(await response.json());
  return { ...parsed, model };
}
