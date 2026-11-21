# MyChair – Decision Document

**Scope for this build:** three shops (a barbershop, a nail salon and a lash studio), each with one owner and three pros, filled with demo data so every role works end to end. (The first version of this document said barbers only, one shop; see "Changes since the first version".) Other business types (hair salon), more shops and shop discovery are future enhancements (see the end of this file). The data model keeps a `shop_id` on every record so adding shops later is not a rewrite. **Designed for later:** one client account can belong to many shops (for example a nail shop and a hair salon) and switch between them on the same page, with each shop keeping its own record of the client.

**When this was written:** the six decisions and their tradeoffs below are the first commit in the repository (`6d15812`, 2026-11-08), made before the skeleton app existed (`56b5ef1`, the same day). The reasoning came first and the code followed. The sections "What I took from my Course 2 build" and "Changes since the first version" were added later and say so.

## The six graded decisions (hardest to change first)

| #   | Decision          | Choice                                | Tradeoff                                                                                                                                                                                       |
| --- | ----------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Data shape        | Relational                            | Every appointment links a shop, pro, client, and service, so I have to design the tables up front, and changing them later means migrations instead of just adding a field.                    |
| 2   | Database          | PostgreSQL + pgvector, hosted on Neon | pgvector is less specialized than a dedicated vector database and would get slower at a very large scale. Neon's free tier sleeps when idle, so the first request after a quiet spell is slow. |
| 3   | Backend language  | TypeScript on Node                    | I have to write types for everything, which is slower at first, and errors can point at compiled code instead of what I wrote.                                                                 |
| 4   | Backend framework | Next.js (App Router) route handlers   | The API lives inside the website project, so the future mobile app depends on my web deployment. The App Router changes quickly and is easy to confuse with the old Pages Router.              |
| 5   | Frontend          | React (through Next.js)               | It ships a lot of JavaScript to phones, and the server vs. `"use client"` split is confusing for a beginner.                                                                                   |
| 6   | Hosting           | Vercel                                | Functions are short-lived and can start cold, so no long background jobs. I'm also tied to Vercel's dashboard, and the free tier is for non-commercial use.                                    |

### Why this and not the alternative

1. **Relational, not document (MongoDB):** everything links to everything, and the database itself can refuse an appointment with no real pro, client, or shop.
2. **Postgres + pgvector, not Postgres + a separate vector service (Pinecone):** services and their embeddings live in one place, so one database to run and secure. At a few dozen services, pgvector is plenty. Neon, not Supabase, because I want a plain database and not a bundle I'd have to learn around.
3. **TypeScript, not Python:** one language for server and browser, and the project rules require it.
4. **Next.js, not a separate Express/Hono server:** one project and one deploy this week. The mobile app can call the same REST routes later.
5. **React, not Vue/Svelte:** Next.js is built on it, and it's what I know.
6. **Vercel, not Render/Fly/a VPS:** fastest path to a public HTTPS URL. A VPS gives control I don't need and maintenance I don't want.

### One road not taken, priced out

**MongoDB, the database I used in Course 2.** In The Vegas Backroom, my own decisions document wrote down its cost: "fewer built-in links between records than a SQL database, so the code has to check ownership itself." That was manageable for one kind of record (a user's bet slips). MyChair has shops, pros, clients, services, appointments and style cards that all point at each other, and one rule that must never break: one pro never sees another pro's clients. Taking the MongoDB road again would have meant every one of those links and ownership checks living only in my code, with nothing in the database to refuse an appointment for a pro or client that doesn't exist. I would also have needed a second service for the embeddings, because search by meaning needs a vector store. Postgres with pgvector gives me both in one database, and the cost I accepted is the one in row 1: tables designed up front and migrations for every change.

## What I took from my Course 2 build (The Vegas Backroom)

The Vegas Backroom (https://github.com/KingVictor501/backroom-vegas) was an NFL and NBA odds, news and bet slip app built in about 11 hours (my Week 8 baseline note). This is what I kept, what I changed, and why, read from that repo and from my baseline note.

| Course 2 choice | MyChair | Kept or changed | Why |
| --------------- | ------- | --------------- | --- |
| Next.js App Router, TypeScript, Vercel | Same | Kept | It worked, it is what I know, and it gave one project and one deploy. My baseline note had no friction with it except where the rubric disagreed with the Next.js docs. |
| MongoDB Atlas with Mongoose | PostgreSQL with pgvector on Neon, through Drizzle | Changed | Relational data and the vectors for search in one database (see "One road not taken" above). |
| Tailwind CSS | Tailwind CSS v4, with the shared colors defined once in `app/globals.css` | Kept (after a detour) | My build instructions for the skeleton said "no extra packages", so the first pages used plain CSS. Before building the real frontend I removed that rule and went back to Tailwind: it is what the Next.js docs recommend for most styling, and it is what I used in Course 2. |
| Vitest | Node's built-in test runner through `tsx` | Changed | My build instructions for the skeleton said "no extra packages", so tests use the runner built into Node. The suite (103 tests) already runs on it, so switching now would cost more than it saves. The cost is no ready-made mocks or helpers. |
| `zod` checks on every write and every outside answer | `zod` on the public Ask route and the MCP tools | Kept | One rulebook for what input is allowed, checked on the server. |
| Separate live and test databases | Neon `production` and `development` branches | Kept | Testing never touches real data. |
| `jose` signed token in an httpOnly cookie, `bcryptjs` hashes | The same plan for MyChair logins (not built yet) | Kept (planned) | A script on the page can't read the cookie, and the database never holds a password. |
| Outside API credits ran out, so testing used made-up "practice odds" | Real AI calls on every eval and test, with brakes: a $15 spend limit, an hourly cap on the public Ask page, and a short golden set | **Refused to repeat** | In Course 2, the numbers I tested against were invented, so a passing test proved less. This time the eval runs on the real engine and the brakes protect the budget instead of fake data. |
| Rubric and Next.js docs disagreed, and I had to sort it out mid-build | A rule in my build instructions: check the current official docs before writing code, and name the pages checked | **Refused to repeat** | Out-of-date instructions cost me time once. Checking the docs first is cheaper than finding the mismatch later. |

## Supporting choices

Status says whether it is built and running today or planned for a later section.

| Item | Choice | Status | One-line tradeoff |
| ---- | ------ | ------ | ----------------- |
| ORM / DB tool | Drizzle (`drizzle-orm`, `drizzle-kit`) with the Neon HTTP driver | In use | Supports pgvector and reads like SQL, but has a smaller community than Prisma, and I am on release-candidate versions. |
| Embedding model | OpenAI `text-embedding-3-small`, called with plain `fetch` | In use | A second vendor, and the text of my documents leaves my system to be embedded. Very cheap. |
| Answer model | Claude Sonnet 5.5 (`claude-sonnet-5-5`), called with plain `fetch`, key in `ANTHROPIC_API_KEY` | In use | A third vendor and a per-answer cost. I can't confirm a temperature setting, so wording changes between runs. |
| Corpus format | Markdown files in `mychair-corpus/`, cut at headings into chunks of at most 1,200 characters | In use | Retrieval quality depends on how I write headings and sections. |
| MCP server (own) | `@modelcontextprotocol/server` (v2) over stdio, run with `tsx`, three read-only tools | Built (local only) | The toolkit is new and changes quickly, and a stdio server only runs on my own computer, not on Vercel. |
| MCP server (own, live) | `@modelcontextprotocol/server` (v2) `createMcpHandler` in a Next.js route at `/api/mcp`, one read-only tool (`get_weekly_health`), locked with its own `MCP_API_KEY` (design: `docs/mcp-remote-design.md`) | Built | A fixed key instead of a full login (OAuth), so any client holding the key has the same access, and some AI apps can't connect without OAuth. |
| MCP server (scoped demo) | The official filesystem server, pinned to `2.3.0`, `--read-only`, limited to `mychair-corpus/` in `.mcp.json` | In use | Someone else's code, so I pin the version and limit it to one folder instead of trusting it everywhere. |
| Input validation | `zod` | In use for the MCP tools and `/api/ask` | One more package to learn, but one rulebook for what input is allowed. |
| Injection defense | Own pattern screen (`lib/injection.ts`) before the model, plus a prompt rule that excerpts are data | In use | Patterns catch obvious attacks only; a cleverly worded one can slip past, so the prompt rule stays as the backstop. |
| Public Ask limits | Length limit with `zod`, a global hourly cap counted from `log_entries`, and a $15 spend limit in the Anthropic Console | In use | The cap is shared by everyone (no per-visitor limit, because I don't log IP addresses), so one heavy user can use it up. |
| Weekly health report automation | Make (Schedule, HTTP, Router) writing to Google Sheets, reading `GET /api/admin/weekly-report` with an admin key | Built, switched off after a clean scheduled run | Two more outside services and their dashboards, and the admin key is stored in Make. |
| Logging | Own small logger to stdout/stderr and a `log_entries` table, 14-day retention | In use | I maintain it myself and the Vercel free log stream keeps only 1 hour, so the table is the real record. |
| Styling | Tailwind CSS v4 through its PostCSS plugin (`postcss.config.mjs`), colors as `@theme` tokens in `app/globals.css` | In use | Long class lists in the page code, and its reset changed the look of pages built before it, so they needed a few base rules. |
| Demo data and demo mode | Three demo shops kept in the database, marked as demo; a Super Admin "Demo mode" switch opens a public `/demo` page with no-login owner and pro views, plus a "Reset demo" button; seed and remove scripts for development | Planned | Demo sessions with no password are a door into the app, so every permission check must also box them into demo shops, and one missed check would let a visitor near real data. Removing it relies on every demo record being linked to a marked shop or user. |
| Tests | Node's built-in test runner through `tsx` (`npm test`) | In use | No test helpers or mocks included, so I write small ones. |
| Auth | Own simple auth: hashed passwords + signed token (`jose`) in an httpOnly cookie | Planned | I own the security details, but the same token works for the mobile app later. |
| File storage | Vercel Blob | Planned | Simple, same dashboard, more Vercel lock-in. |
| Charts | Recharts | Planned | Easy line graphs; adds weight to the dashboard page. |
| Rate-limit storage | Upstash Redis for logins and booking | Planned | One more service and key, but memory doesn't work across serverless servers. (The Ask page's cap already avoids it by counting rows in `log_entries`.) |
| Shop separation | Checks in one shared permission helper (not row-level security) | Planned | If I forget the helper on one route, data leaks. |

## My answers to the open questions

| Question                | Answer                                                                                                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App name                | MyChair                                                                                                                                                                                         |
| Branding                | No custom branding now, but built so it can be added. Minimalist palette (white and gray) defined once as design tokens (shared color variables), so a logo and colors can be swapped in later. |
| Style cards across pros | Each pro keeps their own style card for a client. A pro can see another pro's card only if the owner or Super Admin grants permission.                                                          |
| Finding a shop          | Not built. Future enhancement. When built, a client can have many shops and switch between them.                                                                                                |
| Pros joining            | Invite link sent by the owner or Super Admin.                                                                                                                                                   |
| Time zone               | Each shop has its own. With one shop for now, it is one setting stored on the shop. Times are stored in UTC and shown in the shop's zone.                                                       |
| Booking window          | Default 5 days ahead. A pro can extend it (for example, high-volume pros).                                                                                                                      |
| Cancellation window     | 2 hours before the start. A shop owner can change it.                                                                                                                                           |
| No-show strikes         | Counted per shop. They never block booking. A pro sees their own clients' counts, and the pro reserved for an appointment can remove a strike. The owner and Super Admin see everything.        |
| Help documents          | 14 Markdown documents in `mychair-corpus/`, six of them linked from the footer (see `docs/corpus-plan.md`). Support contact is admin@mychair.com.                                                |

## Changes since the first version

| Date | Change | Why |
| ---- | ------ | --- |
| 2026-11-08 | Added the corpus table, the embedding model and search by meaning | Semantic search, the last graded Week 8 item. |
| 2026-11-09 | Added the answer model (Claude), first over a sample corpus | The grounded Ask feature needed a model to write cited answers. |
| 2026-11-12 | Replaced the sample corpus with the 14 MyChair documents, and added my own MCP server (stdio, three read-only tools) | Answers should come from MyChair's own help documents; course work on MCP, local only for now. |
| 2026-11-13 | Added the eval harness, the injection screen, the public Ask limits, the scoped filesystem MCP server and the weekly report endpoint | Week 9 capstone: eval gate, planted injection, MCP demo, and opening `/ask` to the public safely. |
| 2026-11-16 | Ran the Make automation on a schedule and recorded the run | Week 9 capstone: a real trigger, process and action flow with a run log. |
| 2026-11-20 | Added the Course 2 read and the priced-out road not taken | Week 10 capstone: the decision document must show what I kept and refused to repeat from Course 2. |
| 2026-11-20 | Widened the scope from one barbershop to three shops (barbershop, nail salon, lash studio), each with one owner and three pros, on demo data | The owner, pro, client and Super Admin views need real-looking shops to work end to end, and more than one shop proves one shop never sees another's data. |
| 2026-11-20 | Switched styling from plain CSS to Tailwind CSS v4 | The "no extra packages" rule was for the skeleton only. The frontend is next, and Tailwind is the Next.js docs' recommendation. |

## Future enhancements (parked)

- Clients with many shops, a shop switcher, and a "find a shop" feature
- An embedded Google Map for each shop, showing its location, hours and reviews (instead of storing shop hours myself)
- A hair salon type, and one-click setup by business type
- White-label logo and colors per shop or pro
- Mobile apps (iOS/Android) using the same REST API
- Real payments, and text/email reminders
