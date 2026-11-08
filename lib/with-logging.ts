// lib/with-logging.ts
// WHAT IT'S FOR: the ONE place that logs the edges of every API request. Wrap a route's
// handler with it and the route automatically gets:
//   - request_start (debug): a request arrived
//   - request_done (info): it finished, with method, route, status, milliseconds, request ID
//   - request_failed (error): the handler threw, with route, status, and a short cleaned message
// and a safe JSON error for the visitor (never a stack trace). It also sends an
// "x-request-id" header back so one request can be found in the logs.
// WHO USES IT: every file named route.ts, like app/api/health/route.ts:
//     export const GET = withLogging("/api/health", async (request) => { ... });
// WHY THE NAME: it "wraps" a handler "with logging"; ".ts" = no screen code.

// "after" comes from Next.js. It runs a function once the response has been sent, so saving
// logs to the database never makes the visitor wait.
import { after } from "next/server";
import { ApiError } from "./api-error";
import { flushLogs, log } from "./logger";
import type { ApiErrorBody } from "./types";

// What a route handler looks like: it gets the request (and, for URLs with [params], a context)
// and returns a response. "C" is the context type, which Next.js fills in.
type Handler<C> = (request: Request, context: C) => Promise<Response> | Response;

// Pulls a plain message out of anything that was thrown. The logger cleans it further.
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

// "routeName" is the route PATTERN (like "/api/health"), written by hand on purpose: we never
// log the real URL, because it could contain private search words or IDs.
export function withLogging<C = unknown>(routeName: string, handler: Handler<C>) {
  return async (request: Request, context: C): Promise<Response> => {
    const startedAt = performance.now();
    // A short ID that ties this request's log lines together, e.g. r_8f2c1d3e.
    const requestId = `r_${crypto.randomUUID().slice(0, 8)}`;
    const method = request.method;

    log.debug("request_start", { method, route: routeName, requestId });

    let response: Response;
    try {
      response = await handler(request, context);
    } catch (error) {
      // A route threw. Work out the status and what the visitor may see.
      const apiError = error instanceof ApiError ? error : undefined;
      const status = apiError?.status ?? 500;
      // If we were given a real cause, log that; otherwise log the error itself.
      const reason = apiError?.cause ?? error;

      // Only the route, status and a short cleaned message. Never the request or the whole error object.
      log.error("request_failed", { method, route: routeName, requestId, status, message: messageOf(reason) });

      const body: ApiErrorBody = {
        error: {
          code: apiError?.code ?? "INTERNAL_ERROR",
          message: apiError ? apiError.message : "Something went wrong. Please try again.",
        },
      };
      response = Response.json(body, { status });
    }

    const ms = Math.round(performance.now() - startedAt);
    response.headers.set("x-request-id", requestId);
    log.info("request_done", { method, route: routeName, status: response.status, ms, requestId });

    // Save this request's log lines to the database after the response has gone out.
    after(flushLogs);
    return response;
  };
}
