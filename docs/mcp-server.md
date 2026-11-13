# MyChair MCP servers

There are two MCP servers in this project:

| Server | Config | What it does | Scope |
|---|---|---|---|
| `mychair-corpus` (the scoped demo) | `.mcp.json`, committed | The official `@modelcontextprotocol/server-filesystem` package, pinned to 2.3.0, started with `--read-only` | One folder: `mychair-corpus/`. Evidence: `docs/mcp-evidence.md` |
| `mychair-docs` (our own, described below) | local setting, not committed | Three tools that search the database by meaning | The development database |

The rest of this page describes `mychair-docs`.

MCP (Model Context Protocol) is a standard way to let an AI call tools on your data by itself. The MyChair MCP server gives Claude Code three read-only tools over the MyChair help documents, so it can search and quote them without anything being pasted in.

## The tools

| Tool | Input | What it returns |
|---|---|---|
| `search_mychair_docs` | `query` (2 to 500 characters), optional `limit` (1 to 5, default 3) | The closest passages by meaning, each with its `document · section` label and score |
| `list_mychair_documents` | none | Every stored document and its passage count |
| `read_mychair_section` | `source` (a document file name), `heading` | The full text of that section |

All three are read-only. They return only help-document text, never keys, emails, or client records. Inputs are checked with `zod` before anything runs, and a document name must be a plain file name, so a path such as `../.env.local` is refused.

## Files

| File | What it does |
|---|---|
| `mcp/server.ts` | Starts the server and registers the three tools |
| `lib/mcp/tools.ts` | The input rules and how results are written as text |
| `lib/mcp/tools.test.ts` | Automated tests for those rules |
| `lib/logger.ts` | Small change: `LOG_TO_STDERR=1` sends every log line to standard error |

## Why logs go to standard error
The server talks to Claude over standard output. One stray log line there would break the conversation. `mcp/server.ts` sets `LOG_TO_STDERR=1` before anything logs, and nothing in it uses `console.log`.

## What gets logged
`mcp_tool_called` with the tool name, the number of results, and the milliseconds. `mcp_tool_failed` with the tool name and milliseconds. The question text and the document text are never logged.

## Connect it to Claude Code
Run this once from the project folder:

```
claude mcp add --transport stdio mychair-docs -- npx tsx mcp/server.ts
```

Everything after `--` is the command that starts the server. It uses the `local` scope by default: the setting is stored in your own Claude Code configuration for this project and is not committed to git. The server reads `DATABASE_URL` and `OPENAI_API_KEY` from `.env.local` itself, so no key is written into any configuration.

Then check it:
1. `claude mcp list` should show `mychair-docs` as connected.
2. In Claude Code, type `/mcp` to see its three tools.
3. Ask: "Use the MyChair docs to tell me how late a client can cancel." Claude Code asks permission to call the tool; allow it. The answer should say 2 hours and name `cancellation-and-no-show-policy.md`.

To remove it: `claude mcp remove mychair-docs`.

## Limits
- It runs on your own computer only. It is not deployed to Vercel.
- It searches your development database (`.env.local`).
- Only connect MCP servers you trust. This one is read-only and is your own code.
