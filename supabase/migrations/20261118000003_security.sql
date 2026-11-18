-- Row Level Security, grants, audit triggers and status history.
-- Principle: anon/authenticated get NOTHING by default; access is granted explicitly per table and
-- then narrowed by RLS policies. Privileged writes (applications, orders, ledger) go through the
-- server using the service role or SECURITY DEFINER functions.

-- ---------------------------------------------------------------------------
-- Status history + audit triggers
-- ---------------------------------------------------------------------------
create or replace function mrindianz.log_application_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into mrindianz.application_status_history (application_id, from_status, to_status, changed_by, note)
    values (new.id, null, new.status, auth.uid(), 'Application submitted');
  elsif new.status is distinct from old.status then
    insert into mrindianz.application_status_history (application_id, from_status, to_status, changed_by,
      note)
    values (new.id, old.status, new.status, auth.uid(), nullif(current_setting('app.status_note', true), ''));
  end if;
  return new;
end $$;
create trigger applications_status_history after insert or update of status on mrindianz.applications
  for each row execute function mrindianz.log_application_status();

-- Generic audit: records who changed what. For private tables only column NAMES are recorded, never values.
create or replace function mrindianz.audit_row_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_changed text[];
  v_id text;
begin
  if tg_op = 'UPDATE' then
    select array_agg(n.key order by n.key) into v_changed
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o using (key)
     where n.value is distinct from o.value and n.key not in ('updated_at');
    if v_changed is null then return new; end if;
  end if;
  v_id := coalesce((to_jsonb(coalesce(new, old)) ->> 'id'), (to_jsonb(coalesce(new, old)) ->> 'key'),
                   (to_jsonb(coalesce(new, old)) ->> 'user_id'));
  insert into mrindianz.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), lower(tg_op), tg_table_name, v_id,
          case when tg_op = 'UPDATE' then jsonb_build_object('changed', v_changed) else '{}'::jsonb end);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['admin_roles','site_settings','content_sections','faqs','partners','applications',
    'application_notes','contestants','contestant_media','voting_campaigns','voting_packages','email_templates',
    'contestant_fee_payments']
  loop
    execute format('create trigger %I_audit after insert or update or delete on mrindianz.%I for each row execute function mrindianz.audit_row_change()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Applicant deletion workflow: anonymise personal data, keep a non-identifying record.
-- Storage objects are removed by the server before calling this.
-- ---------------------------------------------------------------------------
create or replace function mrindianz.anonymise_application(p_application_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not mrindianz.has_role(array['super_admin']::mrindianz.admin_role[]) and auth.role() <> 'service_role' then
    raise exception 'forbidden';
  end if;
  delete from mrindianz.application_media where application_id = p_application_id;
  delete from mrindianz.application_notes where application_id = p_application_id;
  update mrindianz.applications set
    legal_name = 'Deleted applicant', stage_name = null, date_of_birth = date '1900-01-01',
    email = 'deleted+' || id::text || '@invalid.example', mobile = '000000', city = 'Deleted', region = 'Deleted',
    occupation = null, instagram = null, why_enter = 'Deleted', kiwi_indian_meaning = 'Deleted', interests = null,
    experience_details = null, talent_description = null, video_url = null, consents = '{}'::jsonb,
    marketing_opt_in = false, marketing_consent_at = null, anonymised_at = now()
  where id = p_application_id;
  insert into mrindianz.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'anonymise', 'applications', p_application_id::text, '{}'::jsonb);
end $$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'mrindianz' loop
    execute format('alter table mrindianz.%I enable row level security', t);
    execute format('revoke all on mrindianz.%I from anon, authenticated', t);
  end loop;
end $$;

-- Functions: revoke default execute, then grant explicitly.
revoke execute on all functions in schema mrindianz from public, anon, authenticated;
grant execute on function mrindianz.has_role(mrindianz.admin_role[]) to authenticated;
grant execute on function mrindianz.is_admin() to authenticated;
grant execute on function mrindianz.campaign_accepting_votes(uuid, timestamptz) to anon, authenticated;
grant execute on function mrindianz.public_leaderboard(uuid, mrindianz.payment_mode) to anon, authenticated;
grant execute on function mrindianz.public_vote_total(uuid, mrindianz.payment_mode) to anon, authenticated;
grant execute on function mrindianz.public_voting_history(uuid, mrindianz.payment_mode, int) to anon, authenticated;
grant execute on function mrindianz.anonymise_application(uuid) to authenticated;

-- Trigger functions must stay callable by the table owner context; they run as definer.

-- ---------------------------------------------------------------------------
-- Public (anon + authenticated) read access to published content
-- ---------------------------------------------------------------------------
grant select (key, published, published_at) on mrindianz.site_settings to anon, authenticated;
create policy site_settings_public_read on mrindianz.site_settings for select to anon, authenticated using (true);

grant select (slug, title, meta_description) on mrindianz.content_pages to anon, authenticated;
create policy content_pages_public_read on mrindianz.content_pages for select to anon, authenticated using (true);

grant select (page_slug, key, sort_order, published, approval_status, published_at) on mrindianz.content_sections to anon, authenticated;
create policy content_sections_public_read on mrindianz.content_sections for select to anon, authenticated
  using (published is not null);

grant select (id, question, answer, category, sort_order, approval_status, is_published) on mrindianz.faqs to anon, authenticated;
create policy faqs_public_read on mrindianz.faqs for select to anon, authenticated using (is_published);

grant select (id, name, category, description, logo_path, url, sort_order, is_published) on mrindianz.partners to anon, authenticated;
create policy partners_public_read on mrindianz.partners for select to anon, authenticated using (is_published and confirmed);

grant select (id, slug, contestant_number, public_name, short_bio, biography, city_region, interests, talent_info,
  social_links, profile_image_path, publication_status, voting_eligible, sort_order, published_at)
  on mrindianz.contestants to anon, authenticated;
create policy contestants_public_read on mrindianz.contestants for select to anon, authenticated
  using (publication_status = 'published');

grant select (id, contestant_id, storage_path, alt_text, sort_order) on mrindianz.contestant_media to anon, authenticated;
create policy contestant_media_public_read on mrindianz.contestant_media for select to anon, authenticated
  using (exists (select 1 from mrindianz.contestants c where c.id = contestant_id and c.publication_status = 'published'));

grant select (id, slug, name, status, opens_at, closes_at, timezone, is_demo, show_leaderboard, show_vote_counts,
  show_rankings, show_supporter_history, leaderboard_frozen_at, results_published, refresh_interval_seconds,
  max_quantity_per_order, rules_version, price_note) on mrindianz.voting_campaigns to anon, authenticated;
create policy voting_campaigns_public_read on mrindianz.voting_campaigns for select to anon, authenticated
  using (status <> 'draft');

grant select (id, campaign_id, name, display_label, price_cents, votes, currency, is_active, is_demo_value, sort_order, max_quantity)
  on mrindianz.voting_packages to anon, authenticated;
create policy voting_packages_public_read on mrindianz.voting_packages for select to anon, authenticated
  using (is_active and exists (select 1 from mrindianz.voting_campaigns c where c.id = campaign_id and c.status <> 'draft'));

grant select (id, slug, name, timezone, finale_starts_at) on mrindianz.events to anon, authenticated;
create policy events_public_read on mrindianz.events for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Admin access (authenticated users with roles). Full-row grants for authenticated; RLS narrows.
-- ---------------------------------------------------------------------------
grant select, update on mrindianz.profiles to authenticated;
create policy profiles_self_read on mrindianz.profiles for select to authenticated
  using (id = auth.uid() or mrindianz.has_role(array['organiser_admin']::mrindianz.admin_role[]));
create policy profiles_self_update on mrindianz.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

grant select, insert, delete on mrindianz.admin_roles to authenticated;
create policy admin_roles_read on mrindianz.admin_roles for select to authenticated
  using (user_id = auth.uid() or mrindianz.has_role(array['super_admin']::mrindianz.admin_role[]));
create policy admin_roles_super_insert on mrindianz.admin_roles for insert to authenticated
  with check (mrindianz.has_role(array['super_admin']::mrindianz.admin_role[]));
create policy admin_roles_super_delete on mrindianz.admin_roles for delete to authenticated
  using (mrindianz.has_role(array['super_admin']::mrindianz.admin_role[]));

-- CMS tables: content editors and organisers write; any admin reads.
grant select, insert, update, delete on mrindianz.site_settings, mrindianz.content_pages, mrindianz.content_sections,
  mrindianz.faqs, mrindianz.partners, mrindianz.events to authenticated;
do $$
declare t text;
begin
  foreach t in array array['site_settings','content_pages','content_sections','faqs','partners','events'] loop
    execute format($f$create policy %1$s_admin_read on mrindianz.%1$I for select to authenticated using (mrindianz.is_admin())$f$, t);
    execute format($f$create policy %1$s_editor_insert on mrindianz.%1$I for insert to authenticated
      with check (mrindianz.has_role(array['organiser_admin','content_editor']::mrindianz.admin_role[]))$f$, t);
    execute format($f$create policy %1$s_editor_update on mrindianz.%1$I for update to authenticated
      using (mrindianz.has_role(array['organiser_admin','content_editor']::mrindianz.admin_role[]))
      with check (mrindianz.has_role(array['organiser_admin','content_editor']::mrindianz.admin_role[]))$f$, t);
    execute format($f$create policy %1$s_organiser_delete on mrindianz.%1$I for delete to authenticated
      using (mrindianz.has_role(array['organiser_admin']::mrindianz.admin_role[]))$f$, t);
  end loop;
end $$;

-- Applications: reviewers and organisers. Inserts happen server-side (service role) only.
grant select, update, delete on mrindianz.applications to authenticated;
create policy applications_reviewer_read on mrindianz.applications for select to authenticated
  using (mrindianz.has_role(array['organiser_admin','application_reviewer']::mrindianz.admin_role[]));
create policy applications_reviewer_update on mrindianz.applications for update to authenticated
  using (mrindianz.has_role(array['organiser_admin','application_reviewer']::mrindianz.admin_role[]))
  with check (mrindianz.has_role(array['organiser_admin','application_reviewer']::mrindianz.admin_role[]));
create policy applications_super_delete on mrindianz.applications for delete to authenticated
  using (mrindianz.has_role(array['super_admin']::mrindianz.admin_role[]));

grant select on mrindianz.application_media, mrindianz.application_status_history to authenticated;
create policy application_media_reviewer_read on mrindianz.application_media for select to authenticated
  using (mrindianz.has_role(array['organiser_admin','application_reviewer']::mrindianz.admin_role[]));
create policy application_history_reviewer_read on mrindianz.application_status_history for select to authenticated
  using (mrindianz.has_role(array['organiser_admin','application_reviewer']::mrindianz.admin_role[]));

grant select, insert on mrindianz.application_notes to authenticated;
create policy application_notes_reviewer_read on mrindianz.application_notes for select to authenticated
  using (mrindianz.has_role(array['organiser_admin','application_reviewer']::mrindianz.admin_role[]));
create policy application_notes_reviewer_insert on mrindianz.application_notes for insert to authenticated
  with check (author_id = auth.uid() and mrindianz.has_role(array['organiser_admin','application_reviewer']::mrindianz.admin_role[]));

grant select on mrindianz.contestant_fee_payments to authenticated;
create policy fee_payments_read on mrindianz.contestant_fee_payments for select to authenticated
  using (mrindianz.has_role(array['organiser_admin','finance_viewer']::mrindianz.admin_role[]));

-- Contestants: editors manage profiles; reviewers can read drafts.
grant select, insert, update, delete on mrindianz.contestants, mrindianz.contestant_media to authenticated;
create policy contestants_admin_read on mrindianz.contestants for select to authenticated
  using (mrindianz.has_role(array['organiser_admin','content_editor','application_reviewer','finance_viewer']::mrindianz.admin_role[]));
create policy contestants_editor_insert on mrindianz.contestants for insert to authenticated
  with check (mrindianz.has_role(array['organiser_admin','content_editor']::mrindianz.admin_role[]));
create policy contestants_editor_update on mrindianz.contestants for update to authenticated
  using (mrindianz.has_role(array['organiser_admin','content_editor']::mrindianz.admin_role[]))
  with check (mrindianz.has_role(array['organiser_admin','content_editor']::mrindianz.admin_role[]));
create policy contestants_super_delete on mrindianz.contestants for delete to authenticated
  using (mrindianz.has_role(array['super_admin']::mrindianz.admin_role[]));
create policy contestant_media_admin_read on mrindianz.contestant_media for select to authenticated
  using (mrindianz.is_admin());
create policy contestant_media_editor_write on mrindianz.contestant_media for all to authenticated
  using (mrindianz.has_role(array['organiser_admin','content_editor']::mrindianz.admin_role[]))
  with check (mrindianz.has_role(array['organiser_admin','content_editor']::mrindianz.admin_role[]));

-- Voting configuration: organisers only.
grant select, insert, update on mrindianz.voting_campaigns, mrindianz.voting_packages to authenticated;
create policy voting_campaigns_admin_read on mrindianz.voting_campaigns for select to authenticated using (mrindianz.is_admin());
create policy voting_campaigns_organiser_write on mrindianz.voting_campaigns for insert to authenticated
  with check (mrindianz.has_role(array['organiser_admin']::mrindianz.admin_role[]));
create policy voting_campaigns_organiser_update on mrindianz.voting_campaigns for update to authenticated
  using (mrindianz.has_role(array['organiser_admin']::mrindianz.admin_role[]))
  with check (mrindianz.has_role(array['organiser_admin']::mrindianz.admin_role[]));
create policy voting_packages_admin_read on mrindianz.voting_packages for select to authenticated using (mrindianz.is_admin());
create policy voting_packages_organiser_write on mrindianz.voting_packages for insert to authenticated
  with check (mrindianz.has_role(array['organiser_admin']::mrindianz.admin_role[]));
create policy voting_packages_organiser_update on mrindianz.voting_packages for update to authenticated
  using (mrindianz.has_role(array['organiser_admin']::mrindianz.admin_role[]))
  with check (mrindianz.has_role(array['organiser_admin']::mrindianz.admin_role[]));

-- Financial records: read-only for finance viewers and organisers. No authenticated writes at all.
grant select on mrindianz.voting_orders, mrindianz.voting_order_items, mrindianz.payment_events, mrindianz.vote_ledger,
  mrindianz.payment_refunds, mrindianz.payment_disputes to authenticated;
do $$
declare t text;
begin
  foreach t in array array['voting_orders','voting_order_items','payment_events','vote_ledger','payment_refunds','payment_disputes'] loop
    execute format($f$create policy %1$s_finance_read on mrindianz.%1$I for select to authenticated
      using (mrindianz.has_role(array['organiser_admin','finance_viewer']::mrindianz.admin_role[]))$f$, t);
  end loop;
end $$;

-- Contact submissions, emails and audit logs.
grant select, update on mrindianz.contact_submissions to authenticated;
create policy contact_organiser_read on mrindianz.contact_submissions for select to authenticated
  using (mrindianz.has_role(array['organiser_admin']::mrindianz.admin_role[]));
create policy contact_organiser_update on mrindianz.contact_submissions for update to authenticated
  using (mrindianz.has_role(array['organiser_admin']::mrindianz.admin_role[]))
  with check (mrindianz.has_role(array['organiser_admin']::mrindianz.admin_role[]));

grant select, update on mrindianz.email_templates to authenticated;
create policy email_templates_read on mrindianz.email_templates for select to authenticated
  using (mrindianz.has_role(array['organiser_admin','content_editor','application_reviewer']::mrindianz.admin_role[]));
create policy email_templates_update on mrindianz.email_templates for update to authenticated
  using (mrindianz.has_role(array['organiser_admin']::mrindianz.admin_role[]))
  with check (mrindianz.has_role(array['organiser_admin']::mrindianz.admin_role[]));

grant select on mrindianz.email_delivery_logs to authenticated;
create policy email_logs_read on mrindianz.email_delivery_logs for select to authenticated
  using (mrindianz.has_role(array['organiser_admin']::mrindianz.admin_role[]));

grant select on mrindianz.audit_logs to authenticated;
create policy audit_logs_read on mrindianz.audit_logs for select to authenticated
  using (mrindianz.has_role(array['organiser_admin']::mrindianz.admin_role[]));

-- rate_limits: no client access at all (service role only).

-- Service role (server) keeps full access; it bypasses RLS by design and is never exposed to browsers.
grant all on all tables in schema mrindianz to service_role;
grant execute on all functions in schema mrindianz to service_role;
