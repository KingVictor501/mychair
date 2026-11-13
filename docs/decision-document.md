# MyChair – Decision Document

**Scope for this build:** barbers only, one shop. Other business types (salon, nail, lash) and shop discovery are future enhancements (see the end of this file). The data model keeps a `shop_id` on every record so adding shops later is not a rewrite. **Designed for later:** one client account can belong to many shops (for example a nail shop and a hair salon) and switch between them on the same page, with each shop keeping its own record of the client.

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

## Supporting choices

Status says whether it is built and running today or planned for a later section.

| Item | Choice | Status | One-line tradeoff |
| ---- | ------ | ------ | ----------------- |
| ORM / DB tool | Drizzle (`drizzle-orm`, `drizzle-kit`) with the Neon HTTP driver | In use | Supports pgvector and reads like SQL, but has a smaller community than Prisma, and I am on release-candidate versions. |
| Embedding model | OpenAI `text-embedding-3-small`, called with plain `fetch` | In use | A second vendor, and the text of my documents leaves my system to be embedded. Very cheap. |
| Answer model | Claude Sonnet 5.5 (`claude-sonnet-5-5`), called with plain `fetch`, key in `ANTHROPIC_API_KEY` | In use | A third vendor and a per-answer cost. I can't confirm a temperature setting, so wording changes between runs. |
| Corpus format | Markdown files in `mychair-corpus/`, cut at headings into chunks of at most 1,200 characters | In use | Retrieval quality depends on how I write headings and sections. |
| MCP server | `@modelcontextprotocol/server` (v2) over stdio, run with `tsx` | Being built | The toolkit is new and changes quickly, and a stdio server only runs on my own computer, not on Vercel. |
| Input validation | `zod` | In use for MCP tools, planned for API routes | One more package to learn, but one rulebook for what input is allowed. |
| Logging | Own small logger to stdout/stderr and a `log_entries` table, 14-day retention | In use | I maintain it myself and the Vercel free log stream keeps only 1 hour, so the table is the real record. |
| Tests | Node's built-in test runner through `tsx` (`npm test`) | In use | No test helpers or mocks included, so I write small ones. |
| Auth | Own simple auth: hashed passwords + signed token (`jose`) in an httpOnly cookie | Planned | I own the security details, but the same token works for the mobile app later. |
| File storage | Vercel Blob | Planned | Simple, same dashboard, more Vercel lock-in. |
| Charts | Recharts | Planned | Easy line graphs; adds weight to the dashboard page. |
| Rate-limit storage | Upstash Redis | Planned | One more service and key, but memory doesn't work across serverless servers. |
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

## Future enhancements (parked)

- Clients with many shops, a shop switcher, and a "find a shop" feature
- Salon, nail shop, and lash studio types and one-click setup by business type
- White-label logo and colors per shop or pro
- Mobile apps (iOS/Android) using the same REST API
- Real payments, and text/email reminders
