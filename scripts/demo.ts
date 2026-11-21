// scripts/demo.ts
// WHAT IT'S FOR: the demo data commands.
//   npm run demo:seed     add the three demo shops (skips if they already exist)
//   npm run demo:remove   delete every demo shop and demo account (real data is never touched)
//   npm run demo:reset    remove, then seed: a clean, current demo
// Runs against the database in DATABASE_URL (.env.local = the development branch). The demo
// login password comes from DEMO_PASSWORD; it is never printed.
// WHO USES IT: me, by hand. The Super Admin "Reset demo" button uses the same code (lib/demo/seed.ts).
// WHY THE NAME: the demo commands; ".ts" = a script, no screen code.

import { removeDemo, resetDemo, seedDemo } from "../lib/demo/seed";
import { flushLogs, log } from "../lib/logger";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: fine if the variables are set some other way.
}

// Reads the demo password, refusing a missing or very short one.
function demoPassword(): string {
  const value = process.env.DEMO_PASSWORD;
  if (!value || value.length < 8) {
    console.error("Set DEMO_PASSWORD (at least 8 characters) in .env.local first.");
    process.exit(2);
  }
  return value;
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === "seed") {
    const result = await seedDemo(demoPassword());
    log.info("demo_seeded", result);
    console.log(result.skipped ? "Demo data already exists. Nothing added (use demo:reset for a fresh copy)." : `Added ${result.shops} demo shops and ${result.appointments} appointments.`);
  } else if (command === "remove") {
    const result = await removeDemo();
    log.info("demo_removed", result);
    console.log(`Removed ${result.shops} demo shops and ${result.users} other demo accounts.`);
  } else if (command === "reset") {
    const result = await resetDemo(demoPassword());
    log.info("demo_reset", { shops: result.shops, appointments: result.appointments });
    console.log(`Reset: ${result.shops} demo shops and ${result.appointments} appointments.`);
  } else {
    console.error("Use: npm run demo:seed | demo:remove | demo:reset");
    process.exitCode = 2;
  }
  await flushLogs();
}

main().catch((error: unknown) => {
  log.error("demo_command_failed", { message: error instanceof Error ? error.message : "unknown" });
  console.error("The demo command failed. Nothing more was changed; run demo:remove to clean up any partial data.");
  void flushLogs().then(() => process.exit(1));
});
