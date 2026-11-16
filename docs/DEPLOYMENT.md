# Deploying the PLAN-IT pilot

The repository contains the application and setup tools. Supabase, Google, an SMS provider, Turnstile and Vercel must still be configured in your accounts. The code cannot choose approved partners, commercial prices or legal terms. Live-provider checks remain required after the credentials are installed.

## 1 Choose your environments

Create separate Supabase projects for staging and production, preferably in Mumbai. Use the Vercel **Preview** environment for staging values and **Production** for production values. Never point staging at the production database. Use a stable staging hostname for OAuth and Turnstile rather than allowing every random preview hostname.

Import the repository into Vercel, select **Other**, use the repository root, Node.js 22 or newer, no framework/build command, and `public` as the output directory. `vercel.json` supplies server functions, deep-link routing and security headers. Do not enable `LOCAL_DEMO` on Vercel; it is ignored there even in Preview.

There is no automatic production deployment or migration script in the build. Run migrations explicitly against the selected database, then redeploy the matching Vercel environment. Use a protected branch or manual promotion for production.

## 2 Fill the environment values

Copy `.env.example` to ignored `.env.local` for local setup commands. Add the same applicable values directly in the Vercel environment settings, selecting Preview or Production as appropriate.

| Variable | Source | Visibility |
| --- | --- | --- |
| `DATABASE_URL` | Supabase Connect: transaction pooler, port 6543 | Server secret |
| `DATABASE_MIGRATION_URL` | Optional session pooler/direct connection for migration commands | Server secret |
| `DATABASE_CA_CERT` | Optional trusted PostgreSQL root CA PEM from Supabase if required for verification | Server configuration |
| `SUPABASE_URL` | Supabase project URL | Public |
| `SUPABASE_ANON_KEY` | Supabase publishable key or legacy anon key | Public; never service-role/secret |
| `TURNSTILE_SITE_KEY` | Turnstile widget for the matching hostname(s) | Public |
| `TURNSTILE_SECRET` | Secret for that Turnstile widget | Server secret |
| `SITE_URL` | Exact HTTPS site origin, without a path | Public |
| `WHATSAPP_NUMBER` | Approved organiser number with country code, digits only | Public |
| `SUPPORT_EMAIL` | Approved support email | Public |
| `AUTH_PHONE_ENABLED`, `AUTH_GOOGLE_ENABLED` | `true` for enabled providers, `false` to hide an intentionally unavailable method | Public feature controls |

Do not paste real keys in chat, issues or PRs. Do not add `.env.local` to Git. Google and SMS-provider client secrets belong in Supabase's provider settings; the app does not need copies of them. The Supabase service-role key is not required by this architecture. TLS certificate verification stays enabled; `DATABASE_SSL=false` is accepted only for a loopback test database.

Check names and formats without connecting to providers:

```sh
npm ci
npm run setup:check
```

The command prints only names, status and guidance, never secret values. Missing configuration does not enable a demo account: the public catalogue is read-only and signup/booking are unavailable.

## 3 Configure Google and phone authentication

In Supabase Auth:

1. Set the site URL to the correct deployed origin.
2. Allow that exact origin followed by `/auth/callback` in redirect URLs. Add localhost only in the development/staging project if needed.
3. Enable Google. Create a Google OAuth web client and copy its client ID/secret into Supabase. Use Supabase's displayed callback URL as the Google client's authorized redirect URI. The website's `/auth/callback` is the application return URL, not Google's Supabase callback.
4. Enable phone sign-in and configure a supported SMS provider. Complete provider/country sender registration required for Indian destinations. Enter its credentials in Supabase and test delivery to a real number you control.
5. Enable Supabase Auth CAPTCHA with **Turnstile** and the widget secret. Match the app's public site key with that secret. Allow the production/staging hostname in the widget dashboard.
6. Configure Supabase's own OTP rate limits and SMS frequency/cost controls. The app additionally enforces five sends/hour/number, but direct calls to Supabase must also be protected.

The app sends the phone CAPTCHA token directly to Supabase once in `gotrue_meta_security.captcha_token`. Waitlist tokens are redeemed separately with Cloudflare Siteverify, including a hostname check. Do not verify the phone token a second time on your own server: tokens are single-use. Dynamic forms explicitly mount and reset their widgets when navigating or retrying.

## 4 Create the schema and initial catalogue

```sh
npm run db:migrate
npm run setup:check -- --online
```

The migration command uses `DATABASE_MIGRATION_URL` if set and otherwise `DATABASE_URL`. It locks the migration, applies numbered SQL files in order, records checksums, enables RLS, revokes browser-role access and seeds catalogue records without overwriting edited content. Re-running is safe. Changing an already recorded migration is rejected: add a new numbered SQL file instead.

The readiness check verifies connectivity, expected tables and destination seeds, row security and denied browser privileges. The online setup command also checks publicly reported Auth provider settings. It cannot prove SMS delivery, the secret/widget pairing or a completed OAuth login; those require the real-browser steps below.

The database is accessed only by trusted server code. Do not grant the browser `anon` or `authenticated` roles direct access to the pilot tables.

## 5 Assign organiser accounts

Have each organiser sign in once so the app creates their profile. Find their Supabase Auth user UUID. Preview the role change, then apply deliberately:

```sh
npm run account:role -- --user <auth-user-uuid> --role admin
npm run account:role -- --user <auth-user-uuid> --role admin --apply
```

Use `ops` for booking operations without price/content administration, and `member` to remove organiser privileges. The command logs a role audit entry and prints only UUID/role. Price changes require the admin to verify phone OTP within five minutes; Google-only sign-in does not bypass reauthentication.

## 6 Enter approved launch content

In `/admin`, enter verified partners, actual room capacities and photos you can use, route extras, approved prices and effective dates, cancellation slabs, platform fees and GST. Set `SUPPORT_EMAIL` and confirm the WhatsApp number. No commercial values are inferred from the PRD. A booking without an approved price and policy stays disabled.

Approve final terms/privacy/cancellation text and a retention/deletion process before accepting live bookings. Configure daily backups and point-in-time recovery in Supabase, then test restoration independently.

## 7 Optional legacy waitlist import

Leave the old Blob endpoint/store intact until the owner decides whether to import. First run a dry-run against an exported JSON array or directly against the private store:

```sh
npm run waitlist:import -- --file /absolute/path/to/waitlist-export.json
# Or put BLOB_READ_WRITE_TOKEN in .env.local, then:
npm run waitlist:import -- --blob
```

By default records without explicit consent evidence are skipped. The original endpoint checked consent before storing only email/interest/signup timestamp. If the owner verifies that all selected records came from that consented endpoint, use `--confirm-legacy-consent`. Withdrawn/deleted/unsubscribed or explicitly nonconsenting records are always skipped. Preview before applying:

```sh
npm run waitlist:import -- --blob --confirm-legacy-consent
npm run waitlist:import -- --blob --confirm-legacy-consent --apply
```

The import preserves signup/consent timestamps and interest, leaves unknown names/colleges null, deduplicates normalized email, and never deletes Blob data or overwrites an existing lead. It prints counts, not personal records. Repeating it does not add duplicate leads. Remove the Blob credential from the setup environment when finished if no longer needed.

## 8 Verify staging, then production

Set `SMOKE_BASE_URL` in `.env.local` to the deployed staging origin, or let the command use `SITE_URL`:

```sh
npm run test:staging
```

For a protected Vercel preview, add `VERCEL_AUTOMATION_BYPASS_SECRET`. Optional short-lived `SMOKE_USER_ACCESS_TOKEN` and `SMOKE_OPS_ACCESS_TOKEN` test a real session and organiser authorization. These are server-side test inputs only; never add them to public assets or GitHub logs. The script performs read-only probes and does not create leads/bookings or send SMS.

A manual GitHub workflow, **Check configured staging**, can run the same probes. Set the staging environment's `SITE_URL` variable and optional secrets; it does not deploy or migrate anything.

Complete these browser checks with real providers:

- Home, direct pack/stay links, mobile navigation and catalogue.
- Waitlist challenge and a consented signup; repeat and verify deduplication.
- Google login, SMS OTP, invalid/expired codes and retrying after CAPTCHA expiry.
- Member trip/invite, priced booking, customer revision, organiser confirmation and in-app notification.
- Role restrictions, recent-OTP price edits, cancellation snapshot and customer contact draft.
- Production health and signup after promotion; Lighthouse/mobile performance and error monitoring.

`/health/live` only reports that the function runs. `/health` and `/ready` require usable configuration, seeded schema and database isolation; they return 503 until ready and contain no secrets. Configure your uptime service against `/health` and Vercel logs/alerts for errors. Do not mark the production issue complete based only on local tests.

## Provider references

- [Supabase phone authentication](https://supabase.com/docs/guides/auth/phone-login)
- [Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha)
- [Supabase PostgreSQL connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Cloudflare explicit widget rendering](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/)
- [Cloudflare token verification](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json)
