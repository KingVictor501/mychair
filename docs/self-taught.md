# Self-taught: login sessions with `jose`

## What it is

MyChair keeps people logged in with a signed session token made by the `jose` package. After one successful login, the server signs a token that says who you are (user ID, role, shop, and whether it's a demo session) and puts it in an httpOnly cookie. The browser sends it with every request, so you aren't asked for your password on every page. If anyone changes the token, the signature no longer matches and the server refuses it.

It runs in the live app at https://mychair-eta.vercel.app on every login, for every role. The code is in `lib/auth/session.ts`.

## Why I chose it

I searched for how to make a server remember that someone is logged in so it doesn't ask for a password on every page, and `jose` came up. It carries a token across each page of the browser to keep the user logged in.

I also want to turn MyChair into a mobile app in the future, and this was the best route. A mobile app can't rely on browser cookies, but it can store the same signed token and send it with each request (in an `Authorization: Bearer` header). The website and a future iPhone or Android app can share one login system, with the same rules checked on the server, instead of my building a second one later.

## How I learned it

I watched a YouTube video on it first, then mostly asked Claude to explain it, and then read the code in `lib/auth/session.ts`.

I didn't really get confused, because I already understood the concepts: tokens, signing, cookies and expiry. What was new to me was the `jose` package itself. I learned enough to use it correctly, but I didn't take the deep dive I should have, for the sake of time. I plan to in the future.

## How it's set up

- **Signing:** `SignJWT` signs the token with HS256 using `SESSION_SECRET`, which lives in `.env.local` and in Vercel, never in the code.
- **Expiry:** a normal login lasts 7 days. A Super Admin "view as" session lasts 1 hour.
- **Checking:** `jwtVerify` checks the signature and the expiry on every request. A bad or expired token means you're treated as logged out.
- **Storage:** the cookie is httpOnly (scripts on the page can't read it), secure on HTTPS, and SameSite=Lax.

## How I checked it works

I logged in and clicked around without entering my password again.

The automated tests (`lib/auth/auth.test.ts`, run with `npm test`) also cover it:
- a signed token reads back what was signed
- a tampered token is refused (role changed to `super_admin`)
- a token signed with a different secret is refused
- an expired token is refused
- an unsigned token is refused

## What I want to learn next

How `jose` signs tokens under the hood, by better understanding how the package flows from start to finish.
