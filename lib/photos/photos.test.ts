// lib/photos/photos.test.ts
// WHAT IT'S FOR: automated checks of the photo rules (no storage or database): real JPG, PNG and
// WebP files pass; SVG, renamed files, empty and oversized files are refused; the per-card limit
// holds. Run with `npm test`.
// WHY THE NAME: tests for lib/photos/.

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPhoto, detectImageType, MAX_PHOTO_BYTES, MAX_PHOTOS_PER_CARD } from "./validate";

const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

test("real JPG, PNG and WebP files are recognized by their first bytes", () => {
  assert.equal(detectImageType(JPG)?.contentType, "image/jpeg");
  assert.equal(detectImageType(PNG)?.contentType, "image/png");
  assert.equal(detectImageType(WEBP)?.contentType, "image/webp");
});

test("SVG, text and a RIFF file that isn't WebP are refused", () => {
  assert.equal(detectImageType(SVG), null);
  assert.equal(detectImageType(new TextEncoder().encode("just text")), null);
  assert.equal(detectImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x41, 0x56, 0x49, 0x20])), null, "an AVI video");
  assert.equal(checkPhoto(SVG, 0).ok, false);
});

test("empty and oversized files are refused; a file at the limit passes", () => {
  assert.equal(checkPhoto(new Uint8Array(0), 0).ok, false);
  const atLimit = new Uint8Array(MAX_PHOTO_BYTES);
  atLimit.set(JPG);
  assert.equal(checkPhoto(atLimit, 0).ok, true);
  const tooBig = new Uint8Array(MAX_PHOTO_BYTES + 1);
  tooBig.set(JPG);
  const result = checkPhoto(tooBig, 0);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /4 MB/);
});

test("a full style card refuses another photo", () => {
  assert.equal(checkPhoto(JPG, MAX_PHOTOS_PER_CARD - 1).ok, true);
  assert.equal(checkPhoto(JPG, MAX_PHOTOS_PER_CARD).ok, false);
});
