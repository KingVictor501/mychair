// lib/clients/clients.test.ts
// WHAT IT'S FOR: automated checks of who may search clients and how (no database): pros only by
// a full phone number, owners and the Super Admin by name or phone, clients never; and the
// new-client input rules. Run with `npm test`.
// WHY THE NAME: tests for lib/clients/.

import { test } from "node:test";
import assert from "node:assert/strict";
import { newClientInput, parseClientSearch } from "./search";

test("a pro can search only by a full phone number", () => {
  assert.deepEqual(parseClientSearch("pro", "(212) 555-0111"), { ok: true, search: { kind: "phone", phone: "+12125550111" } });
  assert.equal(parseClientSearch("pro", "Chris").ok, false, "no searching by name");
  assert.equal(parseClientSearch("pro", "555").ok, false, "no partial numbers");
  assert.equal(parseClientSearch("pro", "").ok, false);
});

test("owners and the Super Admin can search by any part of a name or number", () => {
  assert.deepEqual(parseClientSearch("owner", "Chr"), { ok: true, search: { kind: "text", text: "Chr", digits: "" } });
  assert.deepEqual(parseClientSearch("super_admin", "555-01"), { ok: true, search: { kind: "text", text: "555-01", digits: "55501" } });
  assert.equal(parseClientSearch("owner", "C").ok, false, "too short");
});

test("clients can't search other clients", () => {
  assert.equal(parseClientSearch("client", "(212) 555-0111").ok, false);
});

test("a new client needs a first name and a phone, and nothing else", () => {
  assert.equal(newClientInput.safeParse({ name: "Jordan", phone: "212-555-0199" }).success, true);
  assert.equal(newClientInput.safeParse({ name: "", phone: "212-555-0199" }).success, false);
  assert.equal(newClientInput.safeParse({ name: "Jordan", phone: "212-555-0199", role: "owner" }).success, false, "no extra fields (like a role)");
});
