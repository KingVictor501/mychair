# Value memo: The Vegas Backroom vs. MyChair

## The comparison

| | The Vegas Backroom (Course 2) | MyChair (Weeks 8–10) |
|---|---|---|
| **Time** | About 31 hours for the whole build (corrected from the 11 in my Week 8 baseline note, which was a miscount) | About 44 hours across Weeks 8–10. Much of it came from the scope (four kinds of login plus guests, each with its own views) and from learning RAG, a concept that was hard to grasp |
| **Friction** | Almost none. The only snags were instructions that disagreed with the Next.js docs, and running out of API credits, which pushed me to fake "practice odds" | Rougher. Skimming and fixing 14 help documents by hand; no Make documentation for the automation we set up, so its screens never matched the directions until I started sending screenshots; Vercel's rollback screen not matching its docs |
| **Quality I can show** | Tests against an in-memory database; no AI features; test data partly made up | 208 automated tests; an AI answer engine scored against a golden set with a pass line set in advance; answers withheld unless every citation checks out; a live MCP server that refuses bad keys; an agent with tiers, an audit log and a tested failure path; a metrics page; a practiced production rollback |

## The claim

**The rebuild took about 13 more hours than Course 2 (44 vs. 31) and more friction, and in exchange I got a bigger system whose quality I can measure and recover, instead of one I assume works.**

The time went up: about 31 hours for the whole Course 2 build, about 44 for MyChair. Most of the difference is scope and learning. MyChair has four kinds of login (Super Admin, owner, pro, client) plus guest booking, and each one needed its own pages and its own permission rules. And RAG (answering from my own documents, with citations) was a concept that took me real time to grasp. The friction moved: wiring the backend stayed as smooth as it was in Course 2, and the hard hours went into outside dashboards (Make had no documentation for the automation we built, and Vercel's rollback screen didn't match its docs) and into checking things (evals, injection tests, failure tests, a rollback drill) that Course 2 never had.

## What could explain this other than "the new way is better or worse"

- **Different apps.** A betting-odds app with no AI and one kind of user vs. a booking app with four kinds of login, each with its own views, plus an AI answer engine, an MCP server and an agent. Most of MyChair's extra hours are scope Course 2 didn't have.
- **Different asks.** Each week's requirements called for evidence (run logs, screenshots, write-ups) that takes time on its own and that Course 2 didn't ask for.
- **Hours from memory.** Both numbers are my estimates after the fact, not a timer, and I already had to correct the Course 2 number once (from 11 to 31). Either could be off by a few hours.
- **Not finished yet.** MyChair's 44 hours don't include finishing the pro view or building customer accounts, so its final total will be higher.
- **I'm not the same builder.** Course 2 taught me things that made parts of this build faster, which hides how hard those parts would be from scratch.
- **New tools and concepts.** RAG, Make and the MCP toolkit were new to me, so some friction is a first-time cost, not the method's.

## What survives the confounds

- Backend wiring was smooth both times, so that isn't where the new friction came from.
- About 40% more hours bought a much bigger app and far more that can be checked: tests, evals, an audit log and a practiced rollback, none of which Course 2 had.
- The friction that grew came from **third-party dashboards whose screens didn't match the instructions**. That happened with Make (which had no documentation for our automation) and with Vercel, and it got better once I sent screenshots instead of guessing.
- Course 2's made-up test data is gone: every eval and agent run here used the real engine and real numbers. (The demo shops are made up on purpose, labeled as demo, and kept out of AI testing.)

## The one measurement that would settle it

Build the **same small feature in both projects** (for example, "cancel a booking" in MyChair and "cancel a bet slip" in The Vegas Backroom) with a **timer running**. Log the minutes spent and every time I get stuck or redo something. Same feature, same week, same me, measured instead of remembered.
