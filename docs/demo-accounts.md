# Demo accounts

Every demo account is made up. Emails are at `example.com` and phone numbers are in the reserved 555-01xx range, so nothing here reaches a real person. All demo accounts share one password: the `DEMO_PASSWORD` setting (in `.env.local` locally, and in Vercel for the live site). It is never written in code or docs.

Demo accounts only work while **demo mode** is on (Super Admin → Demo). With demo mode on, `/demo` also opens any owner or pro view in one click, with no password.

## Quick picks

| To see | Log in as |
|---|---|
| Owner view | `ben.fadefactory@example.com` |
| Pro view | `ray.fadefactory@example.com` |
| Client view | `chris.fadefactory@example.com` |
| Super Admin | your own Super Admin account (not a demo account) |
| No login | **Book without an account** (`/guest`), or `/demo` |

## Super Admin

| Email | Notes |
|---|---|
| Your own email (from the Super Admin script) | The real Super Admin. Its own password, not the demo one. |
| `alex.admin@example.com` | Demo Super Admin. Kept out of the admin tools on purpose: demo visitors can't change demo mode, reset data or view as anyone. |

## Fade Factory (barbershop)

Emails end in `.fadefactory@example.com`. Client phones are (212) 555-0111 to 0116, in the order listed.

| Email | Role | Notes |
|---|---|---|
| `ben.fadefactory@example.com` | Owner | |
| `ray.fadefactory@example.com` | Pro (Master barber) | Custom prices. Lets other pros book for him. Your clients: Chris, Tyler |
| `tia.fadefactory@example.com` | Pro (Barber) | Lets other pros book for her. Your clients: Marcus, Daniel |
| `leo.fadefactory@example.com` | Pro (Barber) | Your clients: Andre, Owen |
| `chris.fadefactory@example.com` | Client | Preferred pro: Ray |
| `tyler.fadefactory@example.com` | Client | Preferred pro: Ray |
| `marcus.fadefactory@example.com` | Client | Preferred pro: Tia |
| `daniel.fadefactory@example.com` | Client | Preferred pro: Tia |
| `andre.fadefactory@example.com` | Client | Preferred pro: Leo |
| `owen.fadefactory@example.com` | Client | Preferred pro: Leo |

## Gloss & Tips (nail salon)

Emails end in `.glossandtips@example.com`. Client phones are (305) 555-0111 to 0116, in the order listed.

| Email | Role | Notes |
|---|---|---|
| `paula.glossandtips@example.com` | Owner | |
| `annie.glossandtips@example.com` | Pro (Senior nail tech) | Lets other pros book for her. Your clients: Rachel, Nicole |
| `gina.glossandtips@example.com` | Pro (Nail tech) | Lets other pros book for her. Your clients: Diana, Faith |
| `penny.glossandtips@example.com` | Pro (Nail tech) | Your clients: Grace, Hannah |
| `rachel`, `nicole`, `diana`, `faith`, `grace`, `hannah` | Clients | Preferred pros as above |

## Flutter Lash Lounge (lash studio)

Emails end in `.flutter@example.com` (shorter than the other shops). Client phones are (415) 555-0111 to 0116, in the order listed.

| Email | Role | Notes |
|---|---|---|
| `lana.flutter@example.com` | Owner | |
| `vera.flutter@example.com` | Pro (Lead lash artist) | Lets other pros book for her. Your clients: Whitney, Bianca |
| `cleo.flutter@example.com` | Pro (Lash artist) | Lets other pros book for her. Your clients: Fiona, Monica |
| `lou.flutter@example.com` | Pro (Lash artist) | Your clients: Tessa, Lauren |
| `whitney`, `bianca`, `fiona`, `monica`, `tessa`, `lauren` | Clients | Preferred pros as above |

## Drop-in clients

Each shop also has 320 drop-in clients, so client lists and schedules look like a real shop. Their emails look like `jordan.17.fadefactory@example.com` (first name, a number, the shop), and their phones use 555-0120 to 0199 across four area codes per shop. They don't have a preferred pro, and there's no need to log in as them.

The list comes from `lib/demo/catalog.ts`. `npm run demo:reset` (or Reset demo on `/admin`) puts it all back to a clean state.
