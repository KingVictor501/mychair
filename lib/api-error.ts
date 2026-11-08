// lib/api-error.ts
// WHAT IT'S FOR: a special kind of error an API route can "throw" when it wants a specific
// status code and a safe, friendly message sent to the visitor.
//     throw new ApiError(503, "DB_UNREACHABLE", "Database unreachable", { cause: realError });
// The visitor only ever sees the code and the friendly message. The REAL reason (the "cause")
// is only written to the logs (cleaned), never sent back.
// WHO USES IT: lib/with-logging.ts (catches it) and API routes (throw it).
// WHY THE NAME: it's an error for the API; ".ts" = no screen code.

export class ApiError extends Error {
  // The HTTP status, e.g. 400 (bad input), 403 (not allowed), 404 (not found), 503 (service down).
  readonly status: number;
  // A short machine-readable label, e.g. "DB_UNREACHABLE".
  readonly code: string;

  // "publicMessage" is what the visitor sees. "options.cause" is the real reason, for logs only.
  constructor(status: number, code: string, publicMessage: string, options?: { cause?: unknown }) {
    super(publicMessage, options);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}
