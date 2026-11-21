// lib/auth/session.ts
// WHAT IT'S FOR: the login session. After a correct password, the server makes a small signed
// token (a JWT) saying "this is user X, role Y, shop Z, until time T", and stores it in a cookie.
// On every later request the server checks the signature before trusting it.
//   - Signed with SESSION_SECRET using HS256 (via the jose package). Anyone can READ a JWT, but
//     nobody without the secret can CHANGE it: editing "role":"client" to "super_admin" breaks
//     the signature, and jwtVerify refuses it.
//   - It expires (7 days), so a stolen cookie doesn't work forever.
//   - The cookie is httpOnly (page scripts can't read it), secure on HTTPS, and SameSite=Lax
//     (other sites can't make the browser send it with their form posts).
// WHO USES IT: app/api/auth/* routes and lib/auth/current-user.ts. Tested by lib/auth/auth.test.ts.
// WHY THE NAME: the login "session"; ".ts" = no screen code.

// SignJWT makes and signs a token; jwtVerify checks the signature and the expiry.
import { jwtVerify, SignJWT } from "jose";
import type { Role } from "../types";

export const SESSION_COOKIE = "mychair_session";
export const SESSION_DAYS = 7;
const ALG = "HS256";
const ISSUER = "mychair";

// What the token says about the person. Kept small: IDs and the role, never a name or email.
export type SessionClaims = { userId: string; role: Role; shopId: string | null; demo: boolean };

// The secret as bytes. A missing or short secret stops the app from signing anything.
function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET is missing or shorter than 32 characters");
  return new TextEncoder().encode(secret);
}

// Makes the signed token for a user who just logged in.
export async function createSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ role: claims.role, shopId: claims.shopId, demo: claims.demo })
    .setProtectedHeader({ alg: ALG })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

// Checks a token and returns what it says, or null if it's missing, tampered with, expired, or
// signed with a different secret. Never throws, so a bad cookie just means "not logged in".
export async function readSessionToken(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: [ALG], issuer: ISSUER });
    const role = payload.role;
    if (typeof payload.sub !== "string" || !isRole(role)) return null;
    return {
      userId: payload.sub,
      role,
      shopId: typeof payload.shopId === "string" ? payload.shopId : null,
      demo: payload.demo === true,
    };
  } catch {
    return null;
  }
}

// The cookie settings, shared by login (set) and logout (clear).
export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

function isRole(value: unknown): value is Role {
  return value === "super_admin" || value === "owner" || value === "pro" || value === "client";
}
