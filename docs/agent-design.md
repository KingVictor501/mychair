# Weekly health-triage agent

MyChair has two pieces that watch the app's health:

- **The weekly report automation:** a Make scenario that reads the health report on a schedule and adds a row to a Google Sheet (`docs/automation-run-log.md`). It follows fixed rules and makes no judgment calls.
- **The triage agent (this document):** a program that uses Claude to read the same numbers, decide what matters this week compared with last week, and write a short triage note. Anything bigger than writing that note, it suggests to me instead of doing.

The automation copies numbers. The agent tells me what they mean and what I should do about them.

## What a run does

Run with `npm run agent:triage`. Each run:

1. Loads `agent/rules.md` (what it may and may not do) and `agent/task.md` (the steps). The first step of the task is to read the rules.
2. Calls `get_weekly_health` on the live MCP server (`/api/mcp`) using `MCP_API_KEY`. This is the agent's only way into the app (see "Access: a permission-scoped connection").
3. Reads the most recent note in `agent/runs/`, if there is one, to compare against.
4. Decides which numbers need attention and which are normal, using the thresholds in the rules file.
5. Writes this week's note to `agent/runs/<date>.md` (see "When a run is finished").
6. If something needs me, it writes a suggested GitHub issue (title and body) inside the note. It can't file it.
7. Adds one row to `agent/audit-log.md` and logs `agent_run` through the app's logger.

## What the agent may do

| | Actions | How the code holds it to that |
|---|---|---|
| **Does on its own** | Call `get_weekly_health`. Read earlier notes in `agent/runs/`. Write a new note in `agent/runs/`. Add an audit-log row. | These are the only tools Claude gets. The file tool only writes a dated file inside `agent/runs/` and refuses any other path. |
| **Suggests, I decide** | Open a GitHub issue. Fix something, change a setting, rotate a key, turn the Make schedule back on. | Written as text under "Suggested" in the note. The agent has no GitHub token and no tool that changes anything outside `agent/runs/`, so suggesting is all it can do. |
| **Never** | Change environment variables or keys. Delete or edit logs, or change log retention. Run SQL or touch the database directly. Read client, appointment or style-card data. Push code or deploy. Send email or messages. | No tool exists for any of these, and its only app key opens one read-only tool. The rules file lists each one with the reason, so the model also refuses if a report or an old note tries to talk it into one. |

### Why each "never" is there

These come from real incidents, so the reasons are concrete:

| Never | Why |
|---|---|
| Run SQL, delete data, or touch the database directly | In July 2025, Replit's AI coding agent deleted a company's production database during a declared code freeze, then gave misleading answers about what it had done. |
| Change, print or commit keys | In 2016, attackers found cloud credentials in Uber's private GitHub repository and used them to download data on 57 million people. |
| Write or repeat personal data in notes or logs | In May 2018, a bug at Twitter wrote users' passwords unmasked into an internal log, and Twitter asked all 330 million users to change their passwords. |
| Read client records | MyChair's own rule is that one pro never sees another pro's clients. An agent with access to all client data would break that rule for everyone at once. |
| Push code or deploy | A bad deploy takes the app down for real clients. Deploys stay with me, because I can roll them back. |

## Autonomy: which rung each action sits on

I use a five-rung autonomy ladder, from no freedom to full freedom:

| Rung | Meaning |
|---|---|
| 0 | Never. No tool exists. |
| 1 | Suggest. The agent writes it down and I do it. |
| 2 | Ask first. The agent does it after I say yes. |
| 3 | Do it, then report. The agent does it and leaves a record I can check. |
| 4 | Do it silently. No record. |

For each action, here's the rung I picked and why I didn't go one rung up or one rung down:

| Action | Rung | Why not one rung up | Why not one rung down |
|---|---|---|---|
| Read the health report | **3** | Silent (4) would hide when the agent looked. Every call is logged on the server (`mcp_tool_called`) and in the audit log. | Asking first (2) adds a click for a read-only call that returns counts with no personal data. It wouldn't protect anything. |
| Write the triage note | **3** | Silent (4) defeats the purpose. The note and the audit log are how I check the agent's judgment. | Asking first (2): the note is a new file in its own folder, tracked in git, and harmless if wrong. Approving it every week would teach me to click "yes" without reading. |
| Open a GitHub issue | **1** | Asking first (2) means giving it a GitHub token with write access, which is a bigger key to leak, and a wrong call becomes a public issue. A false alarm every week would teach me to ignore them. | Not suggesting at all (0) loses the main reason to have the agent: telling me what needs doing. |
| Change settings, rotate keys, turn Make back on | **1** | Asking first (2) gives the agent tools that can break the live app or the automation. A wrong change hurts real users; a missed suggestion only costs a week. | Not suggesting (0) hides useful advice. A written suggestion costs nothing. |
| Database, logs, client data, deploys, messages | **0** | Even suggesting "delete the logs" or "read the client records" means something has misled the agent, so the rules forbid it outright. | Already the lowest. |

## Access: a permission-scoped connection

The agent holds two keys, each scoped to one job:

- `MCP_API_KEY` opens one read-only tool on the live server. It can't reach the admin routes, the database or any client data (`docs/mcp-remote-design.md`).
- `ANTHROPIC_API_KEY` lets the agent ask Claude to reason. Claude only sees the report numbers and last week's note.

It has no production database connection, no GitHub token and no Vercel token.

## When a run is finished

The program checks the note with a `zod` schema before writing anything. A run is finished only when:

- `agent/runs/<YYYY-MM-DD>.md` exists with these sections:
  - **Summary:** one or two sentences, ending in healthy, watch, or needs attention.
  - **Findings:** each finding names the report field, its value (for example `p95_ms: 2086`) and the rule it was checked against.
  - **Compared with last week:** what changed, or "First run".
  - **Judgment calls:** each place the agent had to choose between two readings, and why it chose the one it did.
  - **Suggested:** each action for me, with a draft issue where useful, or "None".
  - **Changes made:** every file this run wrote. Normally just the note and the audit-log row.
- One row has been added to `agent/audit-log.md`.
- Nothing in the note looks like an email address, phone number or key (the same patterns the logger redacts).

If the check fails, the note isn't written. The run adds a `failed` row to the audit log and says why.

## Audit log

`agent/audit-log.md` gets one row per run, newest at the bottom:

| When (UTC) | Run ID | Outcome | Read | Wrote | Suggested |
|---|---|---|---|---|---|

"Read" includes the server's request ID for the MCP call, so each row can be matched to the production log. Failed runs get a row too.

## When something goes wrong

If the MCP server refuses the key, is down or times out, or Claude can't be reached, the agent:

- stops before asking Claude anything, so it never guesses about health without data,
- writes no note,
- adds a `failed` row to the audit log with the reason (for example `mcp_unauthorized`) and "no changes made",
- prints one line saying what failed, that nothing was changed, and what to check next.

For a forced failure, `AGENT_FORCE_FAILURE=bad_key` sends a wrong key on purpose, so this path can be tested against the live server whenever I want.

## Testing before the first real run

`npm run agent:triage -- --dry` runs every step but writes nothing, printing the note it would have written. I run it against the real report and against made-up ones (a healthy week, an empty week, a week with security attention) to find places where the rules are worded loosely enough for the model to get it wrong. Anything found, and how the rules were changed, goes in `docs/agent-runs.md`.

## Files

| File | What it is |
|---|---|
| `agent/rules.md` | What the agent may do, may suggest and must never do, with reasons, plus the thresholds. |
| `agent/task.md` | The steps of a run, starting with "Read `agent/rules.md` first." |
| `agent/runs/` | One triage note per run. |
| `agent/audit-log.md` | One row per run. |
| `scripts/agent-triage.ts` | The program: loads the files, calls the MCP server, asks Claude, checks the note, writes it. |
| `lib/agent/*.ts` and tests | The parts that can be tested offline: the path guard, the note check, the audit row and the failure messages. |
| `docs/agent-runs.md` | Real runs, the failure test and what the dry runs turned up. |
