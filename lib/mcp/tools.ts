// lib/mcp/tools.ts
// WHAT IT'S FOR: the rules for the three MyChair MCP tools, with no database or internet needed:
//   1. the input RULES for each tool (checked with zod before anything runs),
//   2. how results are turned into plain text for Claude to read,
//   3. the reply shape MCP expects.
// MCP = Model Context Protocol: a standard way to let an AI call tools on your data itself.
// WHO USES IT: mcp/server.ts (which registers the tools) and lib/mcp/tools.test.ts.
// WHY THE NAME: it's the "tools" part of the MCP code; it lives in lib/mcp/ with the other
// testable logic, while mcp/server.ts is the thin program that starts the server.

// "z" comes from the zod package (installed for MCP). It describes what valid input looks like
// and refuses anything else; this is our input validation for the tools.
import { z } from "zod";
import { passageLabel } from "../rag";
import type { EmbeddingStatus, SearchResult } from "../types";

// Limits, written down once so the rules and the tests agree.
export const MIN_QUERY_CHARS = 2;
export const MAX_QUERY_CHARS = 500;
export const DEFAULT_RESULTS = 3;
export const MAX_RESULTS = 5;

// Tool 1: search_mychair_docs. A question in, the closest passages out.
export const searchInput = z.object({
  query: z
    .string()
    .min(MIN_QUERY_CHARS)
    .max(MAX_QUERY_CHARS)
    .describe("The question or topic to look up, in plain words"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_RESULTS)
    .optional()
    .describe(`How many passages to return (1 to ${MAX_RESULTS}, default ${DEFAULT_RESULTS})`),
});

// Tool 2: list_mychair_documents takes no input.
export const listInput = z.object({});

// Tool 3: read_mychair_section. One section by document and heading.
// The document name may only hold letters, digits, dots, dashes and underscores: a file NAME,
// never a path, so nothing like "../.env" can get through.
export const readSectionInput = z.object({
  source: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9._-]+$/, "must be a document file name such as booking-policy.md")
    .describe("The document file name, exactly as shown in search results"),
  heading: z
    .string()
    .max(200)
    .describe("The section heading, exactly as shown in search results (empty for the document's introduction)"),
});

// The shape MCP expects back from a tool: a list of content blocks. We only ever send text.
export type ToolReply = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

// Wraps plain text in the MCP reply shape.
export function textReply(text: string): ToolReply {
  return { content: [{ type: "text", text }] };
}

// A friendly failure. isError tells Claude the tool did not work. No internal details inside.
export function errorReply(text: string): ToolReply {
  return { content: [{ type: "text", text }], isError: true };
}

// Search results as text: label, score, then the passage. Same "{document} · {section}" label
// as the answer engine's citations, so Claude can cite it the same way.
export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return "No passages found.";
  return results
    .map((r, i) => `${i + 1}. [${passageLabel(r)}] (score ${r.score.toFixed(3)})\n${r.text}`)
    .join("\n\n");
}

// The document list as text, one line per document with its passage count.
export function formatDocumentList(status: EmbeddingStatus): string {
  if (status.bySource.length === 0) return "No documents are embedded yet.";
  const lines = status.bySource.map((row) => `${row.source}: ${row.count} passages`);
  return `${status.bySource.length} documents, ${status.embeddedChunks} passages in total.\n${lines.join("\n")}`;
}

// A whole section as text: the label, then every passage of that section in order.
export function formatSection(source: string, heading: string, bodies: string[]): string {
  return `[${passageLabel({ source, heading })}]\n${bodies.join("\n\n")}`;
}
