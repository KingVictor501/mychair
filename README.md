# MyChair

Booking and client management for barbershops (one shop for now).

**Live site:** https://mychair-eta.vercel.app
**Health check:** https://mychair-eta.vercel.app/api/health (should show `{"status":"ok"}`)

## Run it on your computer
1. `npm install`
2. Copy the variable names from `.env.example` into a new file named `.env.local` and fill in your own Neon `development` connection string.
3. `npm run dev`, then open the address it prints (usually http://localhost:3000).

## Docs
- [Decision document](docs/decision-document.md)
- [Data model](docs/data-model.md)
- [Permissions](docs/permissions.md)
- [API design](docs/api-design.md)
- [System diagram](docs/system-diagram.md)

(This README grows as the build does. Test accounts and the full run/test guide are added in the final section.)
