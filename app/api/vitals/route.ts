// app/api/vitals/route.ts
// WHAT IT'S FOR: POST /api/vitals receives one Core Web Vitals reading from a visitor's browser
// ({ name, value, rating, page }) and saves it for the Super Admin's Site performance panel.
// Public (every visitor's browser reports), so the input is checked (lib/vitals.ts vitalInput),
// extra fields are dropped, and the page is stored as a pattern with IDs removed. Answers 204.
// WHO USES IT: components/WebVitals.tsx (via navigator.sendBeacon).
// WHY THE NAME: folder path = URL (/api/vitals).
//
// RATE LIMIT: 200 readings per 10 minutes per IP (429).
//
// PRIVACY: nothing about the visitor is stored or logged: no user, IP, cookie or ID.

import { ApiError } from "@/lib/api-error";
import { getDb } from "@/lib/db/client";
import { webVitals } from "@/lib/db/schema";
import { pagePattern, vitalInput } from "@/lib/vitals";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { withLogging } from "@/lib/with-logging";

export const dynamic = "force-dynamic";

export const POST = withLogging("/api/vitals", async (request) => {
  // Rate limit (lib/rate-limit.ts), so nobody can flood the Site performance panel.
  await enforceRateLimit("vitals_ip", clientIp(request.headers));
  // sendBeacon sends the JSON as plain text, so read text and parse it ourselves (max 2 KB).
  const raw = (await request.text().catch(() => "")).slice(0, 2048);
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    body = null;
  }
  const parsed = vitalInput.safeParse(body);
  if (!parsed.success) throw new ApiError(400, "BAD_VITAL", "Not a web vitals reading.");
  await getDb().insert(webVitals).values({ page: pagePattern(parsed.data.page), name: parsed.data.name, value: parsed.data.value, rating: parsed.data.rating });
  return new Response(null, { status: 204 });
});
