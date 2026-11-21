// lib/auth/password.ts
// WHAT IT'S FOR: turning a password into a hash for the database, and checking a typed password
// against that hash. The real password is never stored or logged.
// Uses scrypt, built into Node.js: a deliberately slow hash, so guessing passwords from a stolen
// database takes a very long time. Each password gets its own random "salt", so two people with
// the same password get different hashes.
// WHO USES IT: app/api/auth/login and signup routes, scripts/demo-seed.ts. Tested by
// lib/auth/auth.test.ts.
// WHY THE NAME: password helpers; ".ts" = no screen code.

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

// scrypt with a promise instead of a callback.
function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

// Returns "scrypt$<salt>$<hash>" (both in hex). This whole string is what the database stores.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

// True only if the password matches the stored hash. Compared in constant time, so the time it
// takes doesn't hint at how close a guess was. A missing or malformed hash never matches.
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
