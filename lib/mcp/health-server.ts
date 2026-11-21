// lib/mcp/health-server.ts
// WHAT IT'S FOR: the live MCP server's ONE tool, get_weekly_health. It returns the same
// 7-day health and security report the Make automation reads: counts and ok/attention words
// only. It is read-only and has no input. The design (and the tool we refused to build) is in
// docs/mcp-remote-design.md.
// WHO USES IT: app/api/mcp/route.ts (the live address) and lib/mcp/health-server.test.ts.
// WHY THE NAME: the MCP server for app "health"; ".ts" = no screen code.
//
// The report is passed in as a function ("getReport") instead of being fetched here. That way
// the tests can hand it a pretend report, and the real route hands it the database version.

// McpServer and createMcpHandler come from the official MCP package (@modelcontextprotocol/server
// v2). createMcpHandler turns a server into a plain web handler: Request in, Response out,
// which is exactly what a Next.js route on Vercel needs.
import { createMcpHandler, McpServer, type McpHttpHandler } from "@modelcontextprotocol/server";
import { z } from "zod";
import { log } from "../logger";
import type { WeeklyReport } from "../report";
import { errorReply, textReply, type ToolReply } from "./tools";

export const HEALTH_TOOL_NAME = "get_weekly_health";

// The only fields the tool may ever send back. If someone adds a field to the report later,
// it is NOT sent until it is added here on purpose (and the test is updated).
export const HEALTH_FIELDS = [
  "status",
  "week_start",
  "week_end",
  "generated_at",
  "requests",
  "server_errors_5xx",
  "error_rate_pct",
  "p50_ms",
  "p95_ms",
  "questions_asked",
  "answered",
  "refused",
  "bad_requests_400",
  "unauthorized_401",
  "forbidden_403",
  "too_many_429",
  "auth_failures",
  "injection_blocked",
  "cap_hits",
  "corpus_chunks",
  "corpus_chunks_flagged",
  "admin_key_set",
  "anthropic_key_set",
  "log_level_ok",
  "logging_alive",
  "security_status",
  "security_notes",
] as const satisfies ReadonlyArray<keyof WeeklyReport>;

// Copies only the allowed fields into a new object, in a fixed order.
export function pickHealthFields(report: WeeklyReport): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of HEALTH_FIELDS) out[field] = report[field];
  return out;
}

// Builds the tool's reply: the report as JSON text, which Claude can read and quote.
export function formatHealthReply(report: WeeklyReport): ToolReply {
  return textReply(JSON.stringify(pickHealthFields(report), null, 2));
}

// Builds the web handler with its one tool. "getReport" supplies the numbers.
export function createHealthMcpHandler(getReport: () => Promise<WeeklyReport>): McpHttpHandler {
  // The MCP docs ask for a fresh server for each request, so this function runs every time.
  return createMcpHandler(() => {
    const server = new McpServer({ name: "mychair-health", version: "1.0.0" });

    server.registerTool(
      HEALTH_TOOL_NAME,
      {
        description:
          "Get MyChair's health and security report for the last 7 days: requests, server errors, latency, questions answered or refused, failed key attempts, injection-screen hits, and an overall status and security status. Counts only, no personal data. Read-only.",
        // No input at all: an empty object, and anything extra is ignored.
        inputSchema: z.object({}),
      },
      async () => {
        const startedAt = Date.now();
        try {
          const report = await getReport();
          log.info("mcp_tool_called", {
            tool: HEALTH_TOOL_NAME,
            transport: "http",
            status: report.status,
            securityStatus: report.security_status,
            ms: Date.now() - startedAt,
          });
          return formatHealthReply(report);
        } catch {
          // The real reason is not logged here on purpose (it could hold database details);
          // the tool name and time are enough to find it. The caller gets a friendly message.
          log.error("mcp_tool_failed", { tool: HEALTH_TOOL_NAME, transport: "http", ms: Date.now() - startedAt });
          return errorReply("MyChair's health report could not be built right now. Please try again in a few minutes.");
        }
      },
    );

    return server;
  });
}
