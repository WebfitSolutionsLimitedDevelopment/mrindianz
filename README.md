# Mr. IndiaNZ 2027 — website, registration, admin & People's Choice voting

Production domain: **https://www.mrindianz.co.nz** · Organiser: Rhythm House Events & Films · Development: Webfit Solutions Limited

Next.js (App Router, TypeScript strict) · Tailwind CSS v4 · Supabase (Postgres, Auth, Storage, RLS) · Zod · Stripe Checkout (disabled until approved) · Resend · Vercel.

## What's included

| Area | Where |
|---|---|
| Public site (home, about, competition, FAQ, partners, tickets, contact, legal drafts) | `src/app/(site)` |
| Four-step free registration with private photo uploads | `src/app/(site)/apply`, `src/components/forms/apply-form.tsx`, `src/app/api/apply/upload-url` |
| Contestant gallery, permanent profile URLs, QR codes (PNG/SVG/print) | `src/app/(site)/contestants`, `src/app/api/qr/[slug]`, `src/app/(print)` |
| People's Choice: packages, supporter checkout, leaderboard, history | `src/app/(site)/peoples-choice`, `src/components/voting` |
| Stripe Checkout + verified webhook (idempotent, refunds, disputes) | `src/app/(site)/peoples-choice/actions.ts`, `src/app/api/stripe/webhook`, `src/lib/payments` |
| Vote ledger, order pricing, RLS, audit — all in SQL | `supabase/migrations` |
| Admin dashboard (roles, applications, contestants, voting, transactions, CMS, media, partners, FAQs, messages, email, settings, users, audit) | `src/app/admin` |
| Zod schemas (client + server) | `src/lib/validation` |
| Tests: unit, DB/RLS/ledger (PGlite), webhook, Playwright e2e | `tests/`, `e2e/` |

Key rules enforced in code:
- **Payments are off** unless `PAYMENTS_ENABLED=true` and Stripe keys/mode are consistent; production requires live keys, non-production requires test keys.
- Prices and vote counts are **read from the database** (`create_voting_order`); the browser only sends IDs and a quantity.
- Votes are credited **only by the signature-verified webhook**, once per order (unique index), never from the success URL.
- Vote totals are **derived from the append-only `vote_ledger`**; refunds/disputes add negative entries.
- Demo votes (`payment_mode = 'demo'`) exist only on the demo campaign and are never shown when `APP_ENV=production`.
- Applicant photos live in a **private bucket**; admins see 10-minute signed URLs.
- Registration opens only when `REGISTRATION_ENABLED=true`, eligibility/age/terms/privacy approvals are recorded in Settings, and the date window is current.
- QR codes in production always encode `https://www.mrindianz.co.nz/contestants/<permanent-slug>`.

## Local setup

```bash
npm ci
cp .env.example .env.local            # fill Supabase URL/keys for a dev project
# Apply the schema (Supabase CLI, linked to your DEV project):
npx supabase link --project-ref <dev-ref>
npx supabase db push                  # applies supabase/migrations/*
psql "$DATABASE_URL" -f supabase/seed.sql   # optional demo data (NEVER on production)
npm run admin:bootstrap -- you@example.com  # needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env
npm run dev
```

Tests:

```bash
npm run typecheck && npm run lint
npm test                    # unit + database (PGlite, no network) + webhook tests
npm run build
npx playwright install chromium && npm run test:e2e   # or PW_CHANNEL=chrome to use installed Chrome
```

Regenerate the initial CMS content migration after editing `src/lib/content/defaults.ts`: `npm run content:sql` (it only inserts missing rows; it never overwrites organiser edits).

See **docs/DEPLOYMENT.md** for staging/production, domain, Stripe and Resend checklists, and **docs/PRODUCTION-READINESS.md** for the verification status.
