-- READ-ONLY inspection of the existing database. Changes nothing.
-- Paste into Supabase → SQL Editor → Run. Copy the single "report" value and send it to the developer.
-- It returns STRUCTURE ONLY (names, columns, policies) — no rows, no personal data.
select jsonb_pretty(jsonb_build_object(
  'postgres_version', version(),
  'schemas', (select jsonb_agg(nspname order by nspname) from pg_namespace
              where nspname not like 'pg_%' and nspname <> 'information_schema'),
  'mrindianz_schema_exists', exists (select 1 from pg_namespace where nspname = 'mrindianz'),
  'extensions', (select jsonb_agg(extname || ' (' || n.nspname || ')' order by extname)
                 from pg_extension e join pg_namespace n on n.oid = e.extnamespace),
  'tables', (select jsonb_object_agg(t.table_schema || '.' || t.table_name, jsonb_build_object(
                'rls', c.relrowsecurity,
                'approx_rows', greatest(c.reltuples, 0)::bigint,
                'columns', (select jsonb_agg(col.column_name || ' ' || col.data_type order by col.ordinal_position)
                            from information_schema.columns col
                            where col.table_schema = t.table_schema and col.table_name = t.table_name)))
             from information_schema.tables t
             join pg_class c on c.relname = t.table_name
             join pg_namespace n on n.oid = c.relnamespace and n.nspname = t.table_schema
             where t.table_schema not in ('pg_catalog','information_schema','auth','storage','realtime','supabase_functions','extensions','graphql','graphql_public','pgsodium','pgsodium_masks','vault','net','cron','supabase_migrations','_realtime','pgbouncer')
               and t.table_type = 'BASE TABLE'),
  'views', (select jsonb_agg(table_schema || '.' || table_name) from information_schema.views
            where table_schema not in ('pg_catalog','information_schema','extensions','graphql','graphql_public','vault','realtime','storage','auth','pgsodium','pgsodium_masks')),
  'functions', (select jsonb_agg(n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
                  || case when p.prosecdef then ' SECURITY DEFINER' else '' end order by 1)
                from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname in ('public') or n.nspname not in ('pg_catalog','information_schema','extensions','graphql','graphql_public','vault','realtime','storage','auth','pgsodium','pgsodium_masks','net','cron','supabase_functions','pgbouncer','_realtime','supabase_migrations','pg_toast')),
  'enum_types', (select jsonb_agg(n.nspname || '.' || t.typname order by 1) from pg_type t
                 join pg_namespace n on n.oid = t.typnamespace
                 where t.typtype = 'e' and n.nspname not in ('pg_catalog','auth','storage','realtime','extensions','graphql','vault','pgsodium')),
  'rls_policies', (select jsonb_agg(jsonb_build_object('table', schemaname || '.' || tablename, 'policy', policyname,
                     'cmd', cmd, 'roles', roles, 'using', qual, 'check', with_check))
                   from pg_policies where schemaname not in ('auth','realtime')),
  'triggers', (select jsonb_agg(event_object_schema || '.' || event_object_table || ': ' || trigger_name)
               from information_schema.triggers where event_object_schema not in ('pg_catalog','realtime','storage','supabase_functions')),
  'auth_users_count', (select count(*) from auth.users),
  'storage_buckets', (select jsonb_agg(jsonb_build_object('id', id, 'public', public, 'size_limit', file_size_limit, 'mime', allowed_mime_types)) from storage.buckets),
  'storage_object_counts', (select jsonb_object_agg(bucket_id, n) from (select bucket_id, count(*) n from storage.objects group by bucket_id) s)
)) as report;
