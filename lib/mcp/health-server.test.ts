// lib/mcp/health-server.test.ts
// WHAT IT'S FOR: automated checks of the live MCP server's one tool, with a pretend report
// (no database or internet). It sends real MCP messages through the same web handler the
// live route uses and checks that:
//   - the server lists exactly ONE tool, get_weekly_health,
//   - calling it returns only the allowed report fields,
//   - a failure gives a friendly error instead of crashing.
// Run with `npm test`.
// WHY THE NAME: "<file>.test.ts" = the tests for <file>.ts.

import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { drainPendingLogs } from "../logger";
import { buildReport, type WeeklyReport } from "../report";
import { createHealthMcpHandler, HEALTH_FIELDS, HEALTH_TOOL_NAME, pickHealthFields } from "./health-server";

const originalLevel = process.env.LOG_LEVEL;
const realStdoutWrite = process.stdout.write.bind(process.stdout);
const realStderrWrite = process.stderr.write.bind(process.stderr);

beforeEach(() => {
  process.env.LOG_LEVEL = "error";
  process.stdout.write = (() => true) as typeof process.stdout.write;
  process.stderr.write = (() => true) as typeof process.stderr.write;
  drainPendingLogs();
});

afterEach(() => {
  process.stdout.write = realStdoutWrite;
  process.stderr.write = realStderrWrite;
  if (originalLevel === undefined) delete process.env.LOG_LEVEL;
  else process.env.LOG_LEVEL = originalLevel;
  drainPendingLogs();
});

// A pretend healthy week, built by the real report rules.
const SAMPLE: WeeklyReport = buildReport({
  now: new Date("2026-11-15T02:00:00.000Z"),
  requests: 100,
  serverErrors5xx: 2,
  unauthorized401: 1,
  forbidden403: 0,
  tooMany429: 0,
  badRequests400: 3,
  p50Ms: 120,
  p95Ms: 900,
  questionsAsked: 10,
  answered: 8,
  refused: 2,
  injectionBlocked: 0,
  authFailures: 1,
  capHits: 0,
  corpusChunks: 118,
  corpusChunksFlagged: 0,
  newestLogAt: new Date("2026-11-15T01:30:00.000Z"),
  adminKeySet: true,
  anthropicKeySet: true,
  logLevelOk: true,
});

// The shape of one MCP (JSON-RPC) answer that these tests read.
type RpcReply = {
  result?: {
    tools?: Array<{ name: string }>;
    content?: Array<{ type: string; text: string }>;
    isError?: boolean;
  };
  error?: { message: string };
};

// Sends one MCP message to the handler, the way an AI client would over HTTP.
async function send(
  handler: ReturnType<typeof createHealthMcpHandler>,
  method: string,
  params: Record<string, unknown> = {},
): Promise<RpcReply> {
  const response = await handler.fetch(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    }),
  );
  const text = await response.text();
  // The answer comes back either as plain JSON or as one "data:" line of a stream.
  const json = text.trim().startsWith("{") ? text : (text.split("\n").find((l) => l.startsWith("data:")) ?? "").slice(5);
  return JSON.parse(json) as RpcReply;
}

test("the report fields allowed out match the report exactly", () => {
  assert.deepEqual(Object.keys(pickHealthFields(SAMPLE)).sort(), Object.keys(SAMPLE).sort());
  assert.equal(HEALTH_FIELDS.length, 27);
});

test("a field added to the report later is not sent until it is allowed on purpose", () => {
  const withExtra = { ...SAMPLE, secret_extra: "should not appear" } as WeeklyReport;
  assert.equal("secret_extra" in pickHealthFields(withExtra), false);
});

test("the server lists exactly one tool: get_weekly_health", async () => {
  const handler = createHealthMcpHandler(async () => SAMPLE);
  const reply = await send(handler, "tools/list");
  assert.deepEqual(
    reply.result?.tools?.map((t) => t.name),
    [HEALTH_TOOL_NAME],
  );
});

test("calling the tool returns the report fields", async () => {
  const handler = createHealthMcpHandler(async () => SAMPLE);
  const reply = await send(handler, "tools/call", { name: HEALTH_TOOL_NAME, arguments: {} });
  assert.notEqual(reply.result?.isError, true);
  const body = JSON.parse(reply.result?.content?.[0]?.text ?? "{}") as Record<string, unknown>;
  assert.deepEqual(Object.keys(body), [...HEALTH_FIELDS]);
  assert.equal(body.status, "ok");
  assert.equal(body.requests, 100);
});

test("a failing report gives a friendly tool error, not a crash", async () => {
  const handler = createHealthMcpHandler(async () => {
    throw new Error("database password=hunter2 unreachable");
  });
  const reply = await send(handler, "tools/call", { name: HEALTH_TOOL_NAME, arguments: {} });
  assert.equal(reply.result?.isError, true);
  const text = reply.result?.content?.[0]?.text ?? "";
  assert.match(text, /could not be built right now/);
  assert.doesNotMatch(text, /hunter2|database/);
});

test("an unknown tool is refused", async () => {
  const handler = createHealthMcpHandler(async () => SAMPLE);
  const reply = await send(handler, "tools/call", { name: "read_logs", arguments: {} });
  const refused = reply.error !== undefined || reply.result?.isError === true;
  assert.equal(refused, true);
});
