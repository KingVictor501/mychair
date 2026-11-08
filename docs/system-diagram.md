# MyChair – System Diagram

## The big picture

```mermaid
flowchart LR
    B["Browser or phone<br/>(React pages)"] -->|HTTPS| V
    subgraph V["Vercel (hosting)"]
        MW["Request wrapper<br/>request ID, start/done logs"]
        RL["Rate limit check"]
        API["API routes<br/>(Next.js route handlers)"]
        AUTH["Auth + permission helper<br/>checks token, role, shop"]
        VAL["Input validation"]
        MW --> RL --> AUTH --> VAL --> API
    end
    RL <--> UP[("Upstash Redis<br/>rate-limit counters")]
    API <--> DB[("Neon Postgres<br/>app data + service vectors<br/>+ log table")]
    API -->|embed text| EMB["OpenAI embeddings"]
    API <--> BL[("Vercel Blob<br/>photos")]
    MW -->|"JSON log lines"| LOGS["Vercel log stream"]
    MW -->|"redacted log rows"| DB
    SA["Super Admin dashboard"] -->|reads logs, metrics, vitals| API
```

## One request, start to finish: a client books an appointment

```mermaid
sequenceDiagram
    participant C as Client browser
    participant W as Request wrapper
    participant R as Rate limit (Upstash)
    participant A as Auth + permissions
    participant H as Booking route
    participant D as Neon Postgres
    participant L as Logs (stream + table)

    C->>W: POST /api/appointments {proId, serviceId, startsAt}
    W->>L: request_start (debug)
    W->>R: too many attempts?
    R-->>W: no
    W->>A: valid token? role = client? shop matches?
    A-->>W: yes, user + shop
    W->>H: run the route
    H->>H: validate body, check booking window and open time
    H->>D: look up style-card time estimate, else service default
    H->>D: insert appointment (database rejects overlaps)
    D-->>H: saved (or conflict)
    H-->>W: 201 {appointment}
    W->>L: request_done {method, route, status, ms, requestId}
    W-->>C: 201 JSON
    Note over H,L: If anything throws: request_failed (error) with route, status, message only. The client gets a short friendly error, not a stack trace.
```

## One search request: query to ranked results

```mermaid
flowchart LR
    Q["Client types 'lashes'"] --> E["Embed the query<br/>(OpenAI)"]
    E --> S["Compare to every service vector<br/>(pgvector in Neon)"]
    S --> R["Ranked services, closest first<br/>with pros who offer them"]
    R --> LG["Log semantic_search:<br/>query length, result count, top score, ms"]
```

## Where each safety layer sits
| Layer | What it does |
|---|---|
| Request wrapper | Gives every request an ID and logs its edges once, for all routes. |
| Rate limit | Stops floods on login, sign-up, booking, and search. |
| Auth + permission helper | One shared function reads `docs/permissions.md` rules: role and shop, on the server. |
| Validation | Rejects bad input before it touches the database. |
| Log redaction | Strips passwords, tokens, emails, phones from log details before they are saved anywhere. |
| Database | Final guard: foreign keys and the no-overlap rule for appointments. |
