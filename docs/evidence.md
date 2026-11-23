# Evidence

Where to find the proof for each part of MyChair. Everything here ran against the live app at https://mychair-eta.vercel.app unless it says otherwise.

| Area | Document | What it shows |
|---|---|---|
| AI answers | [Eval report](eval-baseline-report.md) · [Re-run](eval-rerun-v2.md) · [Injection test](injection-evidence.md) | Golden-set scores against a pass line set in advance; a planted injection blocked |
| AI answer checks | [Observability: checking the AI's answers](observability.md#checking-the-ais-answers-before-theyre-shown) | Answers withheld unless every citation matches a retrieved passage |
| Automation | [Automation run log](automation-run-log.md) | A scheduled Make run, its router results and the matching production log line |
| Agent | [Agent audit log](../agent/audit-log.md) · [Agent runs and testing](agent-runs.md) | Real runs with timestamps and what each read and wrote; the forced failure; what the dry runs found |
| Agent limits | [Agent design](agent-design.md) · [Rules](../agent/rules.md) | The three tiers, the autonomy rungs, the permission-scoped connection |
| Own MCP server | [Live MCP verification](mcp-live-evidence.md) · [Design](mcp-remote-design.md) | No key / wrong key refused (401), right key lists exactly one tool, production log screenshot |
| Logs and metrics | [Observability](observability.md) · `/metrics` on the live app (admin key) | Structured logs, requests / errors / latency over time |
| Rollback | [Rollback drill](observability.md#rollback-drill-2026-11-21) | A bad deploy, Instant Rollback, the fix promoted, with times, commits, request IDs and screenshots |
| Architecture | [Decision document](decision-document.md) | Tradeoffs written before the code, the road not taken, lessons from my previous project |
| Self-taught | [Login sessions with `jose`](self-taught.md) | Why I chose it, how I learned it, how it's set up, and how I checked it works in the live app |
| Value | [Value memo](value-memo.md) | Course 2 vs. this build on time, friction and quality, with confounds named |
