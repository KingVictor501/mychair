// lib/types.ts
// WHAT IT'S FOR: shared "shapes" (TypeScript types) for data that more than one file uses.
// WHO USES IT: app/api/health/route.ts (builds the answer) and
//              components/HealthStatus.tsx (reads the answer).
// WHY THE NAME: "types" = shapes of data; ".ts" because it holds no screen code (no HTML),
//               so it does not need the ".tsx" ending.
// Later sections add one shared type per main thing (shop, pro, client, service, appointment).

// The answer the health route sends back.
// "ok"    = the app is running AND the database answered.
// "error" = the app is running but the database did not answer.
export type HealthResponse = {
  status: "ok" | "error";
  // Only present on errors. A short, safe message: never a stack trace or connection details.
  message?: string;
};
