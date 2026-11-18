# Supabase setup — shared with Miss India South Pacific (`cregrerrzywgvbkyjlmg`)

**Decision (18 Nov 2026, organiser):** Mr. IndiaNZ uses the Miss India South Pacific Supabase project for staging and production, as the same organiser runs both events. Isolation is by schema (`mrindianz`) and bucket names.

Everything Mr. IndiaNZ creates lives in the **`mrindianz` schema** and the buckets **`mrindianz-applications`** (private) and **`mrindianz-public`**. Nothing in `public` is created, changed or revoked.

## Steps (about 10 minutes)

1. **Back up first.** Dashboard → Database → Backups: confirm a recent backup exists (the script is additive, but this is a live site's project).
2. **Run the schema.** Dashboard → SQL Editor → New query → paste all of `supabase/setup/01-mrindianz-schema.sql` → **Run**.
   - It runs as one transaction: on any error nothing changes.
   - **Check the result grid at the bottom.** It must show **no rows**. Any row is an existing Miss India storage policy that isn't limited to a bucket and would also expose Mr. IndiaNZ applicant photos — send it to the developer before opening applications.
3. **Staging only:** run `supabase/setup/02-mrindianz-demo-seed.sql` (demo campaign + 6 placeholder contestants). Never on production.
4. **Expose the schema to the API.** Dashboard → Project Settings → Data API → **Exposed schemas** → add `mrindianz` → Save. (Without this the website can't read anything.)
5. **Auth URLs.** Authentication → URL Configuration → **Redirect URLs** → add:
   - `https://mrindianz-git-staging-kiwihelps-projects.vercel.app/admin/auth/callback`
   - `https://www.mrindianz.co.nz/admin/auth/callback` (for later)
   Do **not** change the Site URL (it belongs to Miss India).
6. **Vercel env vars** (Project mrindianz → Settings → Environment Variables, Preview):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://cregrerrzywgvbkyjlmg.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon / publishable key
   - `SUPABASE_SERVICE_ROLE_KEY` = the service-role key (mark **Sensitive**; never paste it in chat)
   Then redeploy the `staging` branch.
7. **First admin:** `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… NEXT_PUBLIC_SITE_URL=https://mrindianz-git-staging-kiwihelps-projects.vercel.app npm run admin:bootstrap -- you@example.com`
   (If the email already has a Miss India login, it is reused — only a Mr. IndiaNZ role is added.)

## Known trade-offs of sharing

- Admin invite / password-reset emails use the project's (Miss India) email templates and sender.
- One service-role key can read both sites' data — keep it in Vercel only.
- Compute, storage quotas and backups are shared.
- Staging and production read the SAME data. Never run `02-mrindianz-demo-seed.sql` once real contestants exist; demo profiles (slug `demo-…`) are hidden on production as a safeguard.

## Undo (removes ONLY Mr. IndiaNZ)

```sql
drop schema mrindianz cascade;
delete from storage.objects where bucket_id in ('mrindianz-applications','mrindianz-public');
delete from storage.buckets where id in ('mrindianz-applications','mrindianz-public');
drop policy if exists "mrindianz: public media readable" on storage.objects;
drop policy if exists "mrindianz: editors upload public media" on storage.objects;
drop policy if exists "mrindianz: editors update public media" on storage.objects;
drop policy if exists "mrindianz: editors delete public media" on storage.objects;
```
