# Production readiness — status as of 18 Nov 2026

✅ = verified by an executed check · ⚠️ = partly verified · ❌ = not verified yet (needs credentials/infrastructure) · 🔒 = approval needed

| # | Check | Status | Evidence / what's missing |
|---|---|---|---|
| 1 | Build passes | ✅ | `npm run build` (Next.js 16.4.6) |
| 2 | TypeScript strict | ✅ | `npm run typecheck` |
| 3 | Lint | ✅ | `npm run lint` — 0 errors, 0 warnings |
| 4 | Migrations apply | ⚠️ | All migrations except Storage apply cleanly to PostgreSQL in PGlite (`tests/db`). Not yet applied to a real Supabase project. |
| 5 | RLS policies | ⚠️ | 15 RLS tests pass on PGlite with Supabase-equivalent roles. Re-run Supabase security advisors after first `db push`. |
| 6 | Registration persists data | ❌ | Client journey e2e passes; server persistence needs a Supabase project. |
| 7 | Uploads private | ⚠️ | Private bucket + signed URLs implemented, MIME sniffing tested; not exercised against real Storage. |
| 8 | Admin permissions | ⚠️ | Role matrix unit-tested, RLS tested, unauthenticated access e2e tested; signed-in admin UI not yet exercised. |
| 9 | Contestant publishing | ⚠️ | DB rules tested (slug permanence, draft visibility); admin UI flow needs Supabase. |
| 10 | QR codes resolve | ⚠️ | Canonical-URL logic unit-tested; QR route needs a published contestant to test end-to-end. |
| 11 | Voting calculations | ✅ | Server pricing, quantities, ties, freeze, visibility — DB tests |
| 12 | Payment placeholder | ✅ | e2e: no pay button without configuration; server returns `payments_disabled` |
| 13 | Webhook idempotency | ✅ | Signed-event tests: duplicates, out-of-order refunds, disputes, mode mismatch, tampered amount |
| 14 | Mobile layouts | ✅ | No horizontal overflow at 320/375/390/430/768/1024/1440/1920 (Chrome) on key pages; screenshots reviewed |
| 15 | Accessibility | ⚠️ | Semantic structure, labels, focus, reduced motion, error summaries implemented; no automated axe audit or screen-reader pass yet |
| 16 | SEO | ✅ | Titles, canonicals, OG, sitemap, robots (blocks non-production), Event + FAQ + Breadcrumb JSON-LD |
| 17 | Secrets not committed | ✅ | `.env*` ignored except `.env.example`; no keys in repo |
| 18 | Demo data separated | ✅ | `payment_mode='demo'` only on demo campaign; production hides demo campaign; tested |
| 19 | Approvals identified | ✅ | See below; shown in /admin/settings |
| 20 | Critical security issues | ⚠️ | None known. Independent review + Supabase advisors recommended before launch |

Browsers: Chrome desktop + Chrome mobile emulation tested. Safari, Firefox, Edge not tested.

## Approvals required before launch 🔒

1. Eligibility definitions — organiser and NZ legal review (heritage/residency wording).
2. Minimum age policy (proposed: 18 on 3 April 2027).
3. Contestant agreement/terms, privacy statement, website terms (drafts in `src/lib/content/legal.ts`).
4. NZ$350 fee: GST treatment, due date, coverage, withdrawal/refund policy.
5. Final tagline; registration open/close dates; audition and finalist dates.
6. People's Choice: package prices (current values are DEMONSTRATION only), GST/processing-fee presentation, voting rules, refund/dispute policy, voting dates.
7. Stripe receiving account; Resend sender domain; official contact email and social links.
8. Approved photography, partner logos, ticketing URL.
9. Domain cut-over to Vercel (DNS change) — explicit approval required.
