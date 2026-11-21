// lib/agent/files.ts
// WHAT IT'S FOR: the only file access the triage agent has.
//   - notePath: picks the dated file name for a new note and refuses any path outside
//     agent/runs/ (the "path guard").
//   - latestNote: reads the newest earlier note, to compare against.
//   - auditRow / appendAuditRow: one row per run in agent/audit-log.md.
// WHO USES IT: scripts/agent-triage.ts. Tested by lib/agent/files.test.ts.
// WHY THE NAME: the agent's file helpers; ".ts" = no screen code.

import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

// Only names like 2026-11-21.md or 2026-11-21-2.md are allowed.
const NOTE_NAME = /^\d{4}-\d{2}-\d{2}(-\d{1,2})?\.md$/;

// Returns the full path for today's note inside runsDir. If a note for that date already exists,
// adds -2, -3... so an earlier note is never overwritten. Throws if the result would land
// anywhere other than directly inside runsDir.
export function notePath(runsDir: string, date: string): string {
  let name = `${date}.md`;
  for (let n = 2; existsSync(join(runsDir, name)); n++) name = `${date}-${n}.md`;
  return guardNotePath(runsDir, name);
}

// The path guard on its own: the name must match the pattern and resolve directly inside runsDir.
export function guardNotePath(runsDir: string, name: string): string {
  if (!NOTE_NAME.test(name)) throw new Error("refused: not a dated note file name");
  const base = resolve(runsDir);
  const full = resolve(base, name);
  const rel = relative(base, full);
  if (rel.startsWith("..") || rel.includes(sep)) throw new Error("refused: path is outside agent/runs");
  return full;
}

// The newest earlier note (by file name, which sorts by date), or null if there are none.
export function latestNote(runsDir: string): { name: string; text: string } | null {
  if (!existsSync(runsDir)) return null;
  const names = readdirSync(runsDir).filter((n) => NOTE_NAME.test(n)).sort(compareNoteNames);
  const newest = names.at(-1);
  return newest ? { name: newest, text: readFileSync(join(runsDir, newest), "utf8") } : null;
}

// Sorts 2026-11-21.md before 2026-11-21-2.md before 2026-11-21-10.md.
function compareNoteNames(a: string, b: string): number {
  const key = (n: string) => {
    const m = /^(\d{4}-\d{2}-\d{2})(?:-(\d+))?\.md$/.exec(n);
    return [m?.[1] ?? "", Number(m?.[2] ?? 1)] as const;
  };
  const [da, na] = key(a);
  const [db, nb] = key(b);
  return da === db ? na - nb : da < db ? -1 : 1;
}

// One audit-log row. Everything is plain facts: no report numbers, no secrets.
export type AuditEntry = {
  when: string; // ISO time, UTC
  runId: string;
  outcome: "ok" | "dry" | "failed";
  read: string; // e.g. "get_weekly_health (MCP r_92f49303); agent/runs/2026-11-14.md"
  wrote: string; // e.g. "agent/runs/2026-11-21.md" or "nothing"
  suggested: string; // e.g. "2 suggestions" or "none", or the failure reason
};

// Turns an entry into a Markdown table row (pipes and line breaks removed).
export function auditRow(e: AuditEntry): string {
  const c = (t: string) => t.replace(/\|/g, "/").replace(/\r?\n/g, " ");
  return `| ${c(e.when)} | \`${c(e.runId)}\` | ${c(e.outcome)} | ${c(e.read)} | ${c(e.wrote)} | ${c(e.suggested)} |`;
}

// Adds one row to the audit log file (the header row is already in the file).
export function appendAuditRow(auditFile: string, e: AuditEntry): void {
  appendFileSync(auditFile, `${auditRow(e)}\n`, "utf8");
}
