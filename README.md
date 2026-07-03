# Job Hackers — EEC Landing Page (with A/B testing + admin)

A Next.js (App Router) landing page for the Job Hackers **Email Education Course**,
modeled on the Ship 30 "Kickstarter" landing pattern and built in the JobHackers
brand. It runs a live **A/B test** between the two EEC versions, enrolls signups
into the matching **Resend** sequence, and tracks every registration in **Supabase**.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

- **Landing page:** `/`
- **Admin panel:** `/admin` (sign in with a **username + password**; seed users
  with `npm run seed:admin` — see [Admin users](#admin-users))

Secrets live in `.env.local` (already filled in for this project). They are read
**server-side only** — the Resend and Supabase keys are never shipped to the browser.

## The two versions

| Variant | Name | Resend sequence | Tag name | Version |
|---|---|---|---|---|
| **A** | The Job Hacker Kickstarter | `kickstarter` (`jobhacker.kickstarter.subscribed`) | `KICKSTARTER` | v4 |
| **B** | The AI Job Search Repair Kit | `repairkit` (`jobhacker.repairkit.subscribed`) | `REPAIRKIT` | v3 |

## How the A/B test works

- A visitor is assigned a variant by a **weighted random split** across the *enabled*
  versions, then it's **stuck to a cookie** (`jhg_eec_variant`) so they always see the
  same one.
- Preview a specific version: `/?variant=A` or `/?variant=B`. Add `?debug=1` to show a
  variant badge.
- Set the split in **`/admin`**:
  - Toggle each version **On/Off**.
  - Drag each version's **weight**, or use presets: **100% A**, **100% B**, **75/25**,
    **25/75**, **50/50**. The effective split is shown live.
- Editing copy: the admin can edit **every text field** of each version (hero, book
  cover, stats, the full curriculum list, CTAs, success message) plus the routing
  (sequence + tag name + version label). Click **Save changes**.

Config is stored in `data/eec-config.json` and read by the landing page on every
request. (No DB migration needed for the admin to work.)

## Signup flow (`POST /api/subscribe`)

1. Validates the email + variant.
2. **Persists the lead** to `public.jobhackers_leads` with:
   - `stage` = `acquisition`
   - `tag` = `EVENT->REGISTRATION->EEC->{EEC_NAME}->{VERSION}`
     (e.g. `EVENT->REGISTRATION->EEC->KICKSTARTER->v4`)
   - `source` = `?source=` / `?utm_source=` / `?ref=` from the URL, else `direct`
   - `variant` = `A` / `B`
3. **Enrolls in Resend** by firing the sequence's trigger event — **only for brand-new
   rows**. Idempotency is enforced by the table's `UNIQUE (email, tag, stage)`
   constraint: a duplicate insert returns 409, so the same person is never enrolled in
   the same sequence twice.

> The Resend Automations must be **enabled** in the Resend dashboard for emails to
> actually send. While disabled, the event is accepted but nothing drips.

## Project layout

```
app/
  page.tsx                  landing (server) — resolves + sticks the variant
  components/
    LandingPage.tsx         the 4-section page (hero / stats / curriculum / final)
    SignupForm.tsx          client form -> /api/subscribe
    StickVariant.tsx        persists the assigned variant cookie
  admin/
    page.tsx                guarded server page -> AdminDashboard
    AdminDashboard.tsx      traffic split + content editor
    login/page.tsx          password login
  api/
    subscribe/route.ts      lead + Resend enrollment
    admin/{login,logout,config}/route.ts
lib/
  resendSequences.ts        enrollInSequence(email, sequence)
  supabaseLeads.ts          recordLead(...) + buildTag(...)
  abConfig.ts / abAssign.ts config read/write + weighted assignment
  adminAuth.ts              signed-cookie admin session
  types.ts
data/eec-config.json        editable A/B config (source of truth)
public/brand, public/fonts, public/assets   JobHackers design system
supabase/migrations/        leads table DDL (for portability)
```

## Environment variables

See `.env.example`. Server-side only:
`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `KIT_API_KEY`,
`ADMIN_SESSION_SECRET`, and admin credentials (`ADMIN_USERS` or the legacy
`ADMIN_USERNAME` / `ADMIN_PASSWORD`).

**Before going live:** seed at least one admin user (`npm run seed:admin`) or
set `ADMIN_USERS`, and set a long random `ADMIN_SESSION_SECRET`.

## Admin users

The `/admin` panel authenticates against **Supabase Auth (GoTrue)**: admins
sign in with their Supabase Auth **email + password**. Authorization is gated by
the existing `public.admins` allowlist — an email must be present there to
enter `/admin`. On success the app issues an HMAC-signed session cookie.

No password column or migration is needed: credentials live in Supabase Auth.

**Create/update an admin** (creates or password-resets the Supabase Auth user
and adds them to the `public.admins` allowlist):

```bash
npm run seed:admin -- --username you@example.com --password 'a-strong-password'
npm run seed:admin -- --list                     # list allowlisted admins
npm run seed:admin -- --remove you@example.com   # remove from allowlist (revoke)
npm run seed:admin -- --verify -u you@example.com -p 'a-strong-password'
```

The seed script needs `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (read from
`.env.local`); if set, `SUPABASE_ANON_KEY` is used for the password grant.
Credentials may also come from `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD`.

This works on serverless (Vercel) as-is, since credentials are in Supabase — no
local file required. When Supabase isn't configured (pure local dev), login
falls back to `ADMIN_USERS` / a legacy `ADMIN_PASSWORD`.

## Image uploads

The admin cover uploader stores images in **Supabase Storage** (public bucket
`eec-assets`, under `covers/`) and saves the returned public URL — so it works
on serverless (Vercel). Create the bucket once (public, image mime types) in the
Supabase dashboard, or it can be created via the Storage API with the service
key. Without Supabase configured (local dev) it falls back to writing
`public/assets/uploads/`.

## Deploying

Works on any Node host (Vercel, Fly, a VM). On serverless platforms the `data/`
JSON file isn't writable at runtime, so to keep admin edits there move the config
to Supabase (a small `eec_config` table) — the read/write seam is isolated in
`lib/abConfig.ts`. For a single long-running Node server, the JSON file is fine.
