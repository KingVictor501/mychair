// mcp/server.ts
// WHAT IT'S FOR: the MyChair MCP server. MCP (Model Context Protocol) lets an AI such as Claude
// Code call tools on your data by itself. This server gives it three READ-ONLY tools over the
// MyChair help documents (the corpus in the database):
//   search_mychair_docs     question in, closest passages out (the same search as `npm run ask`)
//   list_mychair_documents  which documents are stored, and how many passages each has
//   read_mychair_section    the full text of one section, to quote it exactly
// It cannot change data, and it returns only the public help-document text: never keys, emails,
// or client records.
// WHO USES IT: Claude Code starts it as a background program (see the connect steps in
// docs/mcp-server.md). You never run it by hand, except to test it.
// WHY THE NAME: the folder "mcp" holds the MCP server; "server.ts" is the program that starts it.
//
// IMPORTANT: this program talks to Claude over "standard output". Anything else printed there
// would break the conversation. So LOG_TO_STDERR=1 (below) sends every log line to standard error
// instead, and nothing in this file uses console.log.

import { join } from "node:path";
// McpServer and serveStdio come from the official MCP package (@modelcontextprotocol/server).
// serveStdio runs the server over standard input/output, which is how Claude Code talks to it.
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../lib/db/client";
import { corpusChunks } from "../lib/db/schema";
import { flushLogs, log } from "../lib/logger";
import { getEmbeddingStatus, searchCorpus } from "../lib/search";
import {
  DEFAULT_RESULTS,
  errorReply,
  formatDocumentList,
  formatSearchResults,
  formatSection,
  listInput,
  readSectionInput,
  searchInput,
  textReply,
  type ToolReply,
} from "../lib/mcp/tools";

// Must happen before any log line: keeps standard output clean for the MCP conversation.
process.env.LOG_TO_STDERR = "1";

// Load the keys (DATABASE_URL, OPENAI_API_KEY) from .env.local. Claude Code sets
// CLAUDE_PROJECT_DIR to the project folder; if it is missing we use the current folder.
// Nothing is printed, and no key is ever written into an MCP config file.
try {
  process.loadEnvFile(join(process.env.CLAUDE_PROJECT_DIR ?? process.cwd(), ".env.local"));
} catch {
  // No .env.local: fine if the variables are already set some other way.
}

// Runs one tool with timing and logging. On failure it logs only the tool name and time
// (never the question, the error text, or any key) and gives Claude a short friendly message.
async function runTool(tool: string, work: () => Promise<{ reply: ToolReply; count: number }>): Promise<ToolReply> {
  const startedAt = Date.now();
  try {
    const { reply, count } = await work();
    log.info("mcp_tool_called", { tool, resultCount: count, ms: Date.now() - startedAt });
    return reply;
  } catch {
    log.error("mcp_tool_failed", { tool, ms: Date.now() - startedAt });
    return errorReply("The MyChair documents could not be reached right now. Please try again in a moment.");
  } finally {
    await flushLogs(); // save the log line(s) to the database
  }
}

// Builds a server with its three tools. serveStdio may call this more than once, so every call
// returns a brand-new server (as the MCP docs require).
function createServer(): McpServer {
  const server = new McpServer({ name: "mychair-docs", version: "1.0.0" });

  server.registerTool(
    "search_mychair_docs",
    {
      description:
        "Search the MyChair help documents (booking, cancellation, privacy, roles, pricing and more) by meaning. Returns the closest passages with their document, section and score. Use it to answer questions about how MyChair works, and cite the document and section.",
      inputSchema: searchInput,
    },
    async ({ query, limit }) =>
      runTool("search_mychair_docs", async () => {
        const results = await searchCorpus(query, limit ?? DEFAULT_RESULTS);
        return { reply: textReply(formatSearchResults(results)), count: results.length };
      }),
  );

  server.registerTool(
    "list_mychair_documents",
    {
      description: "List the MyChair help documents that are stored, with the number of passages in each.",
      inputSchema: listInput,
    },
    async () =>
      runTool("list_mychair_documents", async () => {
        const status = await getEmbeddingStatus();
        return { reply: textReply(formatDocumentList(status)), count: status.bySource.length };
      }),
  );

  server.registerTool(
    "read_mychair_section",
    {
      description:
        "Read the full text of one section of one MyChair document. Use the document name and section heading exactly as shown in search results.",
      inputSchema: readSectionInput,
    },
    async ({ source, heading }) =>
      runTool("read_mychair_section", async () => {
        // Parameterized by Drizzle (the values are never glued into the SQL text).
        const rows = await getDb()
          .select({ body: corpusChunks.body })
          .from(corpusChunks)
          .where(and(eq(corpusChunks.source, source), eq(corpusChunks.heading, heading)))
          .orderBy(asc(corpusChunks.position));
        if (rows.length === 0) {
          return {
            reply: errorReply("No section found with that document and heading. Check them against the search results."),
            count: 0,
          };
        }
        return { reply: textReply(formatSection(source, heading, rows.map((r) => r.body))), count: rows.length };
      }),
  );

  return server;
}

// Start serving over standard input/output. Errors go to standard error (the safe stream).
serveStdio(createServer, {
  onerror: () => {
    log.error("mcp_server_error", {});
  },
});
log.info("mcp_server_started", { name: "mychair-docs" });
