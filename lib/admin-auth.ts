// lib/admin-auth.ts
// WHAT IT'S FOR: a simple lock for the admin-only routes (search and embedding status). A
// request must carry the secret ADMIN_API_KEY in an "x-admin-key" header, or it gets a 401.
// THIS IS TEMPORARY: it stands in for real login until the Super Admin login exists
// (the "trimmed Section 3"). Then requireAdminKey gets replaced by the shared role check.
// WHO USES IT: app/api/search/route.ts and app/api/admin/embeddings/route.ts.
// Tested by lib/admin-auth.test.ts.
// WHY THE NAME: it's the admin lock; ".ts" = no screen code.

// "createHash" and "timingSafeEqual" are built into Node.js. timingSafeEqual compares two
// secrets in constant time, so an attacker can't guess the key letter by letter from how long
// the comparison takes.
import { createHash, timingSafeEqual } from "node:crypto";
import { ApiError } from "./api-error";
import { log } from "./logger";

// Returns true only if the provided key matches the expected one. Pure function (easy to test).
export function isValidAdminKey(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  // Hash both first so they always have the same length (timingSafeEqual requires equal lengths).
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

// Call at the top of a protected route. Throws (so the route stops) unless the key is right.
export function requireAdminKey(request: Request): void {
  const expected = process.env.ADMIN_API_KEY;

  // If the server has no key configured, refuse everything rather than leaving the door open.
  if (!expected) {
    log.error("admin_key_not_configured", {});
    throw new ApiError(503, "NOT_CONFIGURED", "This feature is not available right now.");
  }

  if (!isValidAdminKey(request.headers.get("x-admin-key"), expected)) {
    // We log THAT a bad key was tried, never the key that was typed.
    log.warn("admin_auth_failed", {});
    throw new ApiError(401, "UNAUTHORIZED", "That admin key did not work.");
  }
}
