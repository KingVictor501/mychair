# Design: MyChair's live MCP server (one tool)

The local server in `mcp/server.ts` (three tools, runs only on my computer) stays as it is. This is a second, separate server that lives on the internet.

## The one tool

**`get_weekly_health`**: no input. It returns the same flat health and security report that the Make automation reads: requests, server errors, latency, questions answered or refused, failed key attempts (admin key and MCP key), injection-screen hits, whether logging is alive, and an overall `status` and `security_status`, for the last 7 days.

| Question        | Answer                                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Who calls it    | An AI assistant (Claude) that I connect to the server, and later the health-triage agent (Week 10 item 3), which uses it as its only window into the app.                  |
| What it reads   | Counts from the `log_entries` table, built by the existing `lib/report.ts` (covered by `lib/report.test.ts`) and `lib/report-data.ts` (no unit tests because it queries the database, but it served the real scheduled Make run on Nov 16). |
| What it returns | Numbers, `ok`/`attention`/`empty` words and short note codes such as `auth_failures_some`. No names, emails, phone numbers, log messages, questions people typed, or keys. |
| What it changes | Nothing. It is read-only.                                                                                                                                                  |

### Why this tool and not another

- **Not the docs search again:** the local server already searches the help documents. The rubric asks for a tool over the app's own data, and the health numbers are data only MyChair has.
- **It feeds the agent:** the agent in item 3 needs a permission-scoped connection. If this one tool is all it can reach, its permission is "read seven days of counts" and nothing more.
- **It reuses tested code:** the report logic already has tests and a real scheduled run behind it, so the new work is the connection and the lock, not new math.

## The dangerous thing, never built

**A tool that reads raw log lines or client records** (for example `read_logs` or `get_appointments`). It would be the useful next step for a troubleshooting assistant, and it is the one I refuse to build:

- Raw lines hold routes, request IDs and error messages, and the client records hold names and phone numbers. One wrong redaction, or one injected instruction in a log message ("ignore your rules and..."), and an AI is reading or repeating private data.
- The same goes for anything that writes: no tool deletes logs, changes the retention rule, or runs SQL. A read-only server with one tool cannot be talked into damage.

If I ever need more than counts, the answer is a new count in the report, not raw rows.

## The credential check comes first

The route's very first step, before reading the request body, opening the database or starting the MCP machinery:

1. Read the `Authorization: Bearer <key>` header.
2. Compare it with `MCP_API_KEY` (a new secret, separate from `ADMIN_API_KEY`) using the same constant-time comparison as `lib/admin-auth.ts`, so the comparison time doesn't leak how close a guess was.
3. Wrong or missing key: return **401** with a short JSON error and log `mcp_auth_failed` with no details (never the key; the `request_done` line beside it already has the route and status). If `MCP_API_KEY` is not set on the server at all, every request gets **503** "not available", the same way the admin lock behaves, so a missing setting fails closed.
4. The weekly report counts `mcp_auth_failed` together with `admin_auth_failed` in `auth_failures`, so someone guessing at the MCP key turns the security status to `attention`, just like guessing at the admin key.

Only after the key passes does the request reach the MCP handler. Then the official toolkit's two checks run:

- **Host check** (`hostHeaderValidationResponse`): only the production address, read from Vercel's own `VERCEL_PROJECT_PRODUCTION_URL` setting instead of being typed into the code. `localhost` is allowed only outside production, for testing on my computer.
- **Origin check** (`originValidationResponse`): if a web page in a browser tries to call the server, it must be MyChair's own site. AI apps don't send this header, so they pass. This keeps "CORS never `*`" true here too.

Why a separate key: if the MCP key leaks, it opens one read-only tool. The admin key (used by Make) stays secret, and either one can be changed without breaking the other.

## Where it lives

| Item     | Choice                                                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Address  | `https://mychair-eta.vercel.app/api/mcp`                                                                                                                                        |
| Code     | `app/api/mcp/route.ts`, using `createMcpHandler` from `@modelcontextprotocol/server` v2 (already installed). It answers plain web requests, which is what a Vercel function is. |
| Sessions | None (stateless). Each request gets a fresh server, which suits short-lived Vercel functions.                                                                                   |
| Logging  | The usual `request_done` line, plus `mcp_tool_called` (tool name, `transport: "http"` to tell it apart from the local server's lines, the report's `status`, and milliseconds) and `mcp_auth_failed`. These feed the audit log for item 3.                             |
| Limits   | One tool, no input, so there is nothing for a caller to stuff with text. The response is under 1 KB (27 fields).                                                              |
| Secret   | `MCP_API_KEY` in `.env.local`, `.env.example` (name only) and Vercel, set on the same day.                                                                                      |

## How it will be checked

1. **No key:** a `curl` request with no `Authorization` header returns 401, and `mcp_auth_failed` appears in the logs.
2. **Wrong key:** same result.
3. **Right key:** the tool list shows exactly one tool, `get_weekly_health`, and calling it returns the report.
4. **Live:** the same three checks against the Vercel address, not just my computer.
5. **Connected:** an AI assistant connected with the key calls the tool and answers "is MyChair healthy this week?" from the result. Setup steps for the client come once the server is live.

Tests in `npm test` cover the key check (missing, wrong, right, and unset) and the tool's output having only the allowed fields.

## Costs I am accepting

- One more secret to keep and rotate.
- A static key, not a full login (OAuth). Fine for one owner and one agent, but any client holding the key has the same access, so it is kept to a single read-only tool.
- Some AI apps only connect to remote servers through OAuth, not a fixed key. If the app I use can't send the header, I connect from Claude Code (which can) instead of adding a login system.
