# MyChair – Roles and Permissions

This is the rulebook. Every route checks it **on the server**, using one shared permission helper. Hiding a button is not security.

Two rules apply to every row below:
- **Shop rule:** a user can only touch records with their own `shop_id`. (Super Admin is the only exception.)
- **Ownership rule:** "own" means the record belongs to that user. "Their" client means a client who has an appointment or style card with that pro.

**Super Admin has no limits:** every row is ✅ for Super Admin, in any shop.

Legend: ✅ allowed, ❌ not allowed, 🔸 allowed with a limit (explained in the notes column).

An owner who also cuts hair has both the Owner and Pro columns.

| Action | Super Admin | Owner | Pro | Client | Notes |
|---|---|---|---|---|---|
| **Accounts** | | | | | |
| Sign up as a client | ✅ | ✅ | ✅ | ✅ | open to anyone |
| Join as a pro | ✅ | ❌ | 🔸 | ❌ | only through a pro invite link, or by an account the owner or Super Admin created for them |
| Create a pro account for someone | ✅ | 🔸 | ❌ | ❌ | owner: own shop only. They enter the pro's name, email, and role. **The owner never sets or sees the password:** the pro gets a one-time setup link and chooses their own. |
| Create a pro invite link | ✅ | ✅ | ❌ | ❌ | the link lets a pro sign up and join the shop |
| Create a client invite link | ✅ | 🔸 | 🔸 | ❌ | pro: a link for their own page only. Owner: only if they also work as a pro. The app does **not** send texts: the pro copies or shares the link and sends it from their own phone. |
| Log in / log out | ✅ | ✅ | ✅ | ✅ | |
| View or edit own account | ✅ | ✅ | ✅ | ✅ | |
| **Shop** | | | | | |
| Create a shop | ✅ | ❌ | ❌ | ❌ | one shop for now |
| Edit shop settings (name, time zone, booking rules) | ✅ | 🔸 | ❌ | ❌ | owner: own shop only |
| **Team and pay** | | | | | |
| View list of pros | ✅ | ✅ | ✅ | ✅ | clients see name, status, services, prices only |
| Change a pro's role | ✅ | ✅ | ❌ | ❌ | a pro cannot change their own role |
| Set station number | ✅ | ✅ | ❌ | ❌ | |
| See pay structure | ✅ | ✅ | ❌ | ❌ | hidden from pros and clients |
| Set pay structure | ✅ | ✅ | ❌ | ❌ | |
| **Services and prices** | | | | | |
| View services and prices | ✅ | ✅ | ✅ | ✅ | |
| Create or edit a service (name, description, duration) | ✅ | ✅ | 🔸 | ❌ | pro: only adds or removes services on their own list |
| Set standard prices | ✅ | ✅ | ❌ | ❌ | |
| Set a pro's custom prices or turn "Standard price" on | ✅ | ✅ | ❌ | ❌ | |
| Semantic service search | ✅ | ✅ | ✅ | ✅ | |
| **Schedule** | | | | | |
| Edit own hours, breaks, days off | ✅ | ✅ | ✅ | ❌ | |
| View any pro's schedule in the shop | ✅ | ✅ | 🔸 | ❌ | pro: own only |
| Set own live status | ✅ | ✅ | ✅ | ❌ | |
| Extend own booking window beyond 5 days | ✅ | ✅ | ✅ | ❌ | pro: own window only |
| See a pro's open times | ✅ | ✅ | ✅ | ✅ | |
| **Appointments** | | | | | |
| Book an appointment | ✅ | ✅ | ❌ | 🔸 | client: for themselves, inside the pro's booking window |
| View appointments | ✅ | 🔸 | 🔸 | 🔸 | owner: whole shop. Pro: own. Client: own. |
| Reschedule or cancel | ✅ | ✅ | 🔸 | 🔸 | client: own, outside the cancellation window. Pro: own appointments. |
| Change status (in chair, completed, no-show) | ✅ | ✅ | 🔸 | ❌ | pro: own appointments only. Allowed order: waiting → in chair → completed; waiting → no-show; waiting or in chair → cancelled |
| Set payment status | ✅ | ✅ | 🔸 | ❌ | pro: own appointments only (record only, no real payments) |
| **Clients and style cards** | | | | | |
| View a client | ✅ | ✅ | 🔸 | ❌ | pro: **only their own clients, and only name, phone, style card.** Never email. |
| View client email (if the client gave one) | ✅ | ✅ | ❌ | 🔸 | client: own only. Phone is required for clients and is visible to their pros. |
| Create or edit a style card | ✅ | ❌ | 🔸 | ❌ | pro: only their own cards |
| View a style card | ✅ | ✅ | 🔸 | ❌ | pro: own cards, or cards another pro shared with them |
| Upload a style card photo | ✅ | ❌ | 🔸 | ❌ | own cards only. JPG, PNG, WebP, max 5 MB |
| Grant or remove style-card sharing between two pros | ✅ | ✅ | ❌ | ❌ | the pros must ask the owner |
| See the no-show count | ✅ | ✅ | 🔸 | ❌ | pro: for their own clients. Strikes are counted per shop. They are a record only and never block booking. |
| Remove a no-show strike | ✅ | ✅ | 🔸 | ❌ | pro: only for an appointment they were reserved for (for example, the pro was running late). The owner can see all strikes and removals. |
| **Super Admin tools** | | | | | |
| View logs | ✅ | ❌ | ❌ | ❌ | |
| View metrics and web performance | ✅ | ❌ | ❌ | ❌ | |
| View stack links | ✅ | ❌ | ❌ | ❌ | |
| Run or view service embedding status | ✅ | ❌ | ❌ | ❌ | |
| Run a semantic-search test in the dashboard | ✅ | ❌ | ❌ | ❌ | |
| "View as" another user (audited) | ✅ | ❌ | ❌ | ❌ | every session is logged |

## Client invite links
- A client invite link opens the sign-up page with that pro already chosen, so the new client is that pro's client right after signing up.
- It is active for 24 hours and can be used once. It counts as used only after the client's account is created successfully, so a failed sign-up (for example, a typo) does not burn the link. The pro can make another one at any time.
- The link is a random secret stored hashed (same design as pro invites). Creating links is rate limited.
- The link never contains the client's name, phone, or email.

## Notes for later
- **Owner as a pro:** the owner needs their own "pro" view on the dashboard so they can take and schedule their own appointments, switching between the owner view and the pro view. Not built yet; the owner column already allows booking and schedule actions.

## What each failure returns
- Not logged in: **401**.
- Logged in but not allowed (wrong role): **403**.
- A record in another shop, or another pro's client: **404** (so we don't confirm it exists).
- Rate limit hit: **429**.
