// app/api/auth/login/route.ts
// WHAT IT'S FOR: POST /api/auth/login with { identifier, password }. "identifier" is an email or
// a phone number. On success it sets the signed session cookie and returns who logged in.
// On failure it always says the same thing ("Invalid email, phone or password"), so nobody can
// use it to find out which accounts exist.
// WHO USES IT: the login page (components/LoginForm.tsx) and curl.
// WHY THE NAME: folder path = URL (app/api/auth/login -> /api/auth/login).
//
// PRIVACY: logs login_attempt with the user ID (if found) and ok true/false. Never the email,
// phone or password.

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";
import { ApiError } from "@/lib/api-error";
import { parseIdentifier } from "@/lib/auth/identifier";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE, SESSION_DAYS, sessionCookieOptions } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { isDemoModeOn } from "@/lib/demo/mode";
import { log } from "@/lib/logger";
import type { MeResponse, Role } from "@/lib/types";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

// The only input accepted. Lengths are capped so nobody can send a huge body.
const body = z.object({
  identifier: z.string().trim().min(3).max(200),
  password: z.string().min(1).max(200),
});

const INVALID = "Invalid email, phone or password.";

// A hash of a random value, made once per server start, used only for the timing match above.
let dummy: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  dummy ??= hashPassword(crypto.randomUUID());
  return dummy;
}

export const POST = withLogging("/api/auth/login", async (request) => {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, "BAD_INPUT", "Enter your email or phone and your password.");

  const id = parseIdentifier(parsed.data.identifier);
  if (!id) {
    log.info("login_attempt", { ok: false });
    throw new ApiError(401, "INVALID_LOGIN", INVALID);
  }

  const [user] = await getDb()
    .select({ id: users.id, role: users.role, shopId: users.shopId, name: users.name, isDemo: users.isDemo, passwordHash: users.passwordHash })
    .from(users)
    .where(id.kind === "email" ? eq(users.email, id.value) : eq(users.phone, id.value));

  // When no account matches, still run one full password check against a throwaway hash, so the
  // response takes the same time either way and can't reveal which emails or phones exist.
  const ok = user
    ? await verifyPassword(parsed.data.password, user.passwordHash)
    : (await verifyPassword(parsed.data.password, await dummyHash()), false);
  // A demo account can only log in while demo mode is on.
  const demoBlocked = ok && user?.isDemo === true && !(await isDemoModeOn());
  log.info("login_attempt", { userId: user?.id, ok: ok && !demoBlocked });
  if (!user || !ok || demoBlocked) throw new ApiError(401, "INVALID_LOGIN", INVALID);

  const token = await createSessionToken({ userId: user.id, role: user.role as Role, shopId: user.shopId, demo: user.isDemo });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_DAYS * 24 * 60 * 60));

  const res: MeResponse = {
    user: { id: user.id, role: user.role as Role, shopId: user.shopId, name: user.name, isDemo: user.isDemo },
  };
  return Response.json(res);
});
