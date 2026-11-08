# MyChair – API Design

A REST API: the web app and the future mobile apps call the same URLs. All business rules (permissions, double-booking, prices) live in these routes, never only in browser code.

## Conventions
- Base path: `/api`. Data is JSON.
- **Web login** uses an httpOnly cookie holding a signed, expiring token. **Mobile** will send the same token as `Authorization: Bearer <token>`.
- Success: the data, with status 200/201. Failure: `{ "error": { "code": "FORBIDDEN", "message": "Friendly short text" } }`. Never a stack trace.
- Statuses: 400 bad input, 401 not logged in, 403 not allowed, 404 not found (or not yours), 409 conflict (double-booking), 429 too many requests.
- Every write validates its body on the server. Responses never include `password_hash`, tokens, or `pay_*` fields unless the caller is owner or Super Admin.
- "Public" means no login needed. Everything else is protected and follows `docs/permissions.md`.
- Rate limited (by IP and account): login, sign-up, booking, search.

## Endpoints

### Health and tracking
| Method | URL | Request body | Response | Who |
|---|---|---|---|---|
| GET | `/api/health` | none | `{ "status": "ok" }` (and confirms DB reachable) | Public |
| POST | `/api/vitals` | `{ page, metric, value, rating }` | 204 | Public (rate limited) |

### Auth
| Method | URL | Request body | Response | Who |
|---|---|---|---|---|
| POST | `/api/auth/signup` | `{ name, email, password, phone? }` | 201 `{ user }` and sets cookie | Public (creates a client) |
| POST | `/api/auth/login` | `{ email, password }` | 200 `{ user }` and sets cookie | Public |
| POST | `/api/auth/logout` | none | 204 | Protected (any role) |
| GET | `/api/me` | none | `{ user }` | Protected (any role) |
| POST | `/api/auth/join` | `{ inviteToken, name, email, password, phone? }` | 201 `{ user }` as a pro | Public (needs a valid invite) |

### Shop and team
| Method | URL | Request body | Response | Who |
|---|---|---|---|---|
| GET | `/api/shop` | none | shop name, time zone, booking rules | Protected (any role) |
| PATCH | `/api/shop` | `{ name?, timezone?, defaultBookingWindowDays?, cancellationWindowHours? }` | `{ shop }` | Owner, Super Admin |
| POST | `/api/invites` | `{ role: "pro" }` | 201 `{ inviteUrl, expiresAt }` | Owner, Super Admin |
| GET | `/api/team` | none | list of pros (pay fields only for owner and Super Admin) | Protected |
| PATCH | `/api/team/[proId]` | `{ role?, stationNumber?, payType?, payAmount?, priceMode? }` | `{ pro }` | Owner, Super Admin |

### Services, prices, pros
| Method | URL | Request body | Response | Who |
|---|---|---|---|---|
| GET | `/api/services` | none | list of services with standard prices | Protected |
| POST | `/api/services` | `{ name, description, defaultDurationMin, standardPriceCents }` | 201 `{ service }` (re-embeds it) | Owner, Super Admin |
| PATCH | `/api/services/[id]` | any of the above fields | `{ service }` (re-embeds it) | Owner, Super Admin |
| GET | `/api/pros` | `?serviceId=` optional | pros with role, status, services, effective prices | Protected |
| GET | `/api/pros/[id]` | none | one pro (404 if fake ID) | Protected |
| PUT | `/api/pros/[id]/services` | `{ serviceIds: [] }` | updated list | The pro themself, Owner, Super Admin |
| PUT | `/api/pros/[id]/prices` | `{ prices: [{ serviceId, priceCents }] }` | updated list | Owner, Super Admin |
| PATCH | `/api/pros/[id]/status` | `{ liveStatus }` | `{ liveStatus }` | The pro themself, Owner, Super Admin |
| PATCH | `/api/pros/[id]/booking-window` | `{ days }` | `{ days }` | The pro themself, Owner, Super Admin |

### Search
| Method | URL | Request body | Response | Who |
|---|---|---|---|---|
| GET | `/api/search/services` | `?q=lashes` | ranked list `{ service, score, pros[] }`, closest first | Protected |

### Availability
| Method | URL | Request body | Response | Who |
|---|---|---|---|---|
| GET | `/api/pros/[id]/availability` | `?date=YYYY-MM-DD&serviceId=` | open start times in the shop's time zone | Protected |
| PUT | `/api/pros/[id]/hours` | `{ rules: [{ weekday, start, end, kind }] }` | saved rules | The pro themself, Owner, Super Admin |
| PUT | `/api/pros/[id]/time-off` | `{ ranges: [{ startsOn, endsOn }] }` | saved ranges | The pro themself, Owner, Super Admin |

### Appointments
| Method | URL | Request body | Response | Who |
|---|---|---|---|---|
| POST | `/api/appointments` | `{ proId, serviceId, startsAt }` | 201 `{ appointment }`, or 409 if the time is taken | Client (own), Owner, Super Admin |
| GET | `/api/appointments` | `?from=&to=` | client: own. Pro: own. Owner: whole shop. | Protected |
| GET | `/api/appointments/[id]` | none | one appointment (404 if not yours) | Protected |
| PATCH | `/api/appointments/[id]` | `{ startsAt }` (reschedule) | `{ appointment }` | Client (own), Pro (own), Owner, Super Admin |
| DELETE | `/api/appointments/[id]` | none | 204 (sets status to cancelled) | Client (own, outside window), Pro (own), Owner, Super Admin |
| PATCH | `/api/appointments/[id]/status` | `{ status }` | `{ appointment }` | Pro (own), Owner, Super Admin |
| PATCH | `/api/appointments/[id]/payment` | `{ paymentStatus }` | `{ appointment }` | Pro (own), Owner, Super Admin |

### Clients and style cards
| Method | URL | Request body | Response | Who |
|---|---|---|---|---|
| GET | `/api/clients` | none | pro: own clients as `{ id, name, phone }` only | Pro, Owner, Super Admin |
| GET | `/api/clients/[id]/style-card` | none | the caller's style card for this client | Pro (own or shared), Owner, Super Admin |
| PUT | `/api/clients/[id]/style-card` | `{ preferences, notes, usualServiceId, timeEstimateMin }` | `{ styleCard }` | Pro (own card), Super Admin |
| POST | `/api/style-cards/[id]/photos` | multipart file (JPG, PNG, WebP, max 5 MB) | 201 `{ photo }` | Pro (own card), Super Admin |
| DELETE | `/api/style-cards/[id]/photos/[photoId]` | none | 204 | Pro (own card), Super Admin |
| PUT | `/api/style-card-shares` | `{ fromProId, toProId, enabled }` | `{ share }` | Owner, Super Admin |

### Super Admin only
| Method | URL | Request body | Response | Who |
|---|---|---|---|---|
| GET | `/api/admin/logs` | `?level=&event=&route=&from=&to=&cursor=` | log page | Super Admin |
| GET | `/api/admin/metrics` | `?range=1h\|24h\|7d&source=logs\|table` | requests, errors, median and p95 latency over time. `logs` calculates from `log_entries`; `table` reads `metrics_minutely`. Default `table`. | Super Admin |
| GET | `/api/admin/vitals` | `?range=` | web vitals grouped by page | Super Admin |
| GET | `/api/admin/stack-links` | none | links read from env variables | Super Admin |
| GET | `/api/admin/embeddings` | none | `{ embeddedCount, serviceCount }` read from the vector table | Super Admin |
| POST | `/api/admin/embeddings` | none | re-embeds every service (safe to repeat) | Super Admin |
| POST | `/api/admin/view-as` | `{ userId }` | starts an audited session | Super Admin |

## Mobile-readiness
- Same URLs and rules for web and mobile; only the token travels differently (cookie vs. Bearer header).
- No route returns HTML. Allowed web origins are locked to our own site (never `*`); the mobile app doesn't use browser CORS.
- Version prefix (`/api/v1`) can be added later without changing the design.
