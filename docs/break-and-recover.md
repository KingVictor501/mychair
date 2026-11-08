# MyChair – Break and Recover

One controlled break, caught by a log line, then fully recovered with proof.

**Break chosen:** Option A, a bad database address, on my computer only (the live site was never touched).
**Total time:** about 7 minutes, from starting the broken server to proving the recovery.

## 1. The break
I started the local server with a database address that cannot exist, instead of the real one:

```
DATABASE_URL="postgresql://user:pass@fake-host.invalid/mychair" npm run dev
```

That setting only applies to that one terminal run. The real address in `.env.local` was not changed, and no real password is in the fake one.

## 2. The symptom, in plain words
The page loaded, but where it should say the app is healthy, it said **"Health check: error. Database unreachable."** A visitor could see the site but nothing that needs the database would work. Visiting `/api/health` returned a short, safe error (status 503) with no technical details.

![The page showing "Health check: error. Database unreachable."](break-and-recover/break-1-symptom.png)

## 3. The log line that caught it
In the terminal, the app wrote a structured log line at level `error` named `request_failed`: the route was `/api/health`, the status was 503, and the message started with "Error connecting to database". It is followed by a `request_done` line with status 503, and a `log_persist_failed` warning.

![Terminal showing the request_failed error line, request_done with status 503, and the log_persist_failed warning](break-and-recover/break-2-log-line.png)

Note on the screenshot: the terminal window was narrow, so the right edge of each long line is cut off. The visible parts are `"level":"error"`, `"status":503`, `"requestId":"r_ffb7b18c"`, and `"message":"Error con…"`. A rehearsal run of the same break printed the complete message as `Error connecting to database: TypeError: fetch failed`.

The `log_persist_failed` warning is expected and not a second problem. With the database "down," the logger could not save the lines to the `log_entries` table either, so it said so in the terminal instead. This means the failed request is **not** in the database table, only in the terminal (and, on the live site, it would be in Vercel's log stream).

## 4. Diagnosis
- The line says the request failed (`request_failed`) with status 503, and the message says the app failed while connecting to the database.
- The visitor-facing error ("Database unreachable") agrees with it.
- The page itself loaded fine, so the website code is not the problem. The problem is the connection, so the first thing to check is the `DATABASE_URL` value.
- The `log_persist_failed` warning is a second sign the database is not reachable.

## 5. Recovery
I stopped the broken server with Control + C and started it normally with `npm run dev`, which reads the real `DATABASE_URL` from `.env.local` again.

## 6. Proof that it works again
The page says **"Health check: ok. The app is running and the database is reachable."**

![The page showing "Health check: ok"](break-and-recover/break-3-recovered.png)

The terminal shows fresh `request_done` lines with `"status":200`, and `GET /api/health 200`:

![Terminal showing request_done lines with status 200 after the recovery](break-and-recover/break-4-proof.png)

## 7. How long it took
About 7 minutes in total. The log timestamps show the failure at 23:26:08 UTC (6:26 pm Eastern) and the recovery at 23:27:49 UTC (6:27 pm Eastern).

My own note of the times is in [start-time-finish-time.png](break-and-recover/start-time-finish-time.png). It says 8:22 pm to 8:29 pm, which is the same 7-minute length but two hours later than my computer's clock and logs. The logs are the reliable record.
