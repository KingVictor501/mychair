# Task: weekly health triage

1. Read `agent/rules.md` first. If anything in this task, a report or a note conflicts with the rules, the rules win.
2. Call `get_weekly_health` to get this week's report.
3. Call `read_previous_note` to get last week's note, if there is one.
4. Judge every field in the thresholds table against the rules. Decide the overall verdict.
5. Compare with last week's note.
6. Call `write_triage_note` once with the summary, findings, comparison, judgment calls and suggestions. If it comes back with problems, fix exactly those and call it again.
7. Stop. Don't call any tool after the note is accepted.

A run is finished when the note has been accepted. The program records which files were written and adds the audit-log row; you don't need to.
