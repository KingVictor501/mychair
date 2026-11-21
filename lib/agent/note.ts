// lib/agent/note.ts
// WHAT IT'S FOR: the shape of a weekly triage note and the checks it must pass before it is
// written. Claude hands the note to the write_triage_note tool as structured data; this file
//   1. checks it with zod (every section present, right types),
//   2. checks every finding against the real report (the field exists and the value matches,
//      so the agent can't quote a number that isn't there),
//   3. refuses anything that looks like an email, phone number or key,
//   4. turns it into the Markdown file saved in agent/runs/.
// WHO USES IT: scripts/agent-triage.ts. Tested by lib/agent/note.test.ts.
// WHY THE NAME: it's the agent's "note"; ".ts" = no screen code.

import { z } from "zod";
import { containsSensitive } from "../redact";
import type { WeeklyReport } from "../report";
import { HEALTH_FIELDS } from "../mcp/health-server";

// The three possible overall verdicts.
export const VERDICTS = ["healthy", "watch", "needs_attention"] as const;

// What Claude must send to write_triage_note. "value" is text so it can hold numbers, true/false
// and null alike; it must match the report exactly once turned into text.
export const triageNoteInput = z
  .object({
    verdict: z.enum(VERDICTS),
    summary: z.string().min(1).max(600),
    findings: z
      .array(
        z
          .object({
            field: z.string(),
            value: z.string(),
            rule: z.string().min(1).max(300),
            assessment: z.enum(["normal", "watch", "needs_attention"]),
            note: z.string().max(400),
          })
          .strict(),
      )
      .min(1)
      .max(30),
    compared_with_last_week: z.string().min(1).max(800),
    judgment_calls: z.array(z.string().min(1).max(500)).max(10),
    suggested: z
      .array(
        z
          .object({
            action: z.string().min(1).max(300),
            why: z.string().min(1).max(500),
            issue_title: z.string().max(120),
            issue_body: z.string().max(1500),
          })
          .strict(),
      )
      .max(5),
  })
  .strict();

export type TriageNote = z.infer<typeof triageNoteInput>;

// The JSON Schema Claude sees for write_triage_note. Kept in step with triageNoteInput above
// (a test checks the required fields match). "strict" tool use makes Claude follow it exactly.
export const triageNoteJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "summary", "findings", "compared_with_last_week", "judgment_calls", "suggested"],
  properties: {
    verdict: { type: "string", enum: [...VERDICTS] },
    summary: { type: "string", description: "One or two sentences on overall health." },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "value", "rule", "assessment", "note"],
        properties: {
          field: { type: "string", description: "A field name from the report, exactly as written." },
          value: { type: "string", description: "That field's value exactly as in the report, as text (e.g. \"2086\", \"true\", \"null\")." },
          rule: { type: "string", description: "The rule from agent/rules.md it was checked against." },
          assessment: { type: "string", enum: ["normal", "watch", "needs_attention"] },
          note: { type: "string", description: "Short explanation, or empty." },
        },
      },
    },
    compared_with_last_week: { type: "string", description: "What changed since the last note, or \"First run\"." },
    judgment_calls: { type: "array", items: { type: "string" }, description: "Each place you chose between two readings, and why." },
    suggested: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action", "why", "issue_title", "issue_body"],
        properties: {
          action: { type: "string" },
          why: { type: "string" },
          issue_title: { type: "string", description: "Draft GitHub issue title, or empty." },
          issue_body: { type: "string", description: "Draft GitHub issue body, or empty." },
        },
      },
    },
  },
} as const;

// The result of checking a note: either fine, or a list of plain-English problems that are
// sent back to Claude so it can fix them.
export type NoteCheck = { ok: true; note: TriageNote } | { ok: false; problems: string[] };

// Runs every check on what Claude sent. "report" is the real report from this run.
export function checkNote(input: unknown, report: WeeklyReport): NoteCheck {
  const parsed = triageNoteInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, problems: parsed.error.issues.map((i) => `${i.path.join(".") || "note"}: ${i.message}`) };
  }
  const note = parsed.data;
  const problems: string[] = [];
  const allowed = new Set<string>(HEALTH_FIELDS);

  for (const finding of note.findings) {
    if (!allowed.has(finding.field)) {
      problems.push(`findings: "${finding.field}" is not a field in the report`);
      continue;
    }
    const actual = String(report[finding.field as keyof WeeklyReport]);
    if (finding.value !== actual) {
      problems.push(`findings: ${finding.field} is ${actual} in the report, not ${finding.value}`);
    }
  }

  // Every piece of text in the note, checked for private-looking content.
  const allText = JSON.stringify(note);
  if (containsSensitive(allText)) {
    problems.push("the note contains something that looks like an email, phone number, token or key; remove it");
  }

  return problems.length === 0 ? { ok: true, note } : { ok: false, problems };
}

// Human-readable verdict for the top of the note.
const VERDICT_LABEL: Record<TriageNote["verdict"], string> = {
  healthy: "Healthy",
  watch: "Watch",
  needs_attention: "Needs attention",
};

// Turns a checked note into the Markdown file. "changes" is the list of files this run writes,
// filled in by the program (not by Claude), so it can't be wrong.
export function renderNote(
  note: TriageNote,
  meta: { date: string; runId: string; reportGeneratedAt: string; mcpRequestId: string | null; changes: string[] },
): string {
  const lines: string[] = [];
  lines.push(`# Health triage: ${meta.date}`, "");
  lines.push(
    `Run \`${meta.runId}\` · report generated ${meta.reportGeneratedAt}` +
      (meta.mcpRequestId ? ` · MCP request \`${meta.mcpRequestId}\`` : ""),
    "",
  );
  lines.push("## Summary", "", `**${VERDICT_LABEL[note.verdict]}.** ${note.summary}`, "");

  lines.push("## Findings", "", "| Field | Value | Rule | Assessment | Note |", "|---|---|---|---|---|");
  for (const f of note.findings) {
    lines.push(`| \`${f.field}\` | ${cell(f.value)} | ${cell(f.rule)} | ${f.assessment.replace("_", " ")} | ${cell(f.note)} |`);
  }
  lines.push("");

  lines.push("## Compared with last week", "", note.compared_with_last_week, "");

  lines.push("## Judgment calls", "");
  if (note.judgment_calls.length === 0) lines.push("None.");
  else for (const call of note.judgment_calls) lines.push(`- ${call}`);
  lines.push("");

  lines.push("## Suggested", "");
  if (note.suggested.length === 0) lines.push("None.");
  for (const s of note.suggested) {
    lines.push(`- **${s.action}** ${s.why}`);
    if (s.issue_title) {
      lines.push(`  - Draft issue: **${s.issue_title}**`);
      if (s.issue_body) lines.push(`    > ${s.issue_body.replace(/\n/g, "\n    > ")}`);
    }
  }
  lines.push("");

  lines.push("## Changes made", "");
  for (const c of meta.changes) lines.push(`- ${c}`);
  lines.push("");
  return lines.join("\n");
}

// Makes text safe inside a Markdown table cell (no pipes or line breaks).
function cell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}
