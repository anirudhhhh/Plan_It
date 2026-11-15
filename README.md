# PLAN-IT

A campus travel pilot for IIT Patna: destination packs, assisted stay and ride requests, group trip boards, shared expenses, and an operations console for organisers. Implements the launch scope of the supplied Technical PRD (8 November 2026) while retaining the existing vanilla JavaScript/Vercel stack and brand assets.

## Run the local demo

Requires Node.js 22 or later.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:3000**. The yellow bar identifies **LOCAL DEMO** and lets you switch between Student, Travel buddy, Ops and Admin. Use two personas to try an invitation, expense and payment confirmation. Demo records persist in ignored `.local/data.json`. This mode is loopback-only, sends no OTP or messages, and never collects payments. Production ignores `LOCAL_DEMO`.

The seed deliberately contains **no prices and no cancellation policies**. Packs are proposed itineraries. Stay templates are unpublished and appear only in the labelled demo. No accommodation partners, availability, rates, fees, refund percentages or support email are invented. To test requests, use Admin to create a policy and price, then publish a listing. Those values are local test data, not approved commercial terms.

## What's implemented

- Responsive home with six scoped features, destination interests, consented waitlist, campaign/rep attribution, QR landing, about/contact and policy routes.
- Pack filters, itinerary details, inclusions, group price tables and creating a trip from a pack.
- Stay filters by dates, guests, destination, type, total budget, group suitability and known distance; room selection and price breakdown.
- Campus ride form with one-way/return selection, return date/time, pickup instructions, capacity checks and separately priced outbound/return legs. Transfers include Patna Airport, Bihta Railway Station and Danapur Railway Station in both directions.
- Group trip board with live linked booking cards, itinerary item removal, editable name/dates/budget, revocable invites, RSVP, ownership transfer and leaving after settlement. Departed members remain in historical accounting records.
- Equal, percentage and custom expense splits with deterministic paise rounding; edit/delete, balances, greedy settlements, recipient confirmation, WhatsApp summaries and UPI links when a member supplies a UPI ID.
- WhatsApp enquiry drafts update from selected ride routes/times, pack dates/group sizes and stay rooms/guests. Follow-ups include request status and the frozen quote.
- Booking quotes recomputed on the server, stale-price rejection, editable pending requests, trip attachment/moving/detachment, version checks, saved quote revisions, customer cancellation and audited status history. No online payment collection.
- In-app Updates inbox for customers and organisers, unread counts, mark-read controls and 15-second refresh while the app is open. Customer requests and status changes create durable notices. External email/WhatsApp notifications are not configured.
- Organiser queue search by customer/contact/request/service/route; direct customer WhatsApp, call, email and copy-contact actions. These open drafts or native contact actions without sending automatically.
- Admin forms for packs, itinerary days, stays, rooms, ride partners, routes, policies and prices; audited price edits requiring recent OTP; ops request queue, assignment/driver details and manual WhatsApp handoff; protected CSV export.
- Supabase phone OTP and Google PKCE authentication, durable OTP/request/lead limits, Turnstile verification, server role checks and database isolation from browser roles.
- PostgreSQL migration/seed, metadata and public detail HTML rendered on the server, JSON-LD, sitemap, robots, installable manifest, public-asset-only service worker, health endpoint, structured error logs and GitHub Actions checks.

Tickets, payments, polls, automated messaging, reviews, checkout splitting and live tracking remain later-phase features. Tickets clearly show Phase 2. The original private Vercel Blob waitlist endpoint is preserved for existing integrations; the new app uses `/api/v1/leads`. Existing Blob signups are not automatically copied into PostgreSQL.

## Production setup

1. Create separate local/staging/production Supabase projects in Mumbai. Configure **phone OTP** with an SMS provider and **Google** OAuth. Allow the exact site's `/auth/callback` redirect. Configure Supabase's own OTP send limits to **at most five per hour per number**, as the public Auth endpoint can be called without the app's proxy. Enable Auth CAPTCHA and use the same Turnstile integration.
2. Copy `.env.example` to `.env.local` and set PostgreSQL, Supabase, Turnstile and canonical `SITE_URL` values. Never put a database password or service-role key in a public asset. Use the trusted server PostgreSQL connection with certificate verification; `DATABASE_SSL=false` is only for a trusted local database.
3. Run `npm run db:migrate`, including when upgrading an existing pilot database for notifications and linked-booking indexes. It creates the pilot tables, enables RLS, revokes browser-role access, creates indexes and inserts repeatable UUID catalogue seeds without overwriting edited records.
4. Sign in normally once to create your user profile. A trusted database administrator assigns roles; users cannot assign their own role:

   ```sql
   UPDATE public.users
   SET data = jsonb_set(data, '{role}', '"admin"'::jsonb)
   WHERE id = 'the-authenticated-user-uuid';
   ```

   Use `"ops"` for operations staff. Reopen the account after a role change. Price edits require an OTP sign-in within five minutes, including for admins who usually use Google.
5. In the console, enter approved partners, room capacities, photos you own, pickup/drop rules, refund slabs, partner costs, margins, fees, GST and validity dates. Money is **integer paise**. Percentage margins and GST are **basis points** (`100` means `1%`). Publish only confirmed listings and activate approved prices. Every price needs a policy.
6. Run `npm run check`, `npm test` and the browser tests. Start the configured server with `node --env-file=.env.local server/http.js`, or deploy the Vercel repository with the same environment values. Preview and production must use separate databases. No deployment is performed by this implementation.
7. Complete the remaining launch decisions in `IMPLEMENTATION.md`: legal approval, retention, actual prices, backup/monitoring configuration and real-provider staging verification.

### Deployment details

`api/[...path].js` handles `/api/v1/*`. `api/page.js` renders the shell and detail metadata; Vercel rewrites support deep links. `/health` checks database availability through the API. `/sitemap.xml` uses `SITE_URL`. All new API responses use `{data: ...}` or `{error: {code, message, details}}` and `no-store`. Unknown routes get the branded client 404 view.

Production roles come from the private database, never user-editable Auth metadata. Browser sessions live in sessionStorage; no service credentials reach the browser. No private API, trip, request or account data is cached by the service worker. Only a member can edit a trip; a current invite token permits guest board viewing. WhatsApp opens a draft; the user chooses whether to send it.

## Architecture choice

The PRD explicitly allows a SPA plus a server as an alternative. This repository was a small static site, so it stays **vanilla ES modules + CSS + Node/Vercel functions**, with shared Zod validation and PostgreSQL via parameterized `pg` queries. It does not introduce Next.js, React, Tailwind, React Query or React Hook Form. Server HTML/metadata supports public catalogue links; the browser handles interactive forms and navigation.

Pilot domain entities are stored in separate **UUID-keyed JSONB tables**, rather than the PRD's proposed fully normalized column schema. Records preserve the PRD's field names, money representation, entity relationships and audit history. All application mutations use one database transaction with an advisory lock, including prices, booking snapshots and expense changes. Browser `anon`/`authenticated` roles have no table grants or RLS policies, and server endpoints enforce per-user/member/role access. A trusted server connection is required. Do not connect the frontend directly to these tables.

This prioritizes an atomic, small-pilot implementation. It loads the pilot dataset per transaction and serializes writes; it is **not a large-scale data access layer**. Normalize columns and foreign keys and replace whole-dataset reads with indexed, entity-specific queries before scaling beyond the small pilot. A disposable PostgreSQL 14 cluster verified the migration, UUID persistence, transaction rollback, serialized concurrent writes and denied browser roles. Supabase provider integration and deployed performance targets still need staging verification.

## Verification

```sh
npm run check
npm test
npx playwright install chromium
npm run test:e2e
# Optional, with initdb/pg_ctl on PATH: disposable PostgreSQL verification
node scripts/test-postgres.js
```

On a Mac with Chrome installed, browser tests can use it directly:

```sh
CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:e2e
```

Tests run on desktop and a 360 px viewport using an isolated local demo database (`.local/e2e.json`, reset at each test-server start). Unit/API tests cover paise reconciliation, room capacity, surcharge overlap, cancellations, authorization, invite revocation, price snapshots, booking lifecycle and CSV formula protection. Browser tests exercise catalogues, trip invites, expenses, waitlist, admin access and an approved stay booking through ops confirmation. Test records and reports are ignored by Git.

## Existing waitlist and assets

`api/waitlist.js` remains compatible with the original private Vercel Blob store. It returns aggregate counts publicly and stores one record per normalized email; see its source for the SHA-256 record path. The original generated hero photograph and brand mark remain in `public/assets/`. The displayed photo is illustrative, not proof of a specific destination or partner.

## Booking and trip workflow rules

Pending requests (`Submitted` or `In review`) can be revised by their customer. The server validates current availability rules, recalculates the quote and checks the expected record revision. Saving returns the request to `Submitted`, clears an old driver/ops assignment, preserves the former quote in the private audit record, and alerts organisers. Confirmed/closed requests cannot be revised. Organisers cannot confirm a stale revision.

A customer may attach, move or detach their request using a trip they belong to. The board contains one linked item per booking; changes to dates, price and status update it. Members remove ordinary itinerary items they authored; owners can remove any ordinary item. Linked items are managed from the request rather than deleted as notes.

Trip owners can edit the name, dates and budget or transfer ownership to an active member. Transfer rotates the invite token. Leaving requires zero balance, no pending payment confirmations and no personal booking still linked to the trip. Owners transfer ownership first. Historical accounting remains recorded; expenses involving a departed member cannot change until they rejoin.

Return rides use an approved outbound fare and an approved matching reverse-route fare for the selected vehicle and dates. If either is absent, the total stays unavailable and the WhatsApp draft can be used for an enquiry. Each leg saves its own cancellation policy. Pickup instructions and return details appear in requests and WhatsApp drafts.
