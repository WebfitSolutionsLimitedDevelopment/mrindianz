-- Row Level Security, grants, audit triggers and status history.
-- Principle: anon/authenticated get NOTHING by default; access is granted explicitly per table and
-- then narrowed by RLS policies. Privileged writes (applications, orders, ledger) go through the
-- server using the service role or SECURITY DEFINER functions.

-- ---------------------------------------------------------------------------
-- Status history + audit triggers
-- ---------------------------------------------------------------------------
create or replace function public.log_application_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_status_history (application_id, from_status, to_status, changed_by, note)
    values (new.id, null, new.status, auth.uid(), 'Application submitted');
  elsif new.status is distinct from old.status then
    insert into public.application_status_history (application_id, from_status, to_status, changed_by,
      note)
    values (new.id, old.status, new.status, auth.uid(), nullif(current_setting('app.status_note', true), ''));
  end if;
  return new;
end $$;
create trigger applications_status_history after insert or update of status on public.applications
  for each row execute function public.log_application_status();

-- Generic audit: records who changed what. For private tables only column NAMES are recorded, never values.
create or replace function public.audit_row_change() returns trigger
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
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
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
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row_change()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Applicant deletion workflow: anonymise personal data, keep a non-identifying record.
-- Storage objects are removed by the server before calling this.
-- ---------------------------------------------------------------------------
create or replace function public.anonymise_application(p_application_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(array['super_admin']::public.admin_role[]) and auth.role() <> 'service_role' then
    raise exception 'forbidden';
  end if;
  delete from public.application_media where application_id = p_application_id;
  delete from public.application_notes where application_id = p_application_id;
  update public.applications set
    legal_name = 'Deleted applicant', stage_name = null, date_of_birth = date '1900-01-01',
    email = 'deleted+' || id::text || '@invalid.example', mobile = '000000', city = 'Deleted', region = 'Deleted',
    occupation = null, instagram = null, why_enter = 'Deleted', kiwi_indian_meaning = 'Deleted', interests = null,
    experience_details = null, talent_description = null, video_url = null, consents = '{}'::jsonb,
    marketing_opt_in = false, marketing_consent_at = null, anonymised_at = now()
  where id = p_application_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'anonymise', 'applications', p_application_id::text, '{}'::jsonb);
end $$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Functions: revoke default execute, then grant explicitly.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.has_role(public.admin_role[]) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.campaign_accepting_votes(uuid, timestamptz) to anon, authenticated;
grant execute on function public.public_leaderboard(uuid, public.payment_mode) to anon, authenticated;
grant execute on function public.public_vote_total(uuid, public.payment_mode) to anon, authenticated;
grant execute on function public.public_voting_history(uuid, public.payment_mode, int) to anon, authenticated;
grant execute on function public.anonymise_application(uuid) to authenticated;

-- Trigger functions must stay callable by the table owner context; they run as definer.

-- ---------------------------------------------------------------------------
-- Public (anon + authenticated) read access to published content
-- ---------------------------------------------------------------------------
grant select (key, published, published_at) on public.site_settings to anon, authenticated;
create policy site_settings_public_read on public.site_settings for select to anon, authenticated using (true);

grant select (slug, title, meta_description) on public.content_pages to anon, authenticated;
create policy content_pages_public_read on public.content_pages for select to anon, authenticated using (true);

grant select (page_slug, key, sort_order, published, approval_status, published_at) on public.content_sections to anon, authenticated;
create policy content_sections_public_read on public.content_sections for select to anon, authenticated
  using (published is not null);

grant select (id, question, answer, category, sort_order, approval_status, is_published) on public.faqs to anon, authenticated;
create policy faqs_public_read on public.faqs for select to anon, authenticated using (is_published);

grant select (id, name, category, description, logo_path, url, sort_order, is_published) on public.partners to anon, authenticated;
create policy partners_public_read on public.partners for select to anon, authenticated using (is_published and confirmed);

grant select (id, slug, contestant_number, public_name, short_bio, biography, city_region, interests, talent_info,
  social_links, profile_image_path, publication_status, voting_eligible, sort_order, published_at)
  on public.contestants to anon, authenticated;
create policy contestants_public_read on public.contestants for select to anon, authenticated
  using (publication_status = 'published');

grant select (id, contestant_id, storage_path, alt_text, sort_order) on public.contestant_media to anon, authenticated;
create policy contestant_media_public_read on public.contestant_media for select to anon, authenticated
  using (exists (select 1 from public.contestants c where c.id = contestant_id and c.publication_status = 'published'));

grant select (id, slug, name, status, opens_at, closes_at, timezone, is_demo, show_leaderboard, show_vote_counts,
  show_rankings, show_supporter_history, leaderboard_frozen_at, results_published, refresh_interval_seconds,
  max_quantity_per_order, rules_version, price_note) on public.voting_campaigns to anon, authenticated;
create policy voting_campaigns_public_read on public.voting_campaigns for select to anon, authenticated
  using (status <> 'draft');

grant select (id, campaign_id, name, display_label, price_cents, votes, currency, is_active, is_demo_value, sort_order, max_quantity)
  on public.voting_packages to anon, authenticated;
create policy voting_packages_public_read on public.voting_packages for select to anon, authenticated
  using (is_active and exists (select 1 from public.voting_campaigns c where c.id = campaign_id and c.status <> 'draft'));

grant select (id, slug, name, timezone, finale_starts_at) on public.events to anon, authenticated;
create policy events_public_read on public.events for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Admin access (authenticated users with roles). Full-row grants for authenticated; RLS narrows.
-- ---------------------------------------------------------------------------
grant select, update on public.profiles to authenticated;
create policy profiles_self_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(array['organiser_admin']::public.admin_role[]));
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

grant select, insert, delete on public.admin_roles to authenticated;
create policy admin_roles_read on public.admin_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(array['super_admin']::public.admin_role[]));
create policy admin_roles_super_insert on public.admin_roles for insert to authenticated
  with check (public.has_role(array['super_admin']::public.admin_role[]));
create policy admin_roles_super_delete on public.admin_roles for delete to authenticated
  using (public.has_role(array['super_admin']::public.admin_role[]));

-- CMS tables: content editors and organisers write; any admin reads.
grant select, insert, update, delete on public.site_settings, public.content_pages, public.content_sections,
  public.faqs, public.partners, public.events to authenticated;
do $$
declare t text;
begin
  foreach t in array array['site_settings','content_pages','content_sections','faqs','partners','events'] loop
    execute format($f$create policy %1$s_admin_read on public.%1$I for select to authenticated using (public.is_admin())$f$, t);
    execute format($f$create policy %1$s_editor_insert on public.%1$I for insert to authenticated
      with check (public.has_role(array['organiser_admin','content_editor']::public.admin_role[]))$f$, t);
    execute format($f$create policy %1$s_editor_update on public.%1$I for update to authenticated
      using (public.has_role(array['organiser_admin','content_editor']::public.admin_role[]))
      with check (public.has_role(array['organiser_admin','content_editor']::public.admin_role[]))$f$, t);
    execute format($f$create policy %1$s_organiser_delete on public.%1$I for delete to authenticated
      using (public.has_role(array['organiser_admin']::public.admin_role[]))$f$, t);
  end loop;
end $$;

-- Applications: reviewers and organisers. Inserts happen server-side (service role) only.
grant select, update, delete on public.applications to authenticated;
create policy applications_reviewer_read on public.applications for select to authenticated
  using (public.has_role(array['organiser_admin','application_reviewer']::public.admin_role[]));
create policy applications_reviewer_update on public.applications for update to authenticated
  using (public.has_role(array['organiser_admin','application_reviewer']::public.admin_role[]))
  with check (public.has_role(array['organiser_admin','application_reviewer']::public.admin_role[]));
create policy applications_super_delete on public.applications for delete to authenticated
  using (public.has_role(array['super_admin']::public.admin_role[]));

grant select on public.application_media, public.application_status_history to authenticated;
create policy application_media_reviewer_read on public.application_media for select to authenticated
  using (public.has_role(array['organiser_admin','application_reviewer']::public.admin_role[]));
create policy application_history_reviewer_read on public.application_status_history for select to authenticated
  using (public.has_role(array['organiser_admin','application_reviewer']::public.admin_role[]));

grant select, insert on public.application_notes to authenticated;
create policy application_notes_reviewer_read on public.application_notes for select to authenticated
  using (public.has_role(array['organiser_admin','application_reviewer']::public.admin_role[]));
create policy application_notes_reviewer_insert on public.application_notes for insert to authenticated
  with check (author_id = auth.uid() and public.has_role(array['organiser_admin','application_reviewer']::public.admin_role[]));

grant select on public.contestant_fee_payments to authenticated;
create policy fee_payments_read on public.contestant_fee_payments for select to authenticated
  using (public.has_role(array['organiser_admin','finance_viewer']::public.admin_role[]));

-- Contestants: editors manage profiles; reviewers can read drafts.
grant select, insert, update, delete on public.contestants, public.contestant_media to authenticated;
create policy contestants_admin_read on public.contestants for select to authenticated
  using (public.has_role(array['organiser_admin','content_editor','application_reviewer','finance_viewer']::public.admin_role[]));
create policy contestants_editor_insert on public.contestants for insert to authenticated
  with check (public.has_role(array['organiser_admin','content_editor']::public.admin_role[]));
create policy contestants_editor_update on public.contestants for update to authenticated
  using (public.has_role(array['organiser_admin','content_editor']::public.admin_role[]))
  with check (public.has_role(array['organiser_admin','content_editor']::public.admin_role[]));
create policy contestants_super_delete on public.contestants for delete to authenticated
  using (public.has_role(array['super_admin']::public.admin_role[]));
create policy contestant_media_admin_read on public.contestant_media for select to authenticated
  using (public.is_admin());
create policy contestant_media_editor_write on public.contestant_media for all to authenticated
  using (public.has_role(array['organiser_admin','content_editor']::public.admin_role[]))
  with check (public.has_role(array['organiser_admin','content_editor']::public.admin_role[]));

-- Voting configuration: organisers only.
grant select, insert, update on public.voting_campaigns, public.voting_packages to authenticated;
create policy voting_campaigns_admin_read on public.voting_campaigns for select to authenticated using (public.is_admin());
create policy voting_campaigns_organiser_write on public.voting_campaigns for insert to authenticated
  with check (public.has_role(array['organiser_admin']::public.admin_role[]));
create policy voting_campaigns_organiser_update on public.voting_campaigns for update to authenticated
  using (public.has_role(array['organiser_admin']::public.admin_role[]))
  with check (public.has_role(array['organiser_admin']::public.admin_role[]));
create policy voting_packages_admin_read on public.voting_packages for select to authenticated using (public.is_admin());
create policy voting_packages_organiser_write on public.voting_packages for insert to authenticated
  with check (public.has_role(array['organiser_admin']::public.admin_role[]));
create policy voting_packages_organiser_update on public.voting_packages for update to authenticated
  using (public.has_role(array['organiser_admin']::public.admin_role[]))
  with check (public.has_role(array['organiser_admin']::public.admin_role[]));

-- Financial records: read-only for finance viewers and organisers. No authenticated writes at all.
grant select on public.voting_orders, public.voting_order_items, public.payment_events, public.vote_ledger,
  public.payment_refunds, public.payment_disputes to authenticated;
do $$
declare t text;
begin
  foreach t in array array['voting_orders','voting_order_items','payment_events','vote_ledger','payment_refunds','payment_disputes'] loop
    execute format($f$create policy %1$s_finance_read on public.%1$I for select to authenticated
      using (public.has_role(array['organiser_admin','finance_viewer']::public.admin_role[]))$f$, t);
  end loop;
end $$;

-- Contact submissions, emails and audit logs.
grant select, update on public.contact_submissions to authenticated;
create policy contact_organiser_read on public.contact_submissions for select to authenticated
  using (public.has_role(array['organiser_admin']::public.admin_role[]));
create policy contact_organiser_update on public.contact_submissions for update to authenticated
  using (public.has_role(array['organiser_admin']::public.admin_role[]))
  with check (public.has_role(array['organiser_admin']::public.admin_role[]));

grant select, update on public.email_templates to authenticated;
create policy email_templates_read on public.email_templates for select to authenticated
  using (public.has_role(array['organiser_admin','content_editor','application_reviewer']::public.admin_role[]));
create policy email_templates_update on public.email_templates for update to authenticated
  using (public.has_role(array['organiser_admin']::public.admin_role[]))
  with check (public.has_role(array['organiser_admin']::public.admin_role[]));

grant select on public.email_delivery_logs to authenticated;
create policy email_logs_read on public.email_delivery_logs for select to authenticated
  using (public.has_role(array['organiser_admin']::public.admin_role[]));

grant select on public.audit_logs to authenticated;
create policy audit_logs_read on public.audit_logs for select to authenticated
  using (public.has_role(array['organiser_admin']::public.admin_role[]));

-- rate_limits: no client access at all (service role only).

-- Service role (server) keeps full access; it bypasses RLS by design and is never exposed to browsers.
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;
