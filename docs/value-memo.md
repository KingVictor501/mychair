# Value memo: The Vegas Backroom vs. MyChair

## The comparison

| | The Vegas Backroom (Course 2) | MyChair (Weeks 8–10) |
|---|---|---|
| **Time** | About 11 hours for the whole build (my Week 8 baseline note) | Over 9 hours in Week 9 alone, and more than 12 hours in Week 10 |
| **Friction** | Almost none. The only snags were instructions that disagreed with the Next.js docs, and running out of API credits, which pushed me to fake "practice odds" | Rougher. Skimming and fixing 14 help documents by hand; Make's screens not matching the directions until I started sending screenshots; Vercel's rollback screen not matching its docs |
| **Quality I can show** | Tests against an in-memory database; no AI features; test data partly made up | 134 automated tests; an AI answer engine scored against a golden set with a pass line set in advance; answers withheld unless every citation checks out; a live MCP server that refuses bad keys; an agent with tiers, an audit log and a tested failure path; a metrics page; a practiced production rollback |

## The claim

**The rebuild took more time and more friction than Course 2, and in exchange I got a system whose quality I can measure and recover, instead of one I assume works.**

The time went up. My whole Course 2 build was about 11 hours; MyChair's last two weeks alone were over 21. The friction moved: wiring the backend stayed as smooth as it was in Course 2, and the hours went into outside dashboards (Make, Vercel) and into checking things (evals, injection tests, failure tests, a rollback drill) that Course 2 never had.

## What could explain this other than "the new way is better or worse"

- **Different apps.** A betting-odds app with no AI vs. a booking app with an AI answer engine, an MCP server and an agent. Most of MyChair's extra hours are features Course 2 didn't have.
- **Different asks.** Each week's requirements called for evidence (run logs, screenshots, write-ups) that takes time on its own and that Course 2 didn't ask for.
- **Hours from memory.** Both numbers are my estimates after the fact, not a timer. "About 11" and "over 9" could each be off by a few hours.
- **Unequal spans.** 11 hours is a whole build; 9 and 12+ are single weeks of a longer build.
- **I'm not the same builder.** Course 2 taught me things that made parts of this build faster, which hides how hard those parts would be from scratch.
- **New tools.** Make and the MCP toolkit were new to me, so some friction is a first-time cost, not the method's.

## What survives the confounds

- Backend wiring was smooth both times, so that isn't where the new friction came from.
- The friction that grew came from **third-party dashboards whose screens didn't match the instructions**. That happened with Make and with Vercel, and it got better once I sent screenshots instead of guessing.
- Course 2's made-up test data is gone: every eval and agent run here used the real engine and real numbers.

## The one measurement that would settle it

Build the **same small feature in both projects** (for example, "cancel a booking" in MyChair and "cancel a bet slip" in The Vegas Backroom) with a **timer running**. Log the minutes spent and every time I get stuck or redo something. Same feature, same week, same me, measured instead of remembered.
