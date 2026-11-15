# PRD implementation and launch checklist

Source: Desktop `prd.docx`, Technical PRD v1.0, 8 November 2026. This is an implementation record, not a sign-off on commercial or legal terms.

## Launch requirements

| PRD module | Delivered |
| --- | --- |
| TP-1–TP-4 | Destination/theme catalogue, details/itinerary, group prices, pack-to-trip creation, server-quoted requests |
| GT-1–GT-4 | Trips, revocable guest invite, member join, board, RSVP, owner member removal |
| ST-1–ST-5 | Unified catalogue, room selection, date/guest/budget/type/group/distance filters, unit prices, policies, breakdown and requests |
| RD-1–RD-4 | Campus pickup/drop/time/passengers/vehicle, capacity checks, fixed-price lookup, custom fallback, driver assignment and extras |
| SP-1–SP-4 | Expenses, exact equal/percentage/custom splits, balances, recipient-confirmed settlements; expense changes preserve settlement records |
| AC-1–AC-5 | Waitlist, consent/attribution, phone/Google sign-in adapters, contact, interest events; automated notifications deferred |
| AD-1–AD-4 | Catalogue/policy/price forms, effective dates, audited edits with OTP reauthentication, request queue and CSV export |
| Additional P1 | WhatsApp split summary, member-provided UPI deep link |

The greedy settlement algorithm meets the PRD's N−1 bound. As with the algorithm in the PRD, this is not a claim of a globally minimum number of transactions for every balance arrangement.

## Deliberate technical adaptations

- Retained vanilla JavaScript/CSS and Node/Vercel rather than replacing the site with the recommended Next.js/React stack. Zod is shared across server forms, requests and domain validation; native HTML constraints provide immediate browser feedback.
- PostgreSQL entities use UUID primary keys and JSONB documents with uniqueness indexes. Default-deny RLS plus revoked browser-role grants restrict database access to the server. User/member/owner/ops/admin checks occur on each server operation. The fully normalized relational design, foreign keys and per-row client policies are not implemented.
- A transaction advisory lock makes pilot changes atomic and avoids lost updates across Vercel instances. Dataset loading is intentionally bounded to the pilot design; scalability and the 400 ms API target have not been claimed.
- API validation and domain tests use Node's built-in test runner rather than Vitest. Browser tests use Playwright, as proposed.
- Analytics events are stored privately in the database. No GA/PostHog/Sentry account is assumed; external dashboards, alerts and uptime schedules need configuration.
- PWA caches only public static assets. Account/trip/API offline data is deliberately not persisted by the service worker.
- Catalogue updates reach the client immediately through uncached API reads; public Vercel metadata HTML may be cached for up to two minutes. The implementation does not use Next.js ISR.

## Required before accepting live users

- [ ] The organisers fill and sign Annex A prices, fees, tax treatment and refund windows. No approved prices were present in the source PRD.
- [ ] Verify real partners, accommodation addresses/capacities/photos and ride extra-charge rules. Demo stays are templates, not actual inventory.
- [ ] Supply production/staging database and authentication configuration. Run migration and test with real Supabase JWTs, OTP provider and Google redirect, including expired sessions, CAPTCHA and OTP rate limits.
- [ ] Configure Supabase's own rate limits/CAPTCHA. App proxy limits alone cannot restrict direct public Auth requests.
- [ ] Approve final terms/privacy/cancellation policies, support email and retention/deletion process. Current public policies identify the pilot and pending approvals.
- [ ] Configure daily backups and seven-day point-in-time recovery in the selected Supabase plan; perform a restore test.
- [ ] Configure error monitoring, uptime alerts and an ops response rota. `/health`, structured errors and private analytics events are implemented; external services are not provisioned.
- [ ] Run a real PostgreSQL/Supabase integration smoke test with simultaneous writes. The disposable local PostgreSQL 14 test passes for migration, persistence, rollback, concurrent writes and browser-role isolation. Run the same checks against staging Supabase and verify actual provider integration with its credentials.
- [ ] Measure LCP/CLS, gzip budget and p95 API performance on a deployed 4G profile. No live performance/availability claim has been made.
- [ ] Protect production deployments with a manual approval in Vercel/environment settings; use separate staging data. CI runs checks and browser flows, but does not deploy production.
- [ ] If retaining historic waitlist signups, migrate the original private Blob records deliberately, preserving original consent and attribution. The old endpoint/store is retained.

## Later phases

Packs customization, polls, ticket requests/IRCTC compliance, student reviews/moderation, automated notifications, checkout split selection, Razorpay/webhooks/refunds, live inventory and tracking remain deferred. No Student Deals or comparison page is present. The app includes no gateway orders, train ticket purchases, online money movement or claims of partner-confirmed availability.

## Verification completed locally

- 27 domain/API/security tests passed.
- 22 Playwright tests passed across desktop and 360 px mobile.
- JavaScript syntax checks passed.
- Disposable PostgreSQL 14 integration passed: migration/seed, UUID persistence, rollback, serialized concurrent writes, denied browser roles and a persisted API-created trip. The cluster was stopped and removed.
- Dependency audit: zero known vulnerabilities after overriding the inherited outdated Zod dependency with a compatible patched 4.x version.
- Desktop and mobile screenshots inspected. External OAuth/SMS/CAPTCHA delivery and deployed performance remain unverified.

## Additional booking and trip workflows

Implemented customer edits before confirmation with server repricing and revision checks; live booking attachment/moving/detachment on trip boards; organiser queue search and direct customer contact drafts; a persistent in-app notification inbox; trip name/date/budget editing; itinerary-item removal; ownership transfer; settled-member departure preserving financial history; and one-way/return rides with return departure and pickup instructions.

Run the existing idempotent migration again for the new notifications table and linked-booking uniqueness index. In local demo mode, missing state collections initialize automatically. No old records are deleted. Notifications are polled every 15 seconds while the app is open; external messaging remains unconfigured.
