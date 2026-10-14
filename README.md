# Kestrel PM Agent

Demo of an AI maintenance scheduling agent for property managers: tenant and vendor SMS threads, owner-approval chasing, vendor insurance expiry chasing, and a "Today" queue across all three tracks.

Hono + SQLite, server-rendered HTML with htmx. It runs fully offline: no LLM key, no external API. Reply classification and date extraction are local heuristics, and the demo data is seeded deterministically every time the app starts.

## Deploy your own copy on Railway

1. Fork this repo into your own GitHub account (Fork button, top right of this page).
2. In Railway: **New Project > Deploy from GitHub repo** and pick your fork. Railway reads `railway.json` and builds with the `Dockerfile`. The first build takes a few minutes.
3. In the service: **Settings > Networking > Generate Domain**. Open the URL.
4. Optional, to keep demo state between deploys: add a **Volume** to the service with mount path `/data`. Without a volume the database is rebuilt and reseeded on every deploy, which is fine for demos.

No environment variables are required.

## Environment variables (all optional)

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | Port the server listens on. Railway sets this for you. |
| `DATABASE_PATH` | `/data/app.db` | SQLite file. Point it at the volume mount if you add one. |
| `APP_NAME` | `Kestrel Maintenance Scheduling Agent` | Display name. |
| `APP_BASE_URL` | empty | Public URL, used to verify Twilio webhook signatures. |
| `TWILIO_AUTH_TOKEN` | empty | When set, webhook signature verification turns on. |
| `TWILIO_FROM_NUMBER` | empty | Outbound SMS number for a live cutover. |
| `TWILIO_MESSAGING_SERVICE_SID` | empty | Alternative to a from-number. |

`REQUIRE_PASSWORD` and `SMS_OUTBOUND_ENABLED` appear in `.env.example` but are not enforced by the code. SMS outbound is toggled from the Admin page and stored in the database.

## Run locally

Needs Node 20 and pnpm 9 (`corepack enable` gives you pnpm).

```bash
pnpm install
cp .env.example .env
pnpm dev
```

On Windows use `copy .env.example .env`. The app is at http://localhost:8080. For the production build: `pnpm build` then `pnpm start`.

## Notes

- There is no login. Anyone with the URL can use the demo, so keep real data out of it.
- The Twilio webhook lives at `/webhooks/twilio`. With no auth token set it accepts every call and logs it.
- If you change `src/db/schema.sql`, bump `SCHEMA_VERSION` in `src/db/client.ts`. On a version mismatch the app drops every table and rebuilds from the seed.
