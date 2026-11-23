// lib/guest/shop-search.test.ts
// WHAT IT'S FOR: tests the predictive shop search ranking (lib/guest/shop-search.ts). Run with `npm test`.
// WHY THE NAME: tests for shop-search.ts.

import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeName, rankShops, shopMatchScore } from "./shop-search";

const shops = [{ name: "Fade Factory" }, { name: "Polished Nail Bar" }, { name: "Lash & Co." }, { name: "Fresh Fades Barbers" }, { name: "Nail Haven" }];
const names = (typed: string) => rankShops(shops, typed).map((s) => s.name);

test("normalizeName lowercases, reads & as and, and drops punctuation", () => {
  assert.equal(normalizeName("Lash & Co."), "lash and co");
  assert.equal(normalizeName("  Dee's  NAILS! "), "dees nails");
  assert.equal(normalizeName("Café Lashes"), "cafe lashes");
});

test("a few letters find the shop, start-of-name first", () => {
  assert.equal(names("fa")[0], "Fade Factory");
  assert.deepEqual(names("nail"), ["Nail Haven", "Polished Nail Bar"]);
  assert.equal(names("lash and")[0], "Lash & Co.");
  assert.equal(names("LASH &")[0], "Lash & Co.");
});

test("words can come in any order and be cut short", () => {
  assert.equal(names("factory fa")[0], "Fade Factory");
  assert.equal(names("bar pol")[0], "Polished Nail Bar");
});

test("a small typo still finds the shop", () => {
  assert.equal(names("fade facotry")[0], "Fade Factory");
  assert.equal(names("polsihed")[0], "Polished Nail Bar");
  assert.equal(names("nial")[0], "Nail Haven");
});

test("unrelated text finds nothing", () => {
  assert.deepEqual(names("pizza"), []);
  assert.equal(shopMatchScore("Fade Factory", "zz"), 0);
});

test("with nothing typed, shops show A to Z, up to the limit", () => {
  assert.deepEqual(names(""), ["Fade Factory", "Fresh Fades Barbers", "Lash & Co.", "Nail Haven", "Polished Nail Bar"]);
  assert.equal(rankShops(shops, "", 2).length, 2);
});
