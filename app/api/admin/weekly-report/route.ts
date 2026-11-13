// app/api/admin/weekly-report/route.ts
// WHAT IT'S FOR: the weekly app health + security report. GET /api/admin/weekly-report returns
// ONE flat JSON object of counts and yes/no checks for the last 7 days. Admin-key protected.
// WHO USES IT: the Make scenario that runs every Sunday night and adds the numbers to a Google
// Sheet, and you in Postman or curl.
// WHY THE NAME: folder path = URL (app/api/admin/weekly-report -> /api/admin/weekly-report).
//
// PRIVACY: the report holds counts and yes/no only. The log line it writes holds counts too.

import { ApiError } from "@/lib/api-error";
import { requireAdminKey } from "@/lib/admin-auth";
import { log } from "@/lib/logger";
import { buildReport } from "@/lib/report";
import { gatherReportInputs } from "@/lib/report-data";
import { withLogging } from "@/lib/with-logging";

// Never cache: every call reads the latest numbers.
export const dynamic = "force-dynamic";

export const GET = withLogging("/api/admin/weekly-report", async (request) => {
  // 1. Lock: wrong or missing key stops here with a 401.
  requireAdminKey(request);

  // 2. Gather and build. A database problem gives a safe message; the real reason is logged.
  const startedAt = performance.now();
  let report;
  try {
    report = buildReport(await gatherReportInputs());
  } catch (cause) {
    throw new ApiError(503, "REPORT_UNAVAILABLE", "Could not build the report right now.", { cause });
  }

  // 3. The app-side run record: proof this report was served, with when and what it said.
  log.info("weekly_report_served", {
    status: report.status,
    requests: report.requests,
    serverErrors5xx: report.server_errors_5xx,
    securityStatus: report.security_status,
    securityNotes: report.security_notes,
    ms: Math.round(performance.now() - startedAt),
  });

  return Response.json(report);
});
