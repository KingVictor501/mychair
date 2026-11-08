// lib/redact.test.ts
// WHAT IT'S FOR: automated checks that the redaction helper really hides secrets.
// Run with `npm test`. If someone later weakens lib/redact.ts, these tests fail.
// WHO USES IT: the test runner (`tsx --test`), never the app itself.
// WHY THE NAME: "<file>.test.ts" is the usual way to name the tests for <file>.ts.

// "test" and "assert" are built into Node.js, so no extra test package is needed.
import { test } from "node:test";
import assert from "node:assert/strict";
// The code being tested.
import { REDACTED, redact, redactDetails, scrubString } from "./redact";

// Shortcut: run redact on an object and treat the result as a plain object.
function clean(input: Record<string, unknown>): Record<string, unknown> {
  return redact(input) as Record<string, unknown>;
}

test("hides passwords, whatever the capital letters", () => {
  const out = clean({ password: "hunter2", Password: "x", userPassword: "y", passwd: "z" });
  assert.deepEqual(out, {
    password: REDACTED,
    Password: REDACTED,
    userPassword: REDACTED,
    passwd: REDACTED,
  });
});

test("hides tokens, keys, authorization and cookies", () => {
  const out = clean({
    token: "abc",
    accessToken: "abc",
    refresh_token: "abc",
    apiKey: "abc",
    "x-api-key": "abc",
    authorization: "Bearer abc",
    cookie: "a=b",
    "set-cookie": "a=b",
    secret: "abc",
    sessionId: "abc",
  });
  for (const value of Object.values(out)) assert.equal(value, REDACTED);
});

test("hides email, phone and card number keys", () => {
  const out = clean({
    email: "a@b.com",
    userEmail: "a@b.com",
    phone: "5551234567",
    phoneNumber: "5551234567",
    cardNumber: "4242424242424242",
    card_number: "4242424242424242",
    cvv: "123",
  });
  for (const value of Object.values(out)) assert.equal(value, REDACTED);
});

test("hides raw request bodies and headers", () => {
  const out = clean({ body: { a: 1 }, rawBody: "x", requestBody: "x", headers: { a: "b" } });
  for (const value of Object.values(out)) assert.equal(value, REDACTED);
});

test("keeps harmless facts untouched (IDs, route, status, timing)", () => {
  const facts = {
    method: "POST",
    route: "/api/appointments",
    status: 201,
    ms: 84,
    requestId: "r_8f2c",
    shopId: "s_12",
    userId: "u_123",
    ok: false,
    styleCardId: "c_9",
  };
  assert.deepEqual(clean(facts), facts);
});

test("hides secrets inside nested objects and lists", () => {
  const out = clean({
    user: { id: "u_1", password: "p", contacts: [{ email: "a@b.com", note: "ok" }] },
  }) as { user: { id: string; password: string; contacts: Array<{ email: string; note: string }> } };
  assert.equal(out.user.id, "u_1");
  assert.equal(out.user.password, REDACTED);
  assert.equal(out.user.contacts[0].email, REDACTED);
  assert.equal(out.user.contacts[0].note, "ok");
});

test("masks an email hiding inside normal text", () => {
  const out = scrubString("could not find account for jane.doe@example.com today");
  assert.ok(!out.includes("jane.doe@example.com"));
  assert.ok(out.includes("[REDACTED_EMAIL]"));
});

test("masks the password inside a database address", () => {
  const out = scrubString("connect failed postgresql://alice:s3cretpass@db.example.com/mychair");
  assert.ok(!out.includes("s3cretpass"));
  assert.ok(!out.includes("alice"));
  assert.ok(out.includes("db.example.com"));
});

test("masks Bearer tokens and JWTs inside text", () => {
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abcdefghijk";
  const out = scrubString(`header was Bearer abc.def-123 and cookie ${jwt}`);
  assert.ok(!out.includes("abc.def-123"));
  assert.ok(!out.includes(jwt));
});

test("masks card numbers and phone numbers inside text", () => {
  const out = scrubString("card 4242 4242 4242 4242 phone (555) 123-4567 and +15551234567");
  assert.ok(!out.includes("4242 4242 4242 4242"));
  assert.ok(!out.includes("123-4567"));
  assert.ok(!out.includes("+15551234567"));
});

test("an Error keeps its name and cleaned message but never its stack", () => {
  const error = new Error("failed for bob@example.com");
  const out = clean({ error }) as { error: { name: string; message: string; stack?: string } };
  assert.equal(out.error.name, "Error");
  assert.ok(!out.error.message.includes("bob@example.com"));
  assert.equal(out.error.stack, undefined);
});

test("an object that contains itself does not loop forever", () => {
  const loop: Record<string, unknown> = { name: "loop" };
  loop.self = loop;
  const out = clean(loop);
  assert.equal(out.self, "[circular]");
});

test("very long text is cut short", () => {
  const out = scrubString("a".repeat(5000));
  assert.ok(out.length < 400);
  assert.ok(out.endsWith("[truncated]"));
});

test("does not change the original object", () => {
  const original = { password: "p", nested: { token: "t" } };
  clean(original);
  assert.equal(original.password, "p");
  assert.equal(original.nested.token, "t");
});

test("redactDetails gives an empty object when there are no details", () => {
  assert.deepEqual(redactDetails(undefined), {});
});
