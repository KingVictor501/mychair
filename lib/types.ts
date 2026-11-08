// lib/types.ts
// WHAT IT'S FOR: shared "shapes" (TypeScript types) for data that more than one file uses.
// WHO USES IT: app/api/health/route.ts, lib/with-logging.ts (build the answers) and
//              components/HealthStatus.tsx (reads the answer).
// WHY THE NAME: "types" = shapes of data; ".ts" because it holds no screen code (no HTML),
//               so it does not need the ".tsx" ending.
// Later sections add one shared type per main thing (shop, pro, client, service, appointment).

// The answer the health route sends when everything works.
// (Being able to answer at all means the app is running AND the database replied.)
export type HealthResponse = {
  status: "ok";
};

// The standard shape of EVERY error the API sends back (see docs/api-design.md).
// Short and friendly: never a stack trace or connection details.
export type ApiErrorBody = {
  error: {
    code: string; // e.g. "DB_UNREACHABLE"
    message: string; // e.g. "Database unreachable"
  };
};
