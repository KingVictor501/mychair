// lib/agent/health-client.ts
// WHAT IT'S FOR: the triage agent's connection to the live MCP server. It sends one MCP
// message (tools/call get_weekly_health) with the MCP key and returns the report, or a clear
// reason it couldn't. Also the polite messages printed when a run has to stop.
// WHO USES IT: scripts/agent-triage.ts. Tested by lib/agent/health-client.test.ts.
// WHY THE NAME: it's the client for the health tool; ".ts" = no screen code.
//
// SAFETY: the key goes only in the Authorization header. Errors carry a reason code, never the
// key or the response body.

import type { WeeklyReport } from "../report";
import { HEALTH_FIELDS, HEALTH_TOOL_NAME } from "../mcp/health-server";

// Why a run had to stop. These codes go in the audit log and the agent_run log line.
export type StopReason =
  | "mcp_unauthorized" // the server refused the key (401)
  | "mcp_not_configured" // the server has no MCP key set (503)
  | "mcp_unavailable" // network error, timeout, or another error status
  | "mcp_bad_response" // the answer wasn't the report we expected
  | "claude_unavailable" // Claude couldn't be reached or returned an error
  | "claude_refused" // Claude declined the request
  | "note_rejected" // Claude's note failed the checks three times
  | "no_note"; // Claude finished without writing a note

// Thrown to stop a run on purpose. The program catches it and records the reason.
export class AgentStop extends Error {
  readonly reason: StopReason;
  constructor(reason: StopReason) {
    super(reason);
    this.name = "AgentStop";
    this.reason = reason;
  }
}

// One plain line per reason: what failed, that nothing changed, and what to check.
export function stopMessage(reason: StopReason): string {
  const next: Record<StopReason, string> = {
    mcp_unauthorized: "The health server refused the key. Check that MCP_API_KEY in .env.local matches the one in Vercel.",
    mcp_not_configured: "The health server has no MCP_API_KEY set. Add it in Vercel and redeploy.",
    mcp_unavailable: "The health server couldn't be reached. Check that the site is up, then try again.",
    mcp_bad_response: "The health server answered, but not with a report. Check the latest deploy of /api/mcp.",
    claude_unavailable: "Claude couldn't be reached. Check ANTHROPIC_API_KEY and the Anthropic status page, then try again.",
    claude_refused: "Claude declined this request. Read the run's log line and try again later.",
    note_rejected: "Claude's note failed the checks three times, so it wasn't saved. Run it again with --dry to see why.",
    no_note: "Claude finished without writing a note. Run it again with --dry to see why.",
  };
  return `Triage stopped (${reason}). No note was written and nothing in the app was changed. ${next[reason]}`;
}

// What a successful call returns: the report and the server's request ID (to match the logs).
export type HealthResult = { report: WeeklyReport; requestId: string | null };

// Calls get_weekly_health on the live server. "fetchImpl" lets tests pass a pretend fetch.
export async function fetchWeeklyHealth(
  url: string,
  key: string,
  fetchImpl: typeof fetch = fetch,
): Promise<HealthResult> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: HEALTH_TOOL_NAME, arguments: {} },
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new AgentStop("mcp_unavailable");
  }

  if (response.status === 401) throw new AgentStop("mcp_unauthorized");
  if (response.status === 503) throw new AgentStop("mcp_not_configured");
  if (!response.ok) throw new AgentStop("mcp_unavailable");

  const requestId = response.headers.get("x-request-id");
  const report = parseHealthReply(await response.text());
  return { report, requestId };
}

// Reads the MCP answer (plain JSON, or one "data:" line of a stream) and pulls out the report.
// Also accepts a plain saved report, for dry runs with --report-file.
export function parseHealthReply(text: string): WeeklyReport {
  try {
    const json = text.trim().startsWith("{")
      ? text
      : (text.split("\n").find((line) => line.startsWith("data:")) ?? "").slice(5);
    const parsed = JSON.parse(json) as { result?: { content?: Array<{ text?: string }>; isError?: boolean } };
    if (parsed.result?.isError) throw new Error("tool error");
    // An MCP answer wraps the report as text; a saved report file (dry runs) is the report itself.
    const report = (parsed.result ? JSON.parse(parsed.result.content?.[0]?.text ?? "") : parsed) as Record<string, unknown>;
    // Every expected field must be there; anything else is not a report.
    for (const field of HEALTH_FIELDS) if (!(field in report)) throw new Error("missing field");
    return report as WeeklyReport;
  } catch {
    throw new AgentStop("mcp_bad_response");
  }
}
