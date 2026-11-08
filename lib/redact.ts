// lib/redact.ts
// WHAT IT'S FOR: the "black marker" for logs. Every log line passes through here first. It
// hides anything that looks like a secret or personal detail: passwords, tokens, keys,
// cookies, emails, phone numbers, card numbers, and raw request bodies/headers.
// It works two ways:
//   1. By KEY NAME: if a detail is called "password" or "email", its value is hidden.
//   2. By VALUE: even under a harmless name (like "message"), text that LOOKS like an email,
//      phone, card number, token, or a database address with a password gets masked.
// WHO USES IT: lib/logger.ts (every log call). Tested by lib/redact.test.ts.
// WHY THE NAME: "redact" = black out private parts of a document; ".ts" = plain logic, no screen code.
//
// NOTE: imports in this file stay relative (no "@/") so the test runner can load it simply.

// The text that replaces anything secret.
export const REDACTED = "[REDACTED]";

// Longest text we keep from any one value. Stops giant bodies from flooding the logs.
const MAX_STRING_LENGTH = 300;
// How deep into nested objects we look, and how many items we keep, so a huge object can't flood logs.
const MAX_DEPTH = 5;
const MAX_ARRAY_ITEMS = 20;
const MAX_OBJECT_KEYS = 40;

// KEY NAMES that mean "secret". The "i" at the end means upper/lower case doesn't matter.
// (Written as pieces so each one can be explained.)
const SENSITIVE_KEY_PATTERN = new RegExp(
  [
    "passw(or)?d", // password, passwd
    "^pass$",
    "pwd",
    "secret", // clientSecret, secret
    "token", // accessToken, refresh_token
    "api[-_]?key", // apiKey, x-api-key
    "private[-_]?key",
    "access[-_]?key",
    "authorization",
    "cookie", // cookie, set-cookie
    "session", // sessionId, session
    "jwt",
    "bearer",
    "credential",
    "connection[-_]?string",
    "database[-_]?url",
    "dsn",
    "email",
    "phone",
    "mobile",
    "card[-_]?(number|num|no)",
    "cardnumber",
    "cvv",
    "cvc",
    "ssn",
  ].join("|"),
  "i",
);

// Keys that are hidden only when the WHOLE key matches (after removing "-" and "_" and lowercasing).
// A raw request body or the full headers could hold anything, so we never keep them.
const SENSITIVE_EXACT_KEYS = new Set([
  "body",
  "rawbody",
  "requestbody",
  "reqbody",
  "payload",
  "headers",
  "reqheaders",
  "requestheaders",
]);

// True if a key name should have its value hidden.
function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_]/g, "");
  return SENSITIVE_EXACT_KEYS.has(normalized) || SENSITIVE_KEY_PATTERN.test(key);
}

// Cleans one piece of text: masks anything inside it that looks private.
// Order matters: the database-address rule runs before the email rule so
// "postgresql://user:pw@host" is handled as an address, not mistaken for an email.
export function scrubString(input: string): string {
  let text = input;

  // Addresses with a username:password in them, e.g. postgresql://user:pw@host/db
  text = text.replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]*@/gi, `$1${REDACTED}@`);
  // "Bearer abc123..." login tokens
  text = text.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`);
  // JWTs: three chunks starting with "eyJ", separated by dots
  text = text.replace(/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, REDACTED);
  // Email addresses
  text = text.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[REDACTED_EMAIL]");
  // Card-number-like runs: 13 to 19 digits, optionally split by spaces or dashes
  text = text.replace(/\b(?:\d[ -]?){13,19}\b/g, "[REDACTED_NUMBER]");
  // Phone numbers: +15551234567 style, or 555-123-4567 / (555) 123 4567 style
  text = text.replace(/\+\d{10,15}\b/g, "[REDACTED_PHONE]");
  text = text.replace(/\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g, "[REDACTED_PHONE]");

  // Finally, cut very long text.
  if (text.length > MAX_STRING_LENGTH) {
    text = `${text.slice(0, MAX_STRING_LENGTH)}…[truncated]`;
  }
  return text;
}

// Walks through any value (text, number, list, object, error...) and returns a cleaned COPY.
// The original is never changed. "seen" remembers objects we've already visited so an object
// that contains itself can't make us loop forever.
function redactValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") return scrubString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return "[unserializable]";

  if (value instanceof Date) return value.toISOString();

  // Errors: keep only the name and a cleaned message. Never the stack trace.
  if (value instanceof Error) {
    return { name: value.name, message: scrubString(value.message) };
  }

  // From here on, value is an object or a list.
  if (typeof value !== "object") return "[unserializable]";
  if (seen.has(value)) return "[circular]";
  if (depth >= MAX_DEPTH) return "[too deep]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => redactValue(item, depth + 1, seen));
  }

  const result: Record<string, unknown> = {};
  const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_OBJECT_KEYS);
  for (const [key, inner] of entries) {
    // Secret-looking KEY: hide the value without even looking at it.
    result[key] = isSensitiveKey(key) ? REDACTED : redactValue(inner, depth + 1, seen);
  }
  return result;
}

// Cleans any value. Use this on anything that is about to be logged.
export function redact(value: unknown): unknown {
  return redactValue(value, 0, new WeakSet<object>());
}

// Cleans a "details" object for a log line (the usual case). Returns an empty object if none was given.
export function redactDetails(details?: Record<string, unknown>): Record<string, unknown> {
  if (!details) return {};
  const cleaned = redact(details);
  return (cleaned ?? {}) as Record<string, unknown>;
}
