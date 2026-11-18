# Deployment

## Environments

| | Supabase project | Vercel environment | `APP_ENV` | Stripe | Seed/demo |
|---|---|---|---|---|---|
| Development | dev project | local | development | test keys or none | allowed |
| Staging | **separate** staging project | Preview | staging | **test** keys only | allowed (`DEMO_VOTING_ENABLED=true` optional) |
| Production | **separate** production project | Production | production | **live** keys, only after approval | **never** run `seed.sql` |

## Staging (Vercel preview)

1. Create the staging Supabase project (region ap-southeast-2). In Auth → URL configuration add `https://<preview-domain>/admin/auth/callback` to the redirect allow-list.
2. Apply migrations: `npx supabase link --project-ref <staging-ref> && npx supabase db push`. Optionally run `supabase/seed.sql`.
3. In Vercel → Project → Settings → Environment Variables (**Preview** scope): set everything in `.env.example`. Use `APP_ENV=staging`, `NEXT_PUBLIC_SITE_URL=https://<staging-domain>`, `PAYMENTS_ENABLED=false`.
4. Push a branch → Vercel builds a preview. Bootstrap an admin: `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… NEXT_PUBLIC_SITE_URL=https://<staging-domain> npm run admin:bootstrap -- you@example.com`.
5. Run e2e against it: `E2E_BASE_URL=https://<staging-domain> npm run test:e2e`.

## Production

Do **not** proceed until the approvals in PRODUCTION-READINESS.md are recorded.

1. Create the production Supabase project; `npx supabase db push` (no seed). Enable Point-in-Time Recovery / daily backups; enable MFA for admin users; set Auth redirect URL `https://www.mrindianz.co.nz/admin/auth/callback`; set Site URL to `https://www.mrindianz.co.nz`.
2. Vercel **Production** env vars: `APP_ENV=production`, `NEXT_PUBLIC_SITE_URL=https://www.mrindianz.co.nz`, Supabase keys, Resend, `REGISTRATION_ENABLED` (true only on launch day), `PAYMENTS_ENABLED=false`, `DEMO_VOTING_ENABLED=false`, `ALLOW_UNAPPROVED_POLICIES=false`, `RATE_LIMIT_SALT`, `CRON_SECRET`.
3. Deploy `main` to production on the `*.vercel.app` URL first and smoke-test.
4. Bootstrap the first Super Admin (command above, production keys) and record approvals in /admin/settings.

### Domain (requires explicit approval — changes the live website)

1. Vercel → Project → Domains: add `www.mrindianz.co.nz` (primary) and `mrindianz.co.nz` → **Redirect to www (308)**.
2. At the DNS host: `www` CNAME → `cname.vercel-dns.com`; apex A → `76.76.21.21` (or as Vercel instructs). Lower TTL beforehand.
3. HTTPS certificates are issued automatically. The app also redirects the apex host in `next.config.ts`.
4. Verify: `curl -I https://mrindianz.co.nz` → 308 to `https://www.mrindianz.co.nz/`; `/robots.txt` allows indexing; `/sitemap.xml` lists www URLs.

### Rollback

- Code: Vercel → Deployments → previous production deployment → **Instant Rollback**.
- Database: migrations are additive. Restore from Supabase PITR if data is damaged. Never delete ledger rows; correct via adjustment entries.
- Payments emergency stop: set `PAYMENTS_ENABLED=false` and redeploy, or set the campaign status to **Paused** in /admin/voting (takes effect immediately).

## Stripe checklist (keep payments disabled until every box is ticked)

- [ ] Organiser confirms the receiving Stripe account (NZ entity, payouts, statement descriptor "MR INDIANZ").
- [ ] Voting packages approved (replace the demonstration values in /admin/voting; untick "Demo value").
- [ ] GST and card processing-fee treatment approved (set the price note; Stripe Tax if required).
- [ ] Voting rules and refund/dispute policy approved (Settings → Legal → Voting rules approved; bump the rules version).
- [ ] Webhook endpoint `https://<domain>/api/stripe/webhook` with events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `refund.created`, `refund.updated`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`.
- [ ] Staging test: card `4242 4242 4242 4242` → votes credited once; resend the event from the Stripe dashboard → no double credit; refund in dashboard → votes removed; `stripe trigger charge.dispute.created` path verified.
- [ ] Production: `STRIPE_MODE=live`, live keys, `PAYMENTS_ENABLED=true`, one real low-value purchase refunded end-to-end.

The NZ$350 contestant fee has its own table (`contestant_fee_payments`) and flag (`CONTESTANT_FEE_PAYMENTS_ENABLED`) and is **not** wired to checkout until fee, GST, due date and refund terms are approved.

## Resend checklist

- [ ] Verify the sending domain (`mrindianz.co.nz`) in Resend: SPF, DKIM, and a DMARC record.
- [ ] `RESEND_API_KEY`, `EMAIL_FROM="Mr. IndiaNZ <noreply@mrindianz.co.nz>"`, `ADMIN_NOTIFICATION_EMAIL`.
- [ ] Submit a staging application → `/admin/email` delivery log shows `sent`.
- Until configured, emails are logged as `not_configured` and the success page does **not** claim an email was sent.

## Supabase Auth settings

- Disable public sign-ups (Auth → Providers → Email → "Allow new users to sign up" off). Admins are invited by a Super Admin.
- Enable MFA (TOTP) and require it for admins. Minimum password length 12.
