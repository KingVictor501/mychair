# Triage agent: runs and testing

Results of building and running the weekly health-triage agent (`docs/agent-design.md`) on 2026-11-21. Everything here was run with `npm run agent:triage` against the live MCP server at `https://mychair-eta.vercel.app/api/mcp`, except the made-up weeks, which used saved reports.

## Audit log of real runs

From `agent/audit-log.md`, as written by the program:

| When (UTC) | Run ID | Outcome | Read | Wrote | Suggested |
|---|---|---|---|---|---|
| 2026-11-21T20:45:09.927Z | `t_31d1b484` | ok | get_weekly_health (MCP r_87e702cd) | agent/runs/2026-11-21.md; agent/audit-log.md | 1 (watch) |
| 2026-11-21T20:45:20.947Z | `t_2fcc6747` | ok | get_weekly_health (MCP r_ce844eb5); agent/runs/2026-11-21.md | agent/runs/2026-11-21-2.md; agent/audit-log.md | 1 (watch) |
| 2026-11-21T20:45:23.074Z | `t_3d4a5b9a` | failed | nothing | nothing | stopped: mcp_unauthorized (forced failure test) |

- **Run 1** read the report (server request `r_87e702cd`), found no earlier note, and wrote `agent/runs/2026-11-21.md`. Verdict: watch, because `auth_failures` was 7 (watch band 1 to 9).
- **Run 2** read the report again (`r_ce844eb5`) and read run 1's note to compare. It wrote `agent/runs/2026-11-21-2.md` instead of overwriting run 1. Without being told to, it noticed the two reports were generated 11 seconds apart and wrote that this was "likely a re-run, not a new week."
- **Run 3** was the failure test (below). "Read: nothing" means no report came back: the server refused the key on the first call.

Both notes stayed inside the agent's limits. They suggest checking the logs for `admin_auth_failed` and `mcp_auth_failed`, include no draft issue for a watch-level item, and don't suggest rotating a key.

## Forced failure

```
$ AGENT_FORCE_FAILURE=bad_key npm run agent:triage
Triage stopped (mcp_unauthorized). No note was written and nothing in the app was changed. The health server refused the key. Check that MCP_API_KEY in .env.local matches the one in Vercel.
```

- The live server answered 401 to the wrong key. The run stopped at that call, so Claude never judged health without real numbers.
- No note was written (`agent/runs/` still has only the two real notes).
- The audit log got a `failed` row with the reason, `mcp_unauthorized (forced failure test)`.
- The command exited with code 1, so a scheduler would see it as failed.
- On the server side, the refused call is an `mcp_auth_failed` line, which the weekly report counts under `auth_failures`.

## Dry runs before the first real run, and what they found

`--dry` runs every step but writes nothing. It ran four times before the real runs: once against the live report, and once each against three made-up weeks in `agent/test-reports/` (healthy, empty, bad).

The notes were reasonable, but the agent's "Judgment calls" section showed four places where the rules were loose enough that it had to guess:

| What the dry run showed | Why it mattered | How the rules were tightened |
|---|---|---|
| `security_notes` was in the table with "(follows `security_status`)" in the Flag column. Both runs spent a judgment call working out what that meant, and rated it "watch" even in a week where `security_status` was `attention`. | One fact (the security notes) was being judged twice, at different levels, in the same note. | `security_notes` is now never its own finding. It is quoted in the `note` of the `security_status` finding. |
| In the empty week, `p95_ms` was `null` and the rules only had numeric thresholds. The agent wrote: "The rules only give thresholds for numbers, so I did not rate it." | It made a sensible choice, but by guessing. A different run could have treated `null` as 0 (normal) or as a failure. | A `null` value is now defined as "nothing to measure", not a finding, and is mentioned in the `status` finding's note. |
| For `cap_hits` the agent wrote: "The table doesn't say whether cap_hits might be a budget or rate cap." | It suggested "check whether the cap limit still fits normal use" without knowing which limit it was. | The rule now says what it counts: the public Ask page hitting `ASK_HOURLY_CAP`. |
| In the bad week, it suggested "consider rotating the admin key" for 23 auth failures. | `auth_failures` counts wrong keys at **both** locks (admin routes and the MCP server), so the report can't say which key is involved. Rotating the wrong key breaks the Make automation or the agent for nothing. | The rule now says the count covers both locks, and a suggestion must say to check `admin_auth_failed` and `mcp_auth_failed` first and not suggest rotating a key until the logs show which one. |

**After the change,** the same two made-up weeks were dry-run again:

- `security_notes` now appears only inside the `security_status` finding: "security_notes: auth_failures_high;injection_blocked_some".
- The empty week's `status` finding says: "requests is 0, so p50_ms and p95_ms are null. There was nothing to measure, so those nulls are not findings."
- `cap_hits` is described as "The Ask page hit its hourly question limit once."
- The bad week's suggestion became: "Check the logs for admin_auth_failed and mcp_auth_failed first to see which lock the 23 failures came from. Don't rotate any key until the logs show which one is affected." Under judgment calls it added: "The auth_failures suggestion does not recommend rotating a key, because the report can't say which lock the failures came from."

## Automated tests

`lib/agent/agent.test.ts` (part of `npm test`, no internet needed):

- a correct note passes; a finding quoting a value that isn't in the report is refused (`p95_ms is 2086 in the report, not 1500`); a finding about a field that doesn't exist is refused;
- a note containing an email address or phone number is refused; a missing section or an extra field (`run_sql`) is refused;
- the JSON schema Claude sees requires the same sections as the program's check;
- the path guard refuses `../escape.md`, `../../.env.local`, other folders and non-dated names; a second note on the same day becomes `-2` instead of overwriting;
- the MCP client reads the report and request ID, and turns 401, 503, other errors, network failures and non-report answers into the right stop reasons;
- stop messages say nothing was changed and contain no key.
