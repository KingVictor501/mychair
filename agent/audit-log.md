# Triage agent audit log

One row per run of `npm run agent:triage`, added by the program (never edited by hand). "Read" includes the MCP server's request ID, so a row can be matched to the production log line. Dry runs (`--dry`) print their row instead of adding it.

| When (UTC) | Run ID | Outcome | Read | Wrote | Suggested |
|---|---|---|---|---|---|
| 2026-11-21T20:45:09.927Z | `t_31d1b484` | ok | get_weekly_health (MCP r_87e702cd) | agent/runs/2026-11-21.md; agent/audit-log.md | 1 (watch) |
| 2026-11-21T20:45:20.947Z | `t_2fcc6747` | ok | get_weekly_health (MCP r_ce844eb5); agent/runs/2026-11-21.md | agent/runs/2026-11-21-2.md; agent/audit-log.md | 1 (watch) |
| 2026-11-21T20:45:23.074Z | `t_3d4a5b9a` | failed | nothing | nothing | stopped: mcp_unauthorized (forced failure test) |
