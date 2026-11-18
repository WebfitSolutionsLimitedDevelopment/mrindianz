/**
 * Builds one paste-able SQL file for the Supabase SQL Editor from supabase/migrations.
 * Output: supabase/setup/01-mrindianz-schema.sql (+ 02-mrindianz-demo-seed.sql for staging only).
 * Run: npm run setup:sql
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = "supabase/migrations";
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const header = `-- =============================================================================
-- Mr. IndiaNZ 2027 — full database setup (generated ${new Date().toISOString().slice(0, 10)} from supabase/migrations)
-- Paste into Supabase Dashboard → SQL Editor and click Run. Runs as ONE transaction:
-- if anything fails, nothing is changed.
--
-- Safe for a SHARED project: every table, type and function is created in the
-- "mrindianz" schema. Nothing in the "public" schema is created, altered or revoked.
-- Storage buckets are named mrindianz-applications (private) and mrindianz-public.
-- =============================================================================

begin;

-- Pre-flight: refuse to run twice, and refuse if the bucket names are already taken.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'mrindianz')
     and exists (select 1 from pg_tables where schemaname = 'mrindianz') then
    raise exception 'Schema "mrindianz" already has tables — setup was already run. Nothing changed.';
  end if;
  if exists (select 1 from storage.buckets where id in ('mrindianz-applications', 'mrindianz-public')) then
    raise exception 'A storage bucket named mrindianz-* already exists. Nothing changed.';
  end if;
end $$;
`;
const body = files.map((f) => `\n-- ---------------------------------------------------------------------------\n-- ${f}\n-- ---------------------------------------------------------------------------\n${readFileSync(join(dir, f), "utf8")}`).join("\n");
const footer = `
commit;

-- -----------------------------------------------------------------------------
-- Post-install checks (results appear below after Run)
-- -----------------------------------------------------------------------------
-- 1) Storage policies from OTHER sites that are NOT limited to a bucket would also apply to
--    Mr. IndiaNZ applicant photos. This should return NO rows. If it returns rows, stop and
--    send them to the developer before collecting any applications.
select policyname, cmd, roles, qual as using_expression
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and policyname not like 'mrindianz:%'
   and coalesce(qual, '') not like '%bucket_id%'
   and coalesce(with_check, '') not like '%bucket_id%';
`;
mkdirSync("supabase/setup", { recursive: true });
writeFileSync("supabase/setup/01-mrindianz-schema.sql", header + body + footer);
writeFileSync("supabase/setup/02-mrindianz-demo-seed.sql",
  `-- STAGING / DEMO ONLY — never run on the production project.\nbegin;\n${readFileSync("supabase/seed.sql", "utf8")}\ncommit;\n`);
console.log(`wrote supabase/setup (${files.length} migrations)`);
