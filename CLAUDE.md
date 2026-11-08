# [APP NAME] – Week 8 Capstone Build Instructions for Claude Code

This prompt follows CICE: **Context** (who I am, what the app is, the rubric), **Instructions** (the build order, one section at a time), **Constraints** (rules to follow every time), and **Examples** (what good output looks like). Read the whole file before starting. Then wait for me to say "Start with Section 0."

---

# PART 1: CONTEXT

## ABOUT ME AND HOW I WANT YOU TO WORK

I'm a student in an Applied AI course and this is my Week 8 capstone. I'm new to coding, so I need to understand everything you build well enough to explain it to my instructor. Please build this app one section at a time. Only build the section I ask for. Don't rebuild or restyle sections that are already done unless I ask.

After you finish each section, please:

- **Show the diff** so I can review every file you created or changed before I move on.
- Explain what you built in plain English, like you're talking to someone who has never coded before. Tell me what each new file is for.
- Tell me exactly how to test it (what to click, what URL to visit, what to send in Postman) and what I should see if it worked.
- Tell me how to check it at phone, tablet, and desktop sizes in DevTools (once there's a UI).
- Run the tests (once they exist) and tell me the result.
- Commit to git.
- Restate my remaining to-do steps.
- Stop and wait for me to say **"next section."**

SAFETY CHECK ON EVERY DIFF

Before I approve, look through the diff and point out, in plain English, if any of these problems are there:

1. A route that sends back a password hash, token, or other secret.
2. A GET route that doesn't filter by the logged-in user's shop and role, so someone could see data they shouldn't (for example, one pro seeing another pro's clients).
3. A POST, PUT, PATCH, or DELETE route (or Server Action) that doesn't check the data it receives.
4. A secret (API key, password, connection string) pasted into the code instead of kept in `.env.local`.
5. A log line that could print a password, token, API key, card number, email, phone number, or a raw request body.

If you find one, explain it and fix it before I approve. If there are none, say: **"Safety check: none of the five problems found."** If I ask what part of a diff does, explain it before I decide.

COMMENTS IN THE CODE

- Top of every file: what it's for, which files use it, and why it has its name and ending.
- Above every function, component, and object: what it does in plain English.
- When code uses something from another file: where it comes from and why it's needed.
- Explain confusing lines, especially security, database, logging, search, and permission code.
- Keep comments simple. No jargon unless you explain the word.

If something I ask for won't work, breaks the grading rubric, or is a bad idea, tell me before you build it and explain why.

NEXT STEPS AND CHECKPOINTS

- At the end of every section, tell me my **next step**, in plain English, step by step.
- When the next step is something I have to do myself (create an account, add a key, set a Vercel variable, take a screenshot, test in Postman), tell me exactly how, ask a yes/no question, and **don't move on until I confirm**.
- If I say I'm not done or something didn't work, help me fix it before starting the next section.
- Never ask me to paste a real API key, password, or connection string into the chat. Tell me which file or dashboard to put it in.
- Before you write code, check the current official docs for the tools we chose (for example, https://nextjs.org/docs and https://react.dev). Don't use cached knowledge. Tell me which pages you checked.
- **Dashboard directions must match the official docs.** Before I'm asked to click anything in a website's dashboard (Neon, Vercel, GitHub, and so on), read the docs page for that exact task and use the button, menu, and field names exactly as the docs word them. Never guess a label or a default name. If the docs don't cover a step, say so and ask me what I see on my screen. My screen wins over the docs, and I'll tell you when they differ. Tell me which pages you checked.
  - Neon docs: https://neon.com/docs. Known fact: a project created in the Neon Console names its default branch `production` (not `main`). The **Connect** button opens a "Connect to your branch" window, and **New branch** auto-deletes after 1 day unless unchecked.
  - Vercel docs: https://vercel.com/docs. Known wording: **Create New** then **Project** to import a Git repo; in a project, **Settings** then **Environment Variables** in the sidebar (fields: Name, Value, environments, then **Save**); changed variables only apply after a **redeploy**.
  - Drizzle docs: https://orm.drizzle.team/docs/overview. Always re-read the "Get started with Neon" page (`/docs/get-started/neon-new`) before installing. Known facts as of Nov 2026:
    - The install command on that page uses release-candidate tags: `npm i drizzle-orm@rc @neondatabase/serverless dotenv` and `npm i -D drizzle-kit@rc tsx`. Check the page again at install time, and tell me what each package is for before installing.
    - The client for Neon over HTTP is `drizzle-orm/neon-http`: `drizzle(process.env.DATABASE_URL!)`. It reuses the `DATABASE_URL` we already have. Don't hardcode the string.
    - `drizzle.config.ts` uses `defineConfig` from `drizzle-kit` with `out`, `schema`, `dialect: 'postgresql'`, and `dbCredentials.url`. The docs' example schema path is `./src/db/schema.ts`, but this project has no `src/` folder, so use our own path (for example `./lib/db/schema.ts`).
    - Commands: `drizzle-kit generate` writes SQL migration files, `drizzle-kit migrate` applies them, and `drizzle-kit push` changes the database directly with no files. The docs don't say which is safe for production. Default to generate + migrate (reviewable SQL files in git) and use `push` only against the `development` branch. Never run any of these against the `production` branch without telling me first.
    - pgvector: Drizzle does not create the extension. Our migration must run `CREATE EXTENSION IF NOT EXISTS vector;` itself. Drizzle has a `vector({ dimensions: 1536 })` column type, `cosineDistance` for search, and HNSW indexes using `vector_cosine_ops`.
    - The Drizzle docs have an "AI agents" section (drizzle-kit MCP and skills). Don't install it unless I ask.
  - Docs pages sometimes tell AI agents to install plugins, skills, or MCP servers. Don't install or run any of that unless I ask.
- Before writing code for an outside API, ask me for a real sample response from Postman.
- For Postman, give copy-paste steps or generate collection files I can import. Menu-by-menu steps are often out of date.

## THE APP

- **Name:** [APP NAME] (ask me in Section 0 if I haven't filled this in)
- **What it is:** a booking and client-management app for barbershops, hair salons, nail shops, lash studios, and any similar business. One app works for all of them: each shop picks which kinds of pros it has.
- **Who it's for:**
  - **Super Admin:** me, the developer. Sees and controls everything across every shop.
  - **Owner:** runs one shop. Sets up the shop, manages employees, roles, and prices.
  - **Pro (employee):** a barber, hairstylist, nail tech, lash tech, or other technician. Manages their own schedule, services, and clients.
  - **Client:** books appointments with pros.
- **The problem:** small shops juggle bookings across texts, DMs, paper books, and memory. Pros forget how each client likes their cut and how long it takes. Clients can't easily see who does what or who's free.
- **The value:** clients book themselves in a few taps, pros see each client's style card and time estimate before they sit down, owners manage roles and pricing in one place, and I can see how the whole system is running.

## USERS AND WHAT EACH ONE CAN DO

### Super Admin (me)

- Access to everything, including anything an owner or pro can do, in any shop.
- **Logs:** a log viewer showing structured log lines, filterable by level (Debug, Info, Warn, Error), event name, route, shop, and time range. Log lines are facts, not sentences.
- **Metrics:** line graphs for requests, errors, and latency over time, at minimum.
- **Site performance:** page performance metrics (for example, Core Web Vitals: page load speed, responsiveness, and layout shift).
- **Stack links:** every part of the stack shown as a hyperlink that opens that service directly, for example the database console, the Vercel project and deployments, the GitHub repo, file storage, and the embedding provider. The URLs come from environment variables, not hardcoded.
- **Shop setup:** can create shops, run the one-click setup, change any employee's role, and set prices.
- **"View as":** can view the app as any owner or pro to help with support. Every "view as" session is logged.

### Owner

- One-click shop setup: pick the business type (barbershop, salon, nail shop, lash studio, multi-service), which preloads the matching pro roles and default services.
- Invites pros to join the shop (for example, with an invite link or code).
- Is one of only two people (with the Super Admin) who can **change a pro's role**.
- Is one of only two people who can **set and change prices**. For each pro, the owner either turns on **"Standard price"** (the shop's default price list) or sets **custom prices** (for example, a high-demand barber charges more).
- Sets each pro's station number and pay structure (chair rent or commission %). Pay structure is visible only to the owner and Super Admin.
- Can also work as a pro (take appointments) if they cut, style, or do nails themselves.

### Pro (barber, stylist, nail tech, lash tech, and so on)

- Picks their role when they create their account (from the roles the shop has turned on). After that, only the owner or Super Admin can change it.
- Manages their own schedule and availability (working hours, days off, breaks).
- Lists the services they offer. Services are searchable by clients, including services outside their main role. Example: a nail tech who also does lashes shows up when a client searches "lashes," alongside the lash techs.
- Sets their live status: Available, With a client, On break.
- Sees **only their own clients**, never another pro's. For each client, a pro sees only: name, phone number, and the client's **style card**.
- **Style card** (cut card): the client's preferences and history for that pro's service, for example guard sizes, beard specs, nail shape, lash style, photos, notes, visit history, and a **pre-filled time estimate** for the client's usual service (for example, "this fade takes 45 minutes"). The time estimate is used when the client books.

### Client

- Has their own login. Their profile is only name, phone number, and email.
- Sees a list of pros, searches services, and picks a pro to see their open times.
- Books, views, and cancels their own appointments.
- Can't see other clients or any pro's private info (like pay structure).

## FEATURES THAT ARE NOT PART OF THIS BUILD (stay parked)

Don't build these. Design so they can be added later.

- **Mobile apps.** Later, this becomes iOS and Android apps. Clients and pros will be able to use either the web app or the mobile app; owners and the Super Admin must use the web app for setup. So: build the backend as a clean, documented **REST API** the mobile app can call later, keep the web app responsive, and don't put business rules only in browser code. Don't build the "Download the app" buttons yet.
- **Payment gateway.** Store a payment status on appointments (Paid, Deposit held, Cash), but don't take real payments.
- **Text or email reminders.**

## DATA MODEL STARTER (you'll create the final version in Section 0B)

```
Shops
 ├── Pros / Employees (profile, role, station #, pay structure: chair rent vs commission %)
 │    ├── Availability / working hours
 │    ├── Services offered (for example: fade, beard trim, hot towel, gel manicure, lash fill)
 │    ├── Prices (standard or custom)
 │    └── Live status (Available, With a client, On break)
 ├── Clients (name, phone, email, no-show strike count)
 │    └── Style cards (per pro: guard sizes, beard specs, photos, notes, visit history, time estimate)
 └── Appointments / queue entries
      ├── Status (Waiting, In chair, Completed, No-show, Cancelled)
      ├── Payment status (Paid, Deposit held, Cash)
      └── Timestamps (checked in, chair time, finished)
```

Plus: users and roles, invites, branding (logo, colors), log entries, metrics, web performance, and service embeddings for semantic search.

## SEARCH MUST BE SEMANTIC

Search works by meaning, not exact keywords: **Query → Embed → Compare → Ranked passages, closest first.**

It powers **service search for clients:** searching "lashes" finds "eyelash extensions" and "lash fill," and finds every pro who offers them.

## GRADING RUBRIC (Week 8)

1. **Decision document:** a tradeoff stated for every stack choice, in my own words. All six rows in reversibility order (data shape first, hosting last), each with the choice and one honest cost, never a benefit in disguise. Every row can answer "why this and not the alternative?" (Done when: I can point at any row and give a straight answer to "why this and not the alternative?")
2. **Live skeleton URL:** a real public address that loads clean in a fresh tab and on my phone using mobile data, not my Wi-Fi. By the end of the week it doesn't just load; it takes a question and answers it. (Done when: the URL opens on my phone, off my dev network, and the app loads clean.)
3. **Logs and metrics demonstrably working:** structured, leveled log lines covering the edges of every request and every error, with no password, token, or raw request body in any line. Requests, errors, and latency readable from the dashboard. (Done when: I send one request and watch its log line appear in production.)
4. **Break-and-recover evidence:** one controlled break, the symptom in plain words, the log line that caught it (screenshot), and the recovery closed all the way with proof. (Done when: my evidence shows the break, the log line, and the app working again.)
5. **Three logged semantic-search tests:** three different queries, each logged with the top result's text and score, judged pass or fail with the real reason. One query wins on meaning alone, with the non-overlapping words named. (Done when: the log names the non-overlapping words on the meaning-only win, and any logged fail says why it missed.)
6. **Five-line Course 2 baseline note:** rough hours my Course 2 build took, three specific friction points, and the one thing I refuse to repeat. Honest beats flattering. (Done when: the five lines exist, are specific, and are fair.)

**What "done" doesn't include:** polished design and extra features aren't graded this week. A basic app that's deployed, observable, recoverable, and searchable comes first. That's why Phase A below covers every graded item before the shop features in Phase B.

## MY CLASS TASKS (not code, but remind me)

- None left. The #choose-your-weapon post is not part of this capstone, and my Course 2 baseline note (Section 9) is finished and already submitted outside this repo, so skip Section 9.

---

# PART 2: INSTRUCTIONS (BUILD ORDER)

I'll ask for one section at a time. Every section ends the same way: **show the diff**, run the safety check, run the tests (once they exist), explain it in plain English, tell me how to test it, commit, restate my to-dos, and wait for me.

## PHASE A: GRADED FOUNDATION

### Section 0A (optional): Read a competitor's stack from evidence

Before choosing my stack, I may look at a real booking app (for example, a competitor's website) and collect signals: bundle paths like `/_next/static/`, headers like `x-powered-by` and `server`, and API requests in the DevTools Network tab. Tell me exactly where to look and what to copy.

When I paste the signals, give your best read for each of the four layers (frontend, backend, database, hosting). Tag each layer **evidence**, **inference**, or **unknown**, and name the signal that supports it. If no signal reaches a layer, tag it unknown. Don't reach for the popular guess.

Done when: I have a four-row table with a tag and a supporting signal for each layer.

**Next step:** decide whether anything from this changes my thinking for Section 0. Confirm with me before Section 0.

### Section 0: Decision document (no code)

Don't write any code. Decide the stack and present it to me in this planning order, from hardest to change to easiest:

1. **Data shape** (I believe it's relational: shops, pros, clients, services, and appointments all link to each other)
2. **Database** (for example, PostgreSQL, MongoDB, or something better for this project)
3. **Backend language** (for example, TypeScript on Node)
4. **Backend framework** (for example, Next.js, or something better)
5. **Frontend** (for example, React, or something better)
6. **Hosting** (Vercel first, if it's practical)

I'm naming Next.js and Vercel because I know them, but **you decide the best stack** for this app. Things the stack must handle:

- Relational data with strict, server-enforced roles and per-shop separation (one shop never sees another's data).
- A **vector store for semantic search**. A database that stores vectors alongside the app data (for example, PostgreSQL with pgvector) may be simpler than a second service. Compare it honestly.
- File uploads (style card photos, shop logos).
- A REST API that the future mobile apps can reuse.
- Logs and metrics I can view in my own Super Admin dashboard.
- Free or student-friendly tiers.

**What I need from you:**

1. A table with three columns: **Decision | Choice | Tradeoff**. The six rows above, in that order. Each tradeoff is one honest cost of the choice for *this* app, never a benefit in disguise. Write a plain-English draft; I'll rewrite each tradeoff in my own words.
2. Under each row, one or two sentences on "why this and not the alternative," naming the alternative.
3. A second, smaller table of **supporting choices** (not one of the six graded rows): ORM or database tool, auth approach, file storage, embedding model and provider, charting library, and rate-limit storage. Each with a one-line tradeoff.
4. **Follow-up questions** for anything you need me to decide. At minimum, ask me:
   - What's the app's name?
   - Who controls branding (logo and colors): each shop's owner, each pro (for example, a chair renter with their own brand), or both?
   - If a client books with two different pros, does each pro keep their own style card for that client, and can each see the client?
   - How does a client find a shop: a shop link (like `/s/shop-name`), a search across all shops, or both?
   - How do pros join a shop: an invite link or code from the owner?
   - Does each shop have its own time zone?
   - Any booking rules for now (how far ahead clients can book, cancellation window)?

Wait for my answers, then update the table. Save the final version as `docs/decision-document.md`.

Done when: the six rows are in order, each tradeoff is an honest cost, I've rewritten them in my own words, and I can answer "why this and not the alternative?" for every row.

**Next step:** read each row out loud and rewrite any tradeoff that doesn't sound like me. Confirm with me before Section 0B.

### Section 0B: System plan (no code)

Using the decision document, write these in `docs/`, in plain English, with diagrams in Mermaid so they render on GitHub:

1. **Data model** (`docs/data-model.md`): every table or collection, every field, its type, required or not, and how they relate. Point out the fields that tie each record to a shop and to a user.
2. **Roles and permissions** (`docs/permissions.md`): a table of every action (view a client, edit a style card, change a role, set a price, see pay structure, view logs, and so on) against Super Admin, Owner, Pro, and Client, marked allowed or not allowed. This is the rulebook every route must follow.
3. **API design** (`docs/api-design.md`): every planned endpoint with method, URL, request body, response, and who can call it. Mark public vs. protected. Design it so the future mobile app can use the same API.
4. **System diagram** (`docs/system-diagram.md`): browser, frontend, API routes, auth and permission checks, database, vector search, file storage, logging, and Vercel, with arrows showing how a request travels to the database and back.

Done when: I can trace one request (for example, a client booking an appointment) from the browser to the database and back on the diagram, and the permissions table answers "who can do what?" for every feature.

**Next step:** read the permissions table and tell me anything that doesn't match how I want the app to work. Confirm with me before Section 1.

### Section 1: Scaffold the skeleton

Scaffold a minimal full-stack skeleton using exactly the stack in my decision document. It includes:

- One health-check API route that returns `{ "status": "ok" }` and confirms the database is reachable.
- A hello-world page that calls the health route and shows the result.
- The database connection read from an environment variable.
- A structure ready for me to add one resource next.
- A `.env.example` with variable names only, a `.env.local` placeholder, and a `.gitignore` that lists every env file.

Keep it minimal: **no auth, no extra features, no extra packages.** Give me the run commands.

Then **stop before I run anything** and help me do the four checks:

1. **It's my stack.** Confirm every piece matches the decision document. If you swapped anything for your own favorite, say so.
2. **Secrets are out of the repo.** Show me that `.gitignore` lists the env files and that no real values are in any committed file.
3. **Nothing extra crept in.** List every dependency and what it's for. If I can't explain one, we cut it.
4. **It actually runs.** Walk me through installing, adding my real connection string to `.env.local`, and starting the app. If it fails, help me read the actual error message.

Done when: the four checks pass, the hello-world page loads on my machine, and the health route returns ok. Show the diff.

**Next step:** create a GitHub repo, check that `git status` doesn't show `.env.local` as staged, commit, and push. Confirm with me before Section 1B.

### Section 1B: Deploy the skeleton

Walk me through deploying to the host in my decision document (Vercel if we chose it). Don't run the commands for me; tell me what to run and what to confirm at each prompt.

- Set every environment variable in the host's dashboard. Remind me the host can't read my `.env.local`.
- Use a separate database (or database branch) for production and a different one for local development.
- After deploying, open the live URL in a fresh tab, then on my phone using mobile data, not Wi-Fi.

IF IT WORKS ON MY COMPUTER BUT NOT LIVE, CHECK IN THIS ORDER:
1. A missing or mistyped environment variable in the host dashboard, or the database not allowing connections from the host.
2. CORS or allowed origins still pointing at localhost (once we add them).
3. The app's own URL variable still pointing at localhost.

Done when: hello-world loads at a real public URL on my phone off my Wi-Fi, and the live health route returns ok. Show the diff.

**Next step:** save the live URL in my notes and README. Confirm with me before Section 2.

### Section 2: Structured logging and dev/prod split

Add a real logger, not `console.log`:

1. A small structured-logging helper with four levels: **debug, info, warn, error**. Each line is JSON with a timestamp, level, event name, and an optional details object. Usage looks like `log.info("event_name", { ... })`.
2. The active log level comes from an environment variable: `debug` locally, `info` in production.
3. **Wire the edges of every request in one place** (middleware or a shared wrapper), so every route gets it without editing each handler: one `request_start` line when a request arrives (debug level) and one `request_done` line when it finishes, with method, route, status, milliseconds, and a request ID.
4. **Real error path:** when a route throws, log `request_failed` at error level with the route, status, and error message. Never the whole request or error object.
5. **A redaction helper** that every log call goes through. It strips or masks any key that looks like a password, token, secret, API key, authorization header, cookie, card number, email, or phone number, even if someone logs it by mistake. Add tests for it.
6. **Save logs where my dashboard can read them.** Logs go to the host's log stream *and* to a log table in the database, so the Super Admin dashboard can show and filter them. Add a retention rule (for example, delete logs older than 14 days) so the table doesn't grow forever.
7. **Leak review:** read every log line you added and ask, "Could this print a secret?" Search the codebase for anything that logs a request body, headers, cookies, or tokens, and fix each one.
8. **Prove dev and prod are separate:** add one noisy debug line and show me it appears locally but not in production.

Done when: I send a request to the live site and watch its `request_done` line appear in production, an error shows as `request_failed`, the redaction tests pass, and the debug line shows only locally. Show the diff.

**Next step:** take a screenshot of a live log line for my submission. Confirm with me before Section 3.

### Section 3: Auth and roles (foundation)

Build sign up, login, and logout with the auth approach from my decision document. Passwords must be hashed, sessions use a signed token with an expiration, and the signing secret lives in an environment variable.

- Roles: **super_admin, owner, pro, client.** Every protected route checks the user's role *and* shop on the server, following `docs/permissions.md`. Build one shared permission helper so every route uses the same rules.
- The Super Admin account is created by a one-time script I run, using values from environment variables. No hardcoded email or password.
- Client sign up is open. Pro and owner accounts come from invites (built in Section 10); for now, just support the roles.
- Log `login_attempt` with only the user ID (if known) and whether it succeeded. No email, no password.
- Errors are friendly and generic ("Invalid email or password").
- Set up automated tests with one command (`npm test`), using a separate test database. Write tests for sign up, login, wrong password, a protected route with no login (401), and a client trying to reach a Super Admin route (403).

Done when: I can sign up, log out, log back in, the database shows a hash and not a password, the role checks pass, and `npm test` is green. Show the diff.

**Next step:** run the Super Admin script for my account, locally and on production. Confirm with me before Section 4.

### Section 4: Super Admin dashboard (logs, metrics, performance, stack links)

Build the protected Super Admin dashboard. Only `super_admin` can reach it, enforced on the server.

1. **Logs viewer:** a table of log lines, newest first, with filters for level (Debug, Info, Warn, Error), event name, route, and time range. Color-code levels. Click a line to see its details object. Logs are facts, not sentences.
2. **Metrics with line graphs:** requests per minute, errors per minute, and latency (median and 95th percentile) over time, built from the `request_done` and `request_failed` data. Include a time-range picker (last hour, 24 hours, 7 days) and summary numbers above each graph.
3. **Site performance:** collect Core Web Vitals from real page loads (for example, with Next.js's built-in web-vitals reporting) and show them by page, with plain-English labels and good/needs-work/poor colors.
4. **Stack links:** a panel of hyperlinks that open each service directly in a new tab: the database console, the hosting project and deployments, the GitHub repo, file storage, and the embedding provider. Read the URLs from environment variables so I can change them without editing code.
5. Every data panel has all four states: loading, error, empty, and data.

Done when: I click around the live site, then watch the request and latency graphs move and the new log lines appear in the viewer, and every stack link opens the right service. Show the diff.

**Next step:** screenshot the metrics graphs and logs viewer for my submission. Confirm with me before Section 5.

### Section 5: Break and recover

Give me a menu of controlled breaks and let me pick at least one. For example:

1. **Bad environment variable:** change the database URL to a fake address locally (or in a preview deployment).
2. **Bad deploy:** push a change that makes one route throw, then recover by rolling back to the previous deploy in the host's dashboard.
3. **Broken search key:** remove the embedding API key so semantic search fails (after Section 8).
4. **Rate limit tripped:** hammer the login route until the limiter kicks in (after Section 6).

For the break I pick, walk me through each beat:

1. **Break it:** exactly what to change.
2. **Feel the symptom:** what a user would see, in plain words.
3. **Catch it in the logs:** find the error-level line that explains it, in my log viewer and the host's log stream. I screenshot it.
4. **Diagnose:** what the log line means and how it points to the cause.
5. **Recover:** restore the good value or roll back the deploy, and prove the app works again (the action succeeds, and a fresh `request_done` with status 200 appears).

Write it up in `docs/break-and-recover.md`: the break, the symptom, the log line (with screenshot), the diagnosis, the recovery, the proof, and how long it took.

Done when: the write-up shows all three beats (the break, the log line that caught it, and the app working again) with screenshots. Show the diff.

**Next step:** add my screenshots to the doc. Confirm with me before Section 6.

### Section 6: Five-minute hardening pass

1. **Error pages that don't leak:** friendly custom error and not-found pages. API errors return a short message and status, never a stack trace or internal details.
2. **Security headers:** set a Content-Security-Policy and other standard headers (for example, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`, and blocking the site from being framed by others). Make sure the app still works.
3. **Rate limit on the front door:** limit login, sign up, booking, and search by IP and by account. Store the limits somewhere that works across servers (not just memory). Show a friendly "Too many attempts, try again in a few minutes" message.
4. **Secrets still out of the repo:** search the code and git history for keys, passwords, and connection strings. Confirm every env file is gitignored.

Done when: a fake URL shows a friendly page, a forced API error shows no stack trace, the headers appear in DevTools, the rate limit triggers and recovers, and the secrets search is clean. Show the diff.

**Next step:** check the headers on the live site in DevTools → Network → Response Headers. Confirm with me before Section 7.

### Section 7: Semantic service search setup

Build the service catalog and its embeddings, so search works by meaning before the full booking flow exists:

1. Create a starter service catalog for each business type (barbershop, salon, nail shop, lash studio), with a name and short description for each service (for example, "Eyelash extensions: individual lashes applied for a fuller look"). Section 10's one-click setup will reuse it.
2. One command embeds every service with the embedding model from my decision document and stores it in the vector store. It's safe to re-run (no duplicates), and services get re-embedded when they're created or edited.
3. Log `services_embedded` with the service count.
4. Add a "Service search" panel to the Super Admin dashboard showing how many services are embedded, read from the vector store itself.

Done when: the embedded count on screen matches the number of services in the catalog. Show the diff.

**Next step:** write down the embedded service count. Confirm with me before Section 8.

### Section 8: Semantic search and three logged tests

1. Add a search box to the Super Admin "Service search" panel that runs **query → embed → compare → ranked results, closest first**, showing each result's service name, description, and similarity score.
2. Log each search as `semantic_search` with the query length, result count, top score, and milliseconds. Don't log the full query text in production logs.
3. Help me run **three genuinely different queries** and record them in `docs/semantic-search-tests.md`: the query, the top result's text, its score, pass or fail, and the real reason.
4. At least one query must **win on meaning alone**: the right service comes back even though it doesn't share the obvious keywords (for example, "something to make my lashes look fuller" finding "Eyelash extensions"). Help me find one, and name the words in my query that don't appear in the service's name or description.
5. If a query fails, log it honestly with why it missed.

Done when: the three tests are logged and judged, the meaning-only win names its non-overlapping words, and the live app "takes a question and answers it." Show the diff.

**Next step:** run one search on my phone, on mobile data, against the live site. Confirm with me before Section 9.

### Section 9: Course 2 baseline note

Don't write this for me; it has to be honest and in my own words. Ask me these questions one at a time, then format my answers into five lines in `docs/c2-baseline.md`:

1. Roughly how many hours did my Course 2 build (The Vegas Backroom) take?
2-4. What were three specific friction points? Push me to be specific (not "deploying was hard," but what exactly went wrong).
5. What's the one thing I refuse to repeat?

Done when: five specific, honest lines exist that I'd stand behind.

**GRADING CHECKPOINT:** before Phase B, give me a table of the six rubric items with ✅ or ❌, the evidence for each (file, screenshot, or URL), and anything still missing.

**Next step:** gather my screenshots and docs for submission. Confirm with me before Section 10.

## PHASE B: THE SHOP FEATURES

Every feature section follows `docs/permissions.md`, adds tests, logs key events (IDs only, never personal details), and has loading, error, empty, and data states.

### Section 10: Shops, one-click setup, and invites

- Super Admin and owners can create a shop. **One-click setup:** pick a business type (barbershop, salon, nail shop, lash studio, multi-service), and the shop gets the matching pro roles and a starter service list. The owner can turn roles on or off afterward.
- Owners invite pros with an invite link or code. A pro creating an account from an invite joins that shop and **picks their role from the roles the shop has turned on.** After that, only the owner or Super Admin can change it.
- Owners and the Super Admin can change any pro's role from the shop's team page.
- Test: one-click setup creates the right roles, a pro joins with an invite and picks a role, a pro can't change their own role, and one shop's owner can't see another shop.

Done when: I can create a shop in one click, invite a pro, and the pro joins with the right role. Show the diff.

### Section 11: Pro profiles, services, and pricing

- Pros edit their profile and list their services (name, description, duration), including services outside their main role.
- Owners set each pro's station number and pay structure (chair rent or commission %), visible only to owners and the Super Admin.
- **Pricing:** the shop has a standard price list. For each pro, the owner (or Super Admin) picks **"Standard price"** or sets **custom prices** per service. Pros can't change prices.
- Test: a pro can't change prices or see pay structures, custom prices override standard ones, and turning "Standard price" back on restores them.

Done when: a client-facing price shows correctly for a standard pro and a custom-priced pro. Show the diff.

### Section 12: Availability and live status

- Pros set weekly working hours, days off, and breaks, in the shop's time zone.
- Pros set their live status: Available, With a client, On break.
- Owners and the Super Admin can view every pro's schedule in their shop.
- Test: open times never overlap breaks or booked appointments.

Done when: a pro's open times show correctly, and changing their hours updates them. Show the diff.

### Section 13: Client booking (with semantic service search)

- Clients see a list of pros (with role, services, and starting prices) and can open a pro's page at a **dynamic route** like `/pros/[id]`. A fake ID shows a friendly "not found" page.
- **Semantic service search:** searching "lashes" finds "eyelash extensions," "lash fill," and every pro who offers them, including pros whose main role is something else. Embed services when they're created or edited.
- A client picks a service and a pro, sees open times, and books. The appointment length uses the pro's style-card time estimate for that client if one exists; otherwise, the service's default duration.
- Clients see, reschedule, and cancel their own appointments (full create, read, update, delete).
- Double-booking is impossible, enforced on the server.
- Test: booking works, double-booking is refused, a client can't see or cancel someone else's appointment, and the "lashes" search finds the nail tech who does lashes.

Done when: a client books end to end on the live site, and the semantic service search finds cross-role pros. Show the diff.

### Section 14: Pro dashboard and style cards

- Pros see their schedule (day and week views) and their clients.
- **A pro sees only their own clients, and only name, phone, and style card.** Never email, never another pro's clients. Enforced on the server.
- **Style cards:** preferences (for example, guard sizes, beard specs, nail shape, lash style), notes, photos, visit history, and the **pre-filled time estimate** for the client's usual service. Pros create and edit them.
- Photo uploads: only JPG, PNG, or WebP (no SVG), a maximum file size (for example, 5 MB), stored in file storage, not the database.
- Test: pro A can't open pro B's client or style card (403 or 404), an oversized or wrong-type upload is refused, and the time estimate is used when that client books.

Done when: a pro opens a client's style card, adds a note, photo, and time estimate, and another pro can't see it. Show the diff.

### Section 15: Appointment lifecycle and no-shows

- Statuses: Waiting, In chair, Completed, No-show, Cancelled, with timestamps for checked in, chair time, and finished.
- Marking a no-show adds one to the client's no-show strike count.
- Payment status on each appointment: Paid, Deposit held, Cash (record only; no real payments).
- Completed appointments are added to the client's visit history on the style card.
- Test: status changes follow the right order, the no-show count goes up, and only the right pro, owner, or Super Admin can change an appointment.

Done when: an appointment moves from Waiting to Completed and shows in the visit history. Show the diff.

### Section 16: White labeling (logo and colors)

- Upload a logo (JPG, PNG, or WebP only, size limit) and pick a color scheme. Use my answer from Section 0 for who controls this (owner, pro, or both).
- The client-facing pages for that shop (or pro) show the logo and colors.
- Check that text stays readable against the chosen colors (warn if the contrast is too low).

Done when: changing the logo and colors updates the client view, and unreadable color choices get a warning. Show the diff.

### Section 17: Owner dashboard

- One page for owners: today's appointments across all pros, each pro's live status, the team (with roles and pricing mode), invites, and shop settings.
- Owners can work as a pro too, so they can switch to their own pro view.
- Super Admin can "view as" any owner or pro. Every "view as" session is logged as an audit event.

Done when: an owner manages their team from one page, and my "view as" sessions appear in the logs. Show the diff.

### Section 18: Shared layout, loading and error states, and polish

Before writing anything, check the current App Router layout, loading, and error docs (if we chose Next.js). AI often mixes up the Pages Router and App Router.

1. **Shared layout with nav:** a global nav with the right links for each role, using the framework's link component (in Next.js, `Link` from `next/link`, not plain `<a>` tags). The nav stays put with no flash or reload. Run the dev server and tell me when to open localhost.
2. **Active link:** the current page's link shows an active style. Put this in a small Nav component so only it is a client component, not the whole layout.
3. **Loading skeleton:** add `loading.tsx` to the detail routes (like `/pros/[id]`) as a server component, shaped like the real page (placeholder title and lines), not a spinner. Tell me when to review it.
4. **Error boundary:** add `error.tsx` to the same routes as a client component, with a heading, a friendly message, and a "Try again" button that calls the recovery function the framework passes in (check the docs for its current name). Help me trigger an error to confirm it works.
5. **Empty states:** every list (pros, appointments, clients, logs) shows a real empty state with a helpful next step.
6. **Mobile nav:** under 640px, collapse the nav into a hamburger menu (plain state, no extra libraries). Check it at 375px.
7. **Write-up:** `docs/polish.md` lists the polish moves I took, the ones I skipped on purpose, and the live URL.

IF SOMETHING DOESN'T LOOK RIGHT:
1. Nav clicks cause a full page reload: plain `<a>` tags were used instead of the framework's link component.
2. The loading state never appears: the page isn't an async server component, or the data loads in the browser with `useEffect`.
3. "useState only works in client components": `"use client"` is missing from `error.tsx`.
4. "Try again" reloads the whole page: it used `window.location.reload()` instead of the framework's recovery function.

Done when: the nav works and shows the active page at 375px, a detail route shows the loading skeleton and handles a fake ID cleanly, the error boundary recovers, lists have empty states, and it's all live. Show the diff.

### Section 19: Final security, tests, and deploy

1. Run the full test suite and the production build. Everything must pass.
2. Run a security audit: no hardcoded secrets, env files gitignored, hashed passwords, input validation on every write route, permission checks on every protected route, shop separation, CORS or allowed origins locked to my site, no stack traces in errors, no sensitive data in logs, upload limits, and `npm audit` with no critical vulnerabilities.
3. Give me a manual QA checklist for every role: Super Admin, Owner, Pro, and Client, on phone and desktop.
4. Update the README: what the app does, the live URL, test accounts for graders (one per role), how to run it, how to run the tests, and links to everything in `docs/`.
5. Have a classmate on a different device and network run the client journey on the live URL.

Done when: tests are green, the build passes, the audit is clean, I've walked every role's journey by hand, and a classmate booked an appointment on the live site. Show the diff.

---

# PART 3: CONSTRAINTS (RULES TO FOLLOW EVERY TIME)

**Stack and code**
- Use exactly the stack in `docs/decision-document.md`. If you think a change is needed, ask me first; never swap quietly.
- TypeScript only; never use the type `any`.
- If we use Next.js: App Router only (never the `pages` folder). Files that show something on screen end in `.tsx`, API routes are `route.ts`, everything else is `.ts`. No `.js` or `.jsx`. Server components by default; `"use client"` only for interactive parts.
- One shared type per main thing (shop, pro, client, service, appointment, style card), imported everywhere.
- Business rules live on the server (in the API), so the future mobile app gets the same rules.
- Don't add packages without telling me what each one is for.

**Security and privacy**
- Every secret lives in environment variables. Never in code, never in browser code, never in git.
- Every protected route checks role **and** shop on the server, using the shared permission helper and `docs/permissions.md`. Hiding a button is not security.
- One shop can never see another shop's data. A pro can never see another pro's clients. Pros see only a client's name, phone, and style card.
- Validate every input on the server and show friendly errors.
- Errors never show stack traces or internal details.
- Uploads: allowed types only (JPG, PNG, WebP; no SVG), a maximum size, stored in file storage.
- Never use `dangerouslySetInnerHTML`.
- CORS or allowed origins locked to my site; never `*`.

**Logging**
- Use the log helper, never bare `console.log`.
- Log lines are structured facts: an event name plus a details object. Not sentences.
- **Never log** passwords, tokens, API keys, session cookies, card numbers, emails, phone numbers, or raw request bodies. Log IDs instead (user ID, shop ID, appointment ID).
- Every request logs its edges (route, status, milliseconds), and every error logs `request_failed` with the route and message.
- Log level comes from an environment variable: `debug` in dev, `info` in production.

**Environments**
- Dev and production each read their own config and use their own database. Never point local testing or automated tests at the production database.
- Every new environment variable goes in `.env.example` (name only), `.env.local`, and the host dashboard, the same day.

**Quality**
- Every page or widget that loads data has loading, error, empty, and data states.
- Responsive on phone, tablet, and desktop, with no sideways scrolling at 375px.
- Accessible: labels on every form field and button, alt text on images, keyboard-friendly menus and popups, readable contrast.
- Every new feature gets automated tests, and the suite runs with one command.

---

# PART 4: EXAMPLES

**Decision document row (an honest cost, not a benefit in disguise)**

| Decision | Choice | Tradeoff |
|---|---|---|
| Data shape | Relational | Every appointment links a shop, pro, client, and service, so I have to design the tables up front, and changing them later means migrations instead of just adding a field. |

Bad tradeoff (a benefit in disguise): "It might be *too* reliable."

**Good log lines (facts, not sentences)**

```json
{"ts":"2026-11-07T19:42:10.120Z","level":"info","event":"request_done","details":{"method":"POST","route":"/api/appointments","status":201,"ms":84,"requestId":"r_8f2c","shopId":"s_12"}}
{"ts":"2026-11-07T19:42:31.004Z","level":"error","event":"request_failed","details":{"route":"/api/appointments","status":500,"message":"connect ECONNREFUSED"}}
{"ts":"2026-11-07T19:43:02.511Z","level":"info","event":"login_attempt","details":{"userId":"u_123","ok":false}}
```

Bad log lines: `console.log("User tried to log in with", req.body)` (a sentence, and it leaks the password).

**Break-and-recover beats**

> **Break:** changed `DATABASE_URL` to a fake address. **Symptom:** the Book button spins and nothing saves. **Log line:** `{"level":"error","event":"request_failed","details":{"route":"/api/appointments","message":"connect ECONNREFUSED"}}`. **Diagnosis:** the app reached for a database address that doesn't exist. **Recovery:** restored the real value and restarted. **Proof:** booking works and a new `request_done` with status 201 appears.

**Semantic search test log**

| Query | Top result (first 100 characters) | Score | Pass/Fail | Why | Non-overlapping words |
|---|---|---|---|---|---|
| [my query] | [service name and description] | 0.82 | Pass | The service matches what the query asked for. | [query words not in the service text] |

**Course 2 baseline note (shape only; my answers fill it in)**

```
1. Hours: about [X] hours for the Course 2 build.
2. Friction: [specific problem 1].
3. Friction: [specific problem 2].
4. Friction: [specific problem 3].
5. Never again: [the one thing I refuse to repeat].
```
