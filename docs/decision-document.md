# MyChair – Decision Document

> DRAFT: the Tradeoff column is Claude's plain-English draft. Rewrite each one in your own words before submitting.

**Scope for this build:** barbers only, one shop. Multiple shops, other business types (salon, nail, lash), and shop discovery are future enhancements (see the end of this file). The data model still keeps a `shop_id` on every record so adding shops later is not a rewrite.

## The six graded decisions (hardest to change first)

| # | Decision | Choice | Tradeoff |
|---|---|---|---|
| 1 | Data shape | Relational | Every appointment links a shop, pro, client, and service, so I have to design the tables up front, and changing them later means migrations instead of just adding a field. |
| 2 | Database | PostgreSQL + pgvector, hosted on Neon | pgvector is less specialized than a dedicated vector database and would get slower at a very large scale. Neon's free tier sleeps when idle, so the first request after a quiet spell is slow. |
| 3 | Backend language | TypeScript on Node | I have to write types for everything, which is slower at first, and errors can point at compiled code instead of what I wrote. |
| 4 | Backend framework | Next.js (App Router) route handlers | The API lives inside the website project, so the future mobile app depends on my web deployment. The App Router changes quickly and is easy to confuse with the old Pages Router. |
| 5 | Frontend | React (through Next.js) | It ships a lot of JavaScript to phones, and the server vs. `"use client"` split is confusing for a beginner. |
| 6 | Hosting | Vercel | Functions are short-lived and can start cold, so no long background jobs. I'm also tied to Vercel's dashboard, and the free tier is for non-commercial use. |

### Why this and not the alternative
1. **Relational, not document (MongoDB):** everything links to everything, and the database itself can refuse an appointment with no real pro, client, or shop.
2. **Postgres + pgvector, not Postgres + a separate vector service (Pinecone):** services and their embeddings live in one place, so one database to run and secure. At a few dozen services, pgvector is plenty. Neon, not Supabase, because I want a plain database and not a bundle I'd have to learn around.
3. **TypeScript, not Python:** one language for server and browser, and the project rules require it.
4. **Next.js, not a separate Express/Hono server:** one project and one deploy this week. The mobile app can call the same REST routes later.
5. **React, not Vue/Svelte:** Next.js is built on it, and it's what I know.
6. **Vercel, not Render/Fly/a VPS:** fastest path to a public HTTPS URL. A VPS gives control I don't need and maintenance I don't want.

## Supporting choices

| Item | Choice | One-line tradeoff |
|---|---|---|
| ORM / DB tool | Drizzle | Supports pgvector and reads like SQL, but has a smaller community than Prisma. |
| Auth | Own simple auth: hashed passwords + signed token (`jose`) in an httpOnly cookie | I own the security details, but the same token works for the mobile app later. |
| File storage | Vercel Blob | Simple, same dashboard, more Vercel lock-in. |
| Embedding model | OpenAI `text-embedding-3-small` | Second vendor; service text leaves my system. Very cheap. |
| Charts | Recharts | Easy line graphs; adds weight to the dashboard page. |
| Rate-limit storage | Upstash Redis | One more service and key, but memory doesn't work across serverless servers. |
| Shop separation | Checks in one shared permission helper (not row-level security) | If I forget the helper on one route, data leaks. |

## My answers to the open questions

| Question | Answer |
|---|---|
| App name | MyChair |
| Branding | No custom branding now, but built so it can be added. Minimalist palette (white and gray) defined once as design tokens (shared color variables), so a logo and colors can be swapped in later. |
| Style cards across pros | Each pro keeps their own style card for a client. A pro can see another pro's card only if the owner or Super Admin grants permission. |
| Finding a shop | Not built. Future enhancement. |
| Pros joining | Invite link sent by the owner or Super Admin. |
| Time zone | Each shop has its own. With one shop for now, it is one setting stored on the shop. Times are stored in UTC and shown in the shop's zone. |
| Booking window | Default 5 days ahead. A pro can extend it (for example, high-volume pros). |

## Future enhancements (parked)
- Multiple shops and a "find a shop" feature
- Salon, nail shop, and lash studio types and one-click setup by business type
- White-label logo and colors per shop or pro
- Mobile apps (iOS/Android) using the same REST API
- Real payments, and text/email reminders
