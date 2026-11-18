-- =============================================================================
-- Mr. IndiaNZ 2027 — full database setup (generated 2026-11-18 from supabase/migrations)
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

-- ---------------------------------------------------------------------------
-- 20261118000001_core_schema.sql
-- ---------------------------------------------------------------------------
-- Mr. IndiaNZ 2027 — core schema
-- All primary keys are UUIDs. Money is stored as integer cents. Timestamps are timestamptz (UTC);
-- the event timezone (Pacific/Auckland) is applied in presentation and in voting-window checks.

create extension if not exists pgcrypto with schema extensions;

-- All Mr. IndiaNZ objects live in their own schema so the project can safely be shared with other
-- sites (e.g. Miss India South Pacific). Nothing in this script touches the public schema.
create schema if not exists mrindianz;
grant usage on schema mrindianz to anon, authenticated, service_role;
-- New functions are NOT executable by PUBLIC unless explicitly granted.
alter default privileges in schema mrindianz revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------
create type mrindianz.admin_role as enum (
  'super_admin', 'organiser_admin', 'content_editor', 'application_reviewer', 'finance_viewer'
);

create type mrindianz.application_status as enum (
  'new', 'in_review', 'shortlisted', 'offered', 'accepted', 'awaiting_payment',
  'confirmed', 'waitlisted', 'unsuccessful', 'withdrawn'
);

create type mrindianz.publication_status as enum ('draft', 'published', 'archived');

create type mrindianz.voting_status as enum ('draft', 'scheduled', 'open', 'paused', 'closed', 'finalised');

create type mrindianz.payment_mode as enum ('live', 'test', 'demo');

create type mrindianz.order_status as enum (
  'pending', 'awaiting_payment', 'paid', 'failed', 'expired', 'cancelled',
  'refunded', 'partially_refunded', 'disputed', 'review_required'
);

create type mrindianz.ledger_entry_type as enum (
  'credit', 'refund_reversal', 'dispute_reversal', 'dispute_reinstatement', 'admin_adjustment'
);

-- ---------------------------------------------------------------------------
-- Utility: updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function mrindianz.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Admin identity and roles
-- ---------------------------------------------------------------------------
create table mrindianz.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table mrindianz.admin_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role mrindianz.admin_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);
create index admin_roles_role_idx on mrindianz.admin_roles (role);

-- has_role(): true when the current user holds any of the given roles. super_admin implicitly passes.
create or replace function mrindianz.has_role(roles mrindianz.admin_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from mrindianz.admin_roles ar
    where ar.user_id = auth.uid()
      and (ar.role = any (roles) or ar.role = 'super_admin')
  );
$$;

create or replace function mrindianz.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from mrindianz.admin_roles ar where ar.user_id = auth.uid());
$$;

-- Prevent removing the final super admin (lock-out protection).
create or replace function mrindianz.protect_last_super_admin() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.role = 'super_admin'
     and (tg_op = 'DELETE' or new.role <> 'super_admin')
     and (select count(*) from mrindianz.admin_roles where role = 'super_admin') <= 1 then
    raise exception 'Cannot remove the last super_admin';
  end if;
  return coalesce(new, old);
end $$;
create trigger admin_roles_protect_last_super
  before delete or update on mrindianz.admin_roles
  for each row execute function mrindianz.protect_last_super_admin();

-- ---------------------------------------------------------------------------
-- Event, settings and CMS
-- ---------------------------------------------------------------------------
create table mrindianz.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  timezone text not null default 'Pacific/Auckland',
  finale_starts_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Key/value settings with a draft and a published value. Public reads see only `published`.
create table mrindianz.site_settings (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  published jsonb not null default '{}'::jsonb,
  draft jsonb,
  description text,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table mrindianz.content_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  meta_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table mrindianz.content_sections (
  id uuid primary key default gen_random_uuid(),
  page_slug text not null references mrindianz.content_pages (slug) on update cascade on delete cascade,
  key text not null check (key ~ '^[a-z0-9_]+$'),
  sort_order int not null default 0,
  draft jsonb,
  published jsonb,
  -- 'approved' content is organiser-approved; 'pending_approval' is draft copy from the brief
  approval_status text not null default 'pending_approval' check (approval_status in ('approved', 'pending_approval')),
  updated_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page_slug, key)
);

create table mrindianz.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(question) between 3 and 300),
  answer text not null check (char_length(answer) between 1 and 4000),
  category text not null default 'general',
  sort_order int not null default 0,
  is_published boolean not null default false,
  approval_status text not null default 'pending_approval' check (approval_status in ('approved', 'pending_approval')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index faqs_published_idx on mrindianz.faqs (is_published, sort_order);

create table mrindianz.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('presenting', 'major', 'supporting', 'media', 'community')),
  description text,
  logo_path text,
  url text check (url is null or url ~ '^https://'),
  sort_order int not null default 0,
  is_published boolean not null default false,
  confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Only confirmed partners may be published.
  constraint partners_publish_requires_confirmation check (not is_published or confirmed)
);

-- ---------------------------------------------------------------------------
-- Applications (private)
-- ---------------------------------------------------------------------------
create table mrindianz.applications (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('MINZ27-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  client_submission_id uuid not null unique, -- duplicate-submission protection
  status mrindianz.application_status not null default 'new',
  legal_name text not null check (char_length(legal_name) between 2 and 120),
  stage_name text check (stage_name is null or char_length(stage_name) <= 80),
  date_of_birth date not null,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  mobile text not null check (char_length(mobile) between 6 and 20),
  city text not null check (char_length(city) between 2 and 80),
  region text not null check (char_length(region) between 2 and 60),
  occupation text check (occupation is null or char_length(occupation) <= 120),
  instagram text check (instagram is null or char_length(instagram) <= 200),
  why_enter text not null check (char_length(why_enter) between 1 and 1000),
  kiwi_indian_meaning text not null check (char_length(kiwi_indian_meaning) between 1 and 1000),
  interests text check (interests is null or char_length(interests) <= 1000),
  has_experience boolean not null default false,
  experience_details text check (experience_details is null or char_length(experience_details) <= 1000),
  talent_audition boolean not null,
  talent_description text check (talent_description is null or char_length(talent_description) <= 1000),
  video_url text check (video_url is null or (video_url ~ '^https://' and char_length(video_url) <= 500)),
  consents jsonb not null,
  policy_versions jsonb not null,
  marketing_opt_in boolean not null default false,
  marketing_consent_at timestamptz,
  submitted_at timestamptz not null default now(),
  anonymised_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_talent_requires_description
    check (not talent_audition or anonymised_at is not null or (talent_description is not null and char_length(talent_description) > 0)),
  constraint applications_marketing_timestamp check (not marketing_opt_in or marketing_consent_at is not null)
);
create index applications_status_idx on mrindianz.applications (status, submitted_at desc);
create index applications_email_idx on mrindianz.applications (lower(email));

create table mrindianz.application_media (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references mrindianz.applications (id) on delete cascade,
  kind text not null check (kind in ('headshot', 'full_length', 'traditional')),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 5242880),
  created_at timestamptz not null default now(),
  unique (application_id, kind)
);

create table mrindianz.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references mrindianz.applications (id) on delete cascade,
  from_status mrindianz.application_status,
  to_status mrindianz.application_status not null,
  changed_by uuid references auth.users (id) on delete set null,
  note text,
  changed_at timestamptz not null default now()
);
create index application_status_history_app_idx on mrindianz.application_status_history (application_id, changed_at);

create table mrindianz.application_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references mrindianz.applications (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

-- Contestant fee (NZ$350) — separate from voting. Disabled until fee/GST/refund terms are approved.
create table mrindianz.contestant_fee_payments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references mrindianz.applications (id) on delete restrict,
  amount_cents int not null check (amount_cents > 0),
  currency text not null default 'NZD' check (currency = 'NZD'),
  status text not null default 'not_started' check (status in ('not_started', 'link_sent', 'paid', 'refunded', 'waived', 'cancelled')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  payment_mode mrindianz.payment_mode,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Contestants (public once published)
-- ---------------------------------------------------------------------------
create table mrindianz.contestants (
  id uuid primary key default gen_random_uuid(),
  application_id uuid unique references mrindianz.applications (id) on delete set null,
  -- Permanent identifier used in URLs and QR codes. Never changes, even when the public name changes.
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  contestant_number int unique check (contestant_number is null or contestant_number between 1 and 999),
  public_name text not null check (char_length(public_name) between 2 and 80),
  short_bio text check (short_bio is null or char_length(short_bio) <= 280),
  biography text check (biography is null or char_length(biography) <= 5000),
  city_region text check (city_region is null or char_length(city_region) <= 80),
  interests text[] not null default '{}',
  talent_info text check (talent_info is null or char_length(talent_info) <= 1000),
  social_links jsonb not null default '{}'::jsonb,
  profile_image_path text,
  publication_status mrindianz.publication_status not null default 'draft',
  voting_eligible boolean not null default false,
  sort_order int not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contestants_voting_requires_published check (not voting_eligible or publication_status = 'published')
);
create index contestants_public_idx on mrindianz.contestants (publication_status, contestant_number);

create or replace function mrindianz.contestants_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.slug <> old.slug then
    raise exception 'Contestant slug is permanent and cannot be changed';
  end if;
  if new.publication_status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;
create trigger contestants_guard before insert or update on mrindianz.contestants
  for each row execute function mrindianz.contestants_guard();

create table mrindianz.contestant_media (
  id uuid primary key default gen_random_uuid(),
  contestant_id uuid not null references mrindianz.contestants (id) on delete cascade,
  storage_path text not null,
  alt_text text not null default '' check (char_length(alt_text) <= 200),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Contact, email and audit
-- ---------------------------------------------------------------------------
create table mrindianz.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  subject text not null check (char_length(subject) between 2 and 150),
  message text not null check (char_length(message) between 10 and 4000),
  status text not null default 'new' check (status in ('new', 'read', 'replied', 'spam', 'archived')),
  created_at timestamptz not null default now()
);

create table mrindianz.email_templates (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  name text not null,
  subject text not null,
  body text not null,
  description text,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table mrindianz.email_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  dedupe_key text not null unique, -- duplicate-send prevention
  recipient text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'not_configured')),
  provider_message_id text,
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table mrindianz.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on mrindianz.audit_logs (created_at desc);
create index audit_logs_entity_idx on mrindianz.audit_logs (entity_type, entity_id);

create table mrindianz.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['profiles','events','site_settings','content_pages','content_sections','faqs','partners',
    'applications','contestant_fee_payments','contestants','email_templates','email_delivery_logs']
  loop
    execute format('create trigger %I_updated_at before update on mrindianz.%I for each row execute function mrindianz.set_updated_at()', t, t);
  end loop;
end $$;


-- ---------------------------------------------------------------------------
-- 20261118000002_voting.sql
-- ---------------------------------------------------------------------------
-- People's Choice paid voting: campaigns, packages, orders, payment events and an append-only vote ledger.
-- Vote totals are ALWAYS derived from mrindianz.vote_ledger. There is no editable vote-total column.

create table mrindianz.voting_campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  status mrindianz.voting_status not null default 'draft',
  opens_at timestamptz,
  closes_at timestamptz,
  timezone text not null default 'Pacific/Auckland',
  is_demo boolean not null default false,
  show_leaderboard boolean not null default true,
  show_vote_counts boolean not null default true,
  show_rankings boolean not null default true,
  show_supporter_history boolean not null default false,
  leaderboard_frozen_at timestamptz, -- when set, public totals only include entries up to this time
  results_published boolean not null default false,
  refresh_interval_seconds int not null default 30 check (refresh_interval_seconds between 10 and 3600),
  max_quantity_per_order int not null default 10 check (max_quantity_per_order between 1 and 100),
  rules_version text not null default 'draft-2026-11',
  price_note text, -- GST / processing fee presentation, pending approval
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint voting_window_valid check (opens_at is null or closes_at is null or closes_at > opens_at)
);
create trigger voting_campaigns_updated_at before update on mrindianz.voting_campaigns
  for each row execute function mrindianz.set_updated_at();

create table mrindianz.voting_packages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references mrindianz.voting_campaigns (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 60),
  display_label text check (display_label is null or char_length(display_label) <= 60),
  price_cents int not null check (price_cents between 50 and 1000000),
  votes int not null check (votes between 1 and 1000000),
  currency text not null default 'NZD' check (currency = 'NZD'),
  is_active boolean not null default true,
  is_demo_value boolean not null default false, -- true = example pricing, NOT approved
  sort_order int not null default 0,
  max_quantity int not null default 10 check (max_quantity between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index voting_packages_campaign_idx on mrindianz.voting_packages (campaign_id, sort_order);
create trigger voting_packages_updated_at before update on mrindianz.voting_packages
  for each row execute function mrindianz.set_updated_at();

create table mrindianz.voting_orders (
  id uuid primary key default gen_random_uuid(),
  public_ref text not null unique default ('V-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  idempotency_key uuid not null unique,
  campaign_id uuid not null references mrindianz.voting_campaigns (id) on delete restrict,
  contestant_id uuid not null references mrindianz.contestants (id) on delete restrict,
  supporter_name text not null check (char_length(supporter_name) between 1 and 80),
  supporter_email text not null check (supporter_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  display_anonymously boolean not null default false,
  terms_version text not null,
  terms_accepted_at timestamptz not null,
  status mrindianz.order_status not null default 'pending',
  payment_mode mrindianz.payment_mode not null,
  subtotal_cents int not null check (subtotal_cents > 0),
  total_cents int not null check (total_cents > 0),
  currency text not null default 'NZD',
  total_votes int not null check (total_votes > 0),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  status_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index voting_orders_campaign_status_idx on mrindianz.voting_orders (campaign_id, status, created_at desc);
create trigger voting_orders_updated_at before update on mrindianz.voting_orders
  for each row execute function mrindianz.set_updated_at();

create table mrindianz.voting_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references mrindianz.voting_orders (id) on delete restrict,
  package_id uuid not null references mrindianz.voting_packages (id) on delete restrict,
  package_name text not null,
  unit_price_cents int not null check (unit_price_cents > 0),
  votes_per_unit int not null check (votes_per_unit > 0),
  quantity int not null check (quantity between 1 and 100),
  line_total_cents int not null check (line_total_cents = unit_price_cents * quantity),
  line_votes int not null check (line_votes = votes_per_unit * quantity),
  created_at timestamptz not null default now()
);

create table mrindianz.payment_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique, -- idempotency: each Stripe event processed once
  event_type text not null,
  payment_mode mrindianz.payment_mode not null,
  order_id uuid references mrindianz.voting_orders (id) on delete restrict,
  summary jsonb not null default '{}'::jsonb, -- minimal, no card data
  processing_status text not null default 'received' check (processing_status in ('received', 'processed', 'ignored', 'retry', 'failed')),
  result text,
  attempts int not null default 1,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table mrindianz.vote_ledger (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references mrindianz.voting_campaigns (id) on delete restrict,
  contestant_id uuid not null references mrindianz.contestants (id) on delete restrict,
  order_id uuid references mrindianz.voting_orders (id) on delete restrict,
  entry_type mrindianz.ledger_entry_type not null,
  votes int not null check (votes <> 0),
  payment_mode mrindianz.payment_mode not null,
  source_ref text not null, -- stripe session/refund/dispute id, or admin reference
  package_snapshot jsonb,
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint vote_ledger_sign check (
    (entry_type in ('credit', 'dispute_reinstatement') and votes > 0) or
    (entry_type in ('refund_reversal', 'dispute_reversal') and votes < 0) or
    entry_type = 'admin_adjustment'),
  constraint vote_ledger_order_required check (entry_type = 'admin_adjustment' or order_id is not null),
  unique (entry_type, source_ref)
);
-- An order can be credited at most once.
create unique index vote_ledger_one_credit_per_order on mrindianz.vote_ledger (order_id) where entry_type = 'credit';
create index vote_ledger_tally_idx on mrindianz.vote_ledger (campaign_id, contestant_id, payment_mode, created_at);

create table mrindianz.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references mrindianz.voting_orders (id) on delete restrict,
  stripe_refund_id text not null unique,
  amount_cents int not null check (amount_cents > 0),
  votes_reversed int not null default 0,
  status text not null,
  created_at timestamptz not null default now()
);

create table mrindianz.payment_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references mrindianz.voting_orders (id) on delete restrict,
  stripe_dispute_id text not null unique,
  amount_cents int not null,
  reason text,
  status text not null,
  votes_reversed int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Financial history is append-only.
create or replace function mrindianz.forbid_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception '% on % is not permitted (append-only financial/audit record)', tg_op, tg_table_name;
end $$;
create trigger vote_ledger_append_only before update or delete on mrindianz.vote_ledger
  for each row execute function mrindianz.forbid_mutation();
create trigger audit_logs_append_only before update or delete on mrindianz.audit_logs
  for each row execute function mrindianz.forbid_mutation();
create trigger voting_orders_no_delete before delete on mrindianz.voting_orders
  for each row execute function mrindianz.forbid_mutation();
create trigger payment_events_no_delete before delete on mrindianz.payment_events
  for each row execute function mrindianz.forbid_mutation();
create trigger payment_refunds_no_delete before delete on mrindianz.payment_refunds
  for each row execute function mrindianz.forbid_mutation();

-- ---------------------------------------------------------------------------
-- Voting availability
-- ---------------------------------------------------------------------------
create or replace function mrindianz.campaign_accepting_votes(p_campaign_id uuid, p_at timestamptz default now())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from mrindianz.voting_campaigns c
    where c.id = p_campaign_id
      and c.status = 'open'
      and (c.opens_at is null or p_at >= c.opens_at)
      and (c.closes_at is null or p_at < c.closes_at)
  );
$$;

-- ---------------------------------------------------------------------------
-- Order creation. Prices and vote quantities come ONLY from voting_packages.
-- Called by the server with the service role; never exposed to anon.
-- ---------------------------------------------------------------------------
create or replace function mrindianz.create_voting_order(
  p_idempotency_key uuid,
  p_campaign_id uuid,
  p_contestant_id uuid,
  p_package_id uuid,
  p_quantity int,
  p_supporter_name text,
  p_supporter_email text,
  p_display_anonymously boolean,
  p_terms_version text,
  p_payment_mode mrindianz.payment_mode
) returns mrindianz.voting_orders
language plpgsql security definer set search_path = '' as $$
declare
  v_campaign mrindianz.voting_campaigns;
  v_package mrindianz.voting_packages;
  v_order mrindianz.voting_orders;
  v_max int;
begin
  select * into v_order from mrindianz.voting_orders where idempotency_key = p_idempotency_key;
  if found then
    return v_order;
  end if;

  select * into v_campaign from mrindianz.voting_campaigns where id = p_campaign_id;
  if not found then raise exception 'campaign_not_found' using errcode = 'P0001'; end if;
  if not mrindianz.campaign_accepting_votes(p_campaign_id) then
    raise exception 'voting_not_open' using errcode = 'P0001';
  end if;
  if (p_payment_mode = 'demo') <> v_campaign.is_demo then
    raise exception 'payment_mode_mismatch' using errcode = 'P0001';
  end if;
  if p_terms_version is distinct from v_campaign.rules_version then
    raise exception 'terms_version_mismatch' using errcode = 'P0001';
  end if;

  perform 1 from mrindianz.contestants
   where id = p_contestant_id and publication_status = 'published' and voting_eligible;
  if not found then raise exception 'contestant_not_eligible' using errcode = 'P0001'; end if;

  select * into v_package from mrindianz.voting_packages
   where id = p_package_id and campaign_id = p_campaign_id and is_active;
  if not found then raise exception 'package_not_available' using errcode = 'P0001'; end if;

  v_max := least(v_package.max_quantity, v_campaign.max_quantity_per_order);
  if p_quantity is null or p_quantity < 1 or p_quantity > v_max then
    raise exception 'invalid_quantity' using errcode = 'P0001';
  end if;

  insert into mrindianz.voting_orders (
    idempotency_key, campaign_id, contestant_id, supporter_name, supporter_email, display_anonymously,
    terms_version, terms_accepted_at, status, payment_mode, subtotal_cents, total_cents, currency, total_votes)
  values (
    p_idempotency_key, p_campaign_id, p_contestant_id, trim(p_supporter_name), lower(trim(p_supporter_email)),
    coalesce(p_display_anonymously, false), p_terms_version, now(), 'pending', p_payment_mode,
    v_package.price_cents * p_quantity, v_package.price_cents * p_quantity, v_package.currency,
    v_package.votes * p_quantity)
  returning * into v_order;

  insert into mrindianz.voting_order_items (order_id, package_id, package_name, unit_price_cents, votes_per_unit,
    quantity, line_total_cents, line_votes)
  values (v_order.id, v_package.id, v_package.name, v_package.price_cents, v_package.votes, p_quantity,
    v_package.price_cents * p_quantity, v_package.votes * p_quantity);

  return v_order;
end $$;

create or replace function mrindianz.attach_checkout_session(p_order_id uuid, p_session_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update mrindianz.voting_orders
     set stripe_checkout_session_id = p_session_id, status = 'awaiting_payment'
   where id = p_order_id and status = 'pending' and stripe_checkout_session_id is null;
  if not found then raise exception 'order_not_attachable' using errcode = 'P0001'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Webhook processing helpers. Each records the Stripe event (idempotent) and applies the
-- change in the same transaction. Return values: processed | duplicate | ignored | retry | rejected:<reason>
-- ---------------------------------------------------------------------------
create or replace function mrindianz._begin_payment_event(
  p_event_id text, p_event_type text, p_mode mrindianz.payment_mode, p_summary jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare v_status text;
begin
  insert into mrindianz.payment_events (stripe_event_id, event_type, payment_mode, summary)
  values (p_event_id, p_event_type, p_mode, coalesce(p_summary, '{}'::jsonb))
  on conflict (stripe_event_id) do nothing;
  if found then return 'new'; end if;
  select processing_status into v_status from mrindianz.payment_events where stripe_event_id = p_event_id for update;
  if v_status in ('processed', 'ignored', 'failed') then return 'duplicate'; end if;
  update mrindianz.payment_events set attempts = attempts + 1 where stripe_event_id = p_event_id;
  return 'retry';
end $$;

create or replace function mrindianz._finish_payment_event(
  p_event_id text, p_status text, p_result text, p_order_id uuid)
returns void language sql security definer set search_path = '' as $$
  update mrindianz.payment_events
     set processing_status = p_status, result = p_result, order_id = coalesce(p_order_id, order_id),
         processed_at = case when p_status in ('processed', 'ignored', 'failed') then now() else processed_at end
   where stripe_event_id = p_event_id;
$$;

create or replace function mrindianz.process_checkout_completed(
  p_event_id text,
  p_mode mrindianz.payment_mode,
  p_order_id uuid,
  p_session_id text,
  p_payment_intent_id text,
  p_payment_status text,
  p_amount_total int,
  p_currency text
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_begin text;
  v_order mrindianz.voting_orders;
  v_item mrindianz.voting_order_items;
begin
  v_begin := mrindianz._begin_payment_event(p_event_id, 'checkout.session.completed', p_mode,
    jsonb_build_object('session', p_session_id, 'payment_status', p_payment_status, 'amount', p_amount_total));
  if v_begin = 'duplicate' then return 'duplicate'; end if;

  select * into v_order from mrindianz.voting_orders where id = p_order_id for update;
  if not found then
    perform mrindianz._finish_payment_event(p_event_id, 'failed', 'order_not_found', null);
    return 'rejected:order_not_found';
  end if;
  if v_order.stripe_checkout_session_id is distinct from p_session_id then
    perform mrindianz._finish_payment_event(p_event_id, 'failed', 'session_mismatch', v_order.id);
    return 'rejected:session_mismatch';
  end if;
  if v_order.payment_mode <> p_mode then
    perform mrindianz._finish_payment_event(p_event_id, 'failed', 'mode_mismatch', v_order.id);
    return 'rejected:mode_mismatch';
  end if;
  if v_order.status in ('paid', 'refunded', 'partially_refunded', 'disputed') then
    perform mrindianz._finish_payment_event(p_event_id, 'processed', 'already_paid', v_order.id);
    return 'duplicate';
  end if;
  if p_payment_status <> 'paid' then
    -- asynchronous payment methods: wait for checkout.session.async_payment_succeeded
    perform mrindianz._finish_payment_event(p_event_id, 'ignored', 'payment_not_yet_paid', v_order.id);
    return 'ignored';
  end if;
  if p_amount_total is distinct from v_order.total_cents or lower(p_currency) <> lower(v_order.currency) then
    update mrindianz.voting_orders set status = 'review_required', status_reason = 'amount_mismatch' where id = v_order.id;
    perform mrindianz._finish_payment_event(p_event_id, 'failed', 'amount_mismatch', v_order.id);
    return 'rejected:amount_mismatch';
  end if;

  update mrindianz.voting_orders
     set status = 'paid', paid_at = now(), stripe_payment_intent_id = coalesce(p_payment_intent_id, stripe_payment_intent_id)
   where id = v_order.id;

  select * into v_item from mrindianz.voting_order_items where order_id = v_order.id limit 1;

  insert into mrindianz.vote_ledger (campaign_id, contestant_id, order_id, entry_type, votes, payment_mode, source_ref, package_snapshot)
  values (v_order.campaign_id, v_order.contestant_id, v_order.id, 'credit', v_order.total_votes, v_order.payment_mode,
          p_session_id,
          jsonb_build_object('package_id', v_item.package_id, 'name', v_item.package_name,
                             'unit_price_cents', v_item.unit_price_cents, 'votes_per_unit', v_item.votes_per_unit,
                             'quantity', v_item.quantity))
  on conflict do nothing;

  perform mrindianz._finish_payment_event(p_event_id, 'processed', 'credited', v_order.id);
  return 'processed';
end $$;

create or replace function mrindianz.process_checkout_failed(
  p_event_id text, p_event_type text, p_mode mrindianz.payment_mode, p_order_id uuid, p_session_id text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_begin text; v_order mrindianz.voting_orders;
begin
  v_begin := mrindianz._begin_payment_event(p_event_id, p_event_type, p_mode, jsonb_build_object('session', p_session_id));
  if v_begin = 'duplicate' then return 'duplicate'; end if;
  select * into v_order from mrindianz.voting_orders where id = p_order_id for update;
  if not found or v_order.stripe_checkout_session_id is distinct from p_session_id then
    perform mrindianz._finish_payment_event(p_event_id, 'failed', 'order_not_found', null);
    return 'rejected:order_not_found';
  end if;
  if v_order.status in ('pending', 'awaiting_payment') then
    update mrindianz.voting_orders
       set status = case when p_event_type = 'checkout.session.expired' then 'expired'::mrindianz.order_status else 'failed'::mrindianz.order_status end,
           status_reason = p_event_type
     where id = v_order.id;
  end if;
  perform mrindianz._finish_payment_event(p_event_id, 'processed', 'order_closed', v_order.id);
  return 'processed';
end $$;

-- Remaining credited votes for an order (credit + reinstatements + reversals).
create or replace function mrindianz.order_net_votes(p_order_id uuid) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(votes), 0)::int from mrindianz.vote_ledger where order_id = p_order_id;
$$;

create or replace function mrindianz.process_refund(
  p_event_id text, p_mode mrindianz.payment_mode, p_payment_intent_id text, p_refund_id text,
  p_refund_amount_cents int, p_refund_status text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_begin text; v_order mrindianz.voting_orders; v_reverse int; v_prev_refunded int; v_net int;
begin
  v_begin := mrindianz._begin_payment_event(p_event_id, 'refund', p_mode,
    jsonb_build_object('refund', p_refund_id, 'amount', p_refund_amount_cents, 'status', p_refund_status));
  if v_begin = 'duplicate' then return 'duplicate'; end if;

  select * into v_order from mrindianz.voting_orders where stripe_payment_intent_id = p_payment_intent_id for update;
  if not found then
    -- Out-of-order delivery: the payment may not be recorded yet. Ask Stripe to retry.
    perform mrindianz._finish_payment_event(p_event_id, 'retry', 'order_not_yet_paid', null);
    return 'retry';
  end if;
  if p_refund_status not in ('succeeded', 'pending') then
    perform mrindianz._finish_payment_event(p_event_id, 'ignored', 'refund_status_' || p_refund_status, v_order.id);
    return 'ignored';
  end if;
  if exists (select 1 from mrindianz.payment_refunds where stripe_refund_id = p_refund_id) then
    perform mrindianz._finish_payment_event(p_event_id, 'processed', 'refund_already_recorded', v_order.id);
    return 'duplicate';
  end if;

  select coalesce(sum(amount_cents), 0) into v_prev_refunded from mrindianz.payment_refunds where order_id = v_order.id;
  if v_prev_refunded + p_refund_amount_cents >= v_order.total_cents then
    v_reverse := mrindianz.order_net_votes(v_order.id); -- full refund: remove everything still credited
  else
    -- partial refund: pro-rata, rounded down, never more than remains
    v_reverse := least(mrindianz.order_net_votes(v_order.id),
                       (v_order.total_votes::bigint * p_refund_amount_cents / v_order.total_cents)::int);
  end if;

  insert into mrindianz.payment_refunds (order_id, stripe_refund_id, amount_cents, votes_reversed, status)
  values (v_order.id, p_refund_id, p_refund_amount_cents, greatest(v_reverse, 0), p_refund_status);

  if v_reverse > 0 then
    insert into mrindianz.vote_ledger (campaign_id, contestant_id, order_id, entry_type, votes, payment_mode, source_ref)
    values (v_order.campaign_id, v_order.contestant_id, v_order.id, 'refund_reversal', -v_reverse, v_order.payment_mode, p_refund_id);
  end if;

  update mrindianz.voting_orders
     set status = case when v_prev_refunded + p_refund_amount_cents >= total_cents
                       then 'refunded'::mrindianz.order_status else 'partially_refunded'::mrindianz.order_status end
   where id = v_order.id and status <> 'disputed';

  perform mrindianz._finish_payment_event(p_event_id, 'processed', 'refund_recorded', v_order.id);
  return 'processed';
end $$;

create or replace function mrindianz.process_dispute(
  p_event_id text, p_event_type text, p_mode mrindianz.payment_mode, p_payment_intent_id text,
  p_dispute_id text, p_dispute_status text, p_amount_cents int, p_reason text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_begin text; v_order mrindianz.voting_orders; v_net int; v_reversed int; v_existing mrindianz.payment_disputes;
begin
  v_begin := mrindianz._begin_payment_event(p_event_id, p_event_type, p_mode,
    jsonb_build_object('dispute', p_dispute_id, 'status', p_dispute_status));
  if v_begin = 'duplicate' then return 'duplicate'; end if;

  select * into v_order from mrindianz.voting_orders where stripe_payment_intent_id = p_payment_intent_id for update;
  if not found then
    perform mrindianz._finish_payment_event(p_event_id, 'retry', 'order_not_yet_paid', null);
    return 'retry';
  end if;

  select * into v_existing from mrindianz.payment_disputes where stripe_dispute_id = p_dispute_id for update;
  if not found then
    v_net := mrindianz.order_net_votes(v_order.id);
    insert into mrindianz.payment_disputes (order_id, stripe_dispute_id, amount_cents, reason, status, votes_reversed)
    values (v_order.id, p_dispute_id, p_amount_cents, p_reason, p_dispute_status, greatest(v_net, 0))
    returning * into v_existing;
    if v_net > 0 then
      insert into mrindianz.vote_ledger (campaign_id, contestant_id, order_id, entry_type, votes, payment_mode, source_ref)
      values (v_order.campaign_id, v_order.contestant_id, v_order.id, 'dispute_reversal', -v_net, v_order.payment_mode, p_dispute_id)
      on conflict do nothing;
    end if;
    update mrindianz.voting_orders set status = 'disputed' where id = v_order.id;
  else
    update mrindianz.payment_disputes set status = p_dispute_status where id = v_existing.id;
  end if;

  -- Dispute resolved in the organiser's favour: reinstate exactly what was reversed, once.
  if p_dispute_status = 'won' and v_existing.votes_reversed > 0 then
    insert into mrindianz.vote_ledger (campaign_id, contestant_id, order_id, entry_type, votes, payment_mode, source_ref)
    values (v_order.campaign_id, v_order.contestant_id, v_order.id, 'dispute_reinstatement', v_existing.votes_reversed,
            v_order.payment_mode, p_dispute_id || ':won')
    on conflict do nothing;
    update mrindianz.voting_orders set status = 'paid' where id = v_order.id;
  end if;

  perform mrindianz._finish_payment_event(p_event_id, 'processed', 'dispute_' || p_dispute_status, v_order.id);
  return 'processed';
end $$;

-- Demo-only completion (local/staging demonstrations). Rejected for any non-demo order.
create or replace function mrindianz.complete_demo_order(p_order_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_order mrindianz.voting_orders; v_session text;
begin
  select * into v_order from mrindianz.voting_orders where id = p_order_id for update;
  if not found or v_order.payment_mode <> 'demo' then
    raise exception 'not_a_demo_order' using errcode = 'P0001';
  end if;
  if v_order.status = 'pending' then
    v_session := 'demo_' || v_order.id::text;
    update mrindianz.voting_orders set stripe_checkout_session_id = v_session, status = 'awaiting_payment' where id = v_order.id;
  else
    v_session := v_order.stripe_checkout_session_id;
  end if;
  return mrindianz.process_checkout_completed('demo_evt_' || v_order.id::text, 'demo', v_order.id, v_session,
                                            null, 'paid', v_order.total_cents, v_order.currency);
end $$;

-- ---------------------------------------------------------------------------
-- Public read models (security definer, expose only public fields)
-- ---------------------------------------------------------------------------
create or replace function mrindianz.public_leaderboard(p_campaign_id uuid, p_mode mrindianz.payment_mode default 'live')
returns table (
  contestant_id uuid, slug text, contestant_number int, public_name text, profile_image_path text,
  votes bigint, rank bigint
) language sql stable security definer set search_path = '' as $$
  with c as (
    select * from mrindianz.voting_campaigns
     where id = p_campaign_id and status <> 'draft' and show_leaderboard
  ), effective_mode as (
    select case when (select is_demo from c) then 'demo'::mrindianz.payment_mode
                when p_mode = 'demo' then 'live'::mrindianz.payment_mode
                else p_mode end as m
  ), tallies as (
    select l.contestant_id, sum(l.votes) as votes
      from mrindianz.vote_ledger l, c, effective_mode em
     where l.campaign_id = c.id
       and l.payment_mode = em.m
       and (c.leaderboard_frozen_at is null or l.created_at <= c.leaderboard_frozen_at)
     group by l.contestant_id
  )
  select k.id, k.slug, k.contestant_number, k.public_name, k.profile_image_path,
         case when (select show_vote_counts from c) then greatest(coalesce(t.votes, 0), 0)::bigint end,
         case when (select show_rankings from c) then rank() over (order by greatest(coalesce(t.votes, 0), 0) desc) end
    from mrindianz.contestants k
    cross join c
    left join tallies t on t.contestant_id = k.id
   where k.publication_status = 'published' and k.voting_eligible
   order by case when (select show_rankings from c) then greatest(coalesce(t.votes, 0), 0) else 0 end desc,
            k.contestant_number nulls last, k.public_name;
$$;

create or replace function mrindianz.public_vote_total(p_campaign_id uuid, p_mode mrindianz.payment_mode default 'live')
returns bigint language sql stable security definer set search_path = '' as $$
  select case when c.show_vote_counts and c.show_leaderboard and c.status <> 'draft'
              then coalesce((select sum(lb.votes) from mrindianz.public_leaderboard(p_campaign_id, p_mode) lb), 0)::bigint
         end
    from mrindianz.voting_campaigns c where c.id = p_campaign_id;
$$;

create or replace function mrindianz.public_voting_history(p_campaign_id uuid, p_mode mrindianz.payment_mode default 'live', p_limit int default 20)
returns table (supporter text, contestant_name text, contestant_slug text, votes int, approx_time timestamptz)
language sql stable security definer set search_path = '' as $$
  select case when o.display_anonymously then 'Anonymous' else split_part(o.supporter_name, ' ', 1) end,
         k.public_name, k.slug, l.votes,
         date_trunc('hour', l.created_at)
    from mrindianz.vote_ledger l
    join mrindianz.voting_orders o on o.id = l.order_id
    join mrindianz.contestants k on k.id = l.contestant_id
    join mrindianz.voting_campaigns c on c.id = l.campaign_id
   where l.campaign_id = p_campaign_id
     and l.entry_type = 'credit'
     and o.status = 'paid'
     and c.show_supporter_history
     and l.payment_mode = case when c.is_demo then 'demo'::mrindianz.payment_mode
                               when p_mode = 'demo' then 'live'::mrindianz.payment_mode else p_mode end
   order by l.created_at desc
   limit least(greatest(p_limit, 1), 50);
$$;

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window)
-- ---------------------------------------------------------------------------
create or replace function mrindianz.hit_rate_limit(p_key text, p_window_seconds int, p_max int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_window timestamptz; v_hits int;
begin
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into mrindianz.rate_limits (key, window_start, hits) values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = mrindianz.rate_limits.hits + 1
  returning hits into v_hits;
  delete from mrindianz.rate_limits where window_start < now() - interval '1 day';
  return v_hits <= p_max;
end $$;


-- ---------------------------------------------------------------------------
-- 20261118000003_security.sql
-- ---------------------------------------------------------------------------
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


-- ---------------------------------------------------------------------------
-- 20261118000004_storage.sql
-- ---------------------------------------------------------------------------
-- Storage buckets. Application photographs are PRIVATE; reviewers see them via short-lived signed URLs
-- generated server-side. Public media holds only approved contestant/partner imagery.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('mrindianz-applications', 'mrindianz-applications', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('mrindianz-public', 'mrindianz-public', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No anon/authenticated policies on application-media: uploads use server-issued signed upload URLs,
-- reads use server-issued signed URLs after a role check. Public users can never list or read it.

create policy "mrindianz: public media readable" on storage.objects for select to anon, authenticated
  using (bucket_id = 'mrindianz-public');
create policy "mrindianz: editors upload public media" on storage.objects for insert to authenticated
  with check (bucket_id = 'mrindianz-public'
    and mrindianz.has_role(array['organiser_admin','content_editor']::mrindianz.admin_role[]));
create policy "mrindianz: editors update public media" on storage.objects for update to authenticated
  using (bucket_id = 'mrindianz-public'
    and mrindianz.has_role(array['organiser_admin','content_editor']::mrindianz.admin_role[]));
create policy "mrindianz: editors delete public media" on storage.objects for delete to authenticated
  using (bucket_id = 'mrindianz-public'
    and mrindianz.has_role(array['organiser_admin','content_editor']::mrindianz.admin_role[]));



-- ---------------------------------------------------------------------------
-- 20261118000005_initial_content.sql
-- ---------------------------------------------------------------------------
-- GENERATED by scripts/generate-content-sql.ts — initial CMS content from the designer brief.
-- Uses ON CONFLICT DO NOTHING so organiser edits are never overwritten by re-running.

insert into mrindianz.events (slug, name, timezone) values ('mr-indianz-2027', 'Mr. IndiaNZ 2027', 'Pacific/Auckland') on conflict (slug) do nothing;
insert into mrindianz.site_settings (key, published, published_at) values ('event', '{"name":"Mr. IndiaNZ 2027","shortDescription":"The inaugural male pageant celebrating Kiwi-Indian style, culture, confidence, heritage and individuality.","tagline":"Celebrating Kiwi-Indian Style, Culture and Charisma","taglineApproved":false,"finaleDate":"2027-04-03","finaleDisplay":"Saturday 3 April 2027","venueName":"The Cloud","venueAddress":"Queens Wharf, 89 Quay Street, Auckland, New Zealand","venueShort":"The Cloud, Auckland","rehearsalStart":"2027-03-20","rehearsalEnd":"2027-03-21","rehearsalDisplay":"Saturday 20 and Sunday 21 March 2027","organiser":"Rhythm House Events & Films","applicationFeeDisplay":"Free","contestantFeeCents":35000,"contestantFeeCurrency":"NZD","contestantFeeTermsApproved":false,"countdownEnabled":true,"timezone":"Pacific/Auckland"}'::jsonb, now()) on conflict (key) do nothing;
insert into mrindianz.site_settings (key, published, published_at) values ('registration', '{"opensAt":"2026-12-15T00:00:00+13:00","closesAt":"2027-01-31T23:59:59+13:00","datesApproved":false,"minimumAge":18,"ageReferenceDate":"2027-04-03","agePolicyApproved":false,"eligibilityApproved":false}'::jsonb, now()) on conflict (key) do nothing;
insert into mrindianz.site_settings (key, published, published_at) values ('milestones', '[{"date":"2026-12-15","label":"Public registration opens (target)","confirmed":false},{"date":"2027-01-31","label":"Applications close (suggested)","confirmed":false},{"date":"2027-02-06","label":"Auditions / screening weekend, 6–7 February (suggested)","confirmed":false},{"date":"2027-02-12","label":"Finalist selection and offers (suggested)","confirmed":false},{"date":"2027-03-20","label":"Compulsory rehearsal weekend, 20–21 March","confirmed":true},{"date":"2027-04-03","label":"Grand Finale — The Cloud, Auckland","confirmed":true}]'::jsonb, now()) on conflict (key) do nothing;
insert into mrindianz.site_settings (key, published, published_at) values ('contact', '{"email":null,"phone":null,"socials":{}}'::jsonb, now()) on conflict (key) do nothing;
insert into mrindianz.site_settings (key, published, published_at) values ('tickets', '{"url":null,"note":"Ticketing partner to be confirmed. Ticket details will be published here."}'::jsonb, now()) on conflict (key) do nothing;
insert into mrindianz.site_settings (key, published, published_at) values ('legal', '{"versions":{"privacy":"draft-2026-11-18","websiteTerms":"draft-2026-11-18","contestantTerms":"draft-2026-11-18","votingRules":"draft-2026-11"},"approved":{"privacy":false,"websiteTerms":false,"contestantTerms":false,"votingRules":false}}'::jsonb, now()) on conflict (key) do nothing;
insert into mrindianz.site_settings (key, published, published_at) values ('announcement', '{"enabled":false,"text":"","href":null}'::jsonb, now()) on conflict (key) do nothing;
insert into mrindianz.site_settings (key, published, published_at) values ('media', '{"heroImage":null,"heroVideo":null,"ctaImage":"https://www.missindiasouthpacific.com/finale-2026/opening-lineup.webp","legacy":[{"src":"https://www.missindiasouthpacific.com/finale-2026/opening-lineup.webp","alt":"Contestants from New Zealand, Fiji and Australia on stage at the Miss India South Pacific Grand Finale","caption":"Opening line-up"},{"src":"https://www.missindiasouthpacific.com/finale-2026/runway.webp","alt":"A runway presentation during the Miss India South Pacific Grand Finale","caption":"The runway"},{"src":"https://www.missindiasouthpacific.com/finale-2026/dance.webp","alt":"Dancers perform at the Miss India South Pacific Grand Finale","caption":"Live performance"},{"src":"https://www.missindiasouthpacific.com/finale-2026/cultural-round.webp","alt":"A colourful presentation during the cultural round","caption":"Cultural round"},{"src":"https://www.missindiasouthpacific.com/finale-2026/crowning.webp","alt":"The inaugural Miss India South Pacific crowning","caption":"The crowning"}]}'::jsonb, now()) on conflict (key) do nothing;
insert into mrindianz.content_pages (slug, title, meta_description) values ('home', 'Mr. IndiaNZ 2027', 'The inaugural Mr. IndiaNZ pageant — Saturday 3 April 2027 at The Cloud, Auckland. Apply free online.') on conflict (slug) do nothing;
insert into mrindianz.content_pages (slug, title, meta_description) values ('about', 'About Mr. IndiaNZ', 'A new national platform celebrating the confidence, character, cultural heritage and individuality of Kiwi-Indian men.') on conflict (slug) do nothing;
insert into mrindianz.content_pages (slug, title, meta_description) values ('competition', 'The Competition', 'Rounds, eligibility, auditions, judging, rehearsals, contestant fee and awards for Mr. IndiaNZ 2027.') on conflict (slug) do nothing;
insert into mrindianz.content_sections (page_slug, key, sort_order, published, approval_status, published_at) values ('home', 'about', 10, '{"title":"About Mr. IndiaNZ","body":"Mr. IndiaNZ is a new national platform celebrating the confidence, character, cultural heritage and individuality of Kiwi-Indian men. Building on the experience of the teams behind Miss IndiaNZ and Miss India South Pacific, the competition brings together Indian cultural expression, contemporary fashion, personality, talent and stage presentation."}'::jsonb, 'pending_approval', now()) on conflict (page_slug, key) do nothing;
insert into mrindianz.content_sections (page_slug, key, sort_order, published, approval_status, published_at) values ('home', 'pillars', 20, '{"title":"Three pillars","body":"","items":[{"title":"Culture and Heritage","body":"Regional identity, tradition and the stories that shape who you are."},{"title":"Fashion and Personal Style","body":"Traditional, contemporary and Indo-Western menswear, worn your way."},{"title":"Confidence and Charisma","body":"Communication, authenticity and presence on stage and off."}]}'::jsonb, 'pending_approval', now()) on conflict (page_slug, key) do nothing;
insert into mrindianz.content_sections (page_slug, key, sort_order, published, approval_status, published_at) values ('home', 'why_enter', 30, '{"title":"Why enter?","body":"Discover your potential, celebrate your identity and take part in a professional stage experience. No prior modelling or pageant experience is required. We welcome applicants with diverse stories, interests and aspirations who are ready to represent Kiwi-Indian identity with confidence."}'::jsonb, 'pending_approval', now()) on conflict (page_slug, key) do nothing;
insert into mrindianz.content_sections (page_slug, key, sort_order, published, approval_status, published_at) values ('home', 'journey', 40, '{"title":"Your journey","body":"Apply free online. Shortlisted entrants are invited to an audition. Successful applicants receive an official contestant offer and onboarding information. A NZD $350 participation fee is payable only after selection and acceptance. Finalists take part in preparation, workshops and the compulsory rehearsal weekend before the Grand Finale.","items":[{"title":"Apply free online","body":"Complete the four-step application. No payment is required."},{"title":"Audition","body":"Shortlisted entrants are invited to an audition."},{"title":"Selection offer","body":"Successful applicants receive an official contestant offer and onboarding information."},{"title":"Accept and confirm","body":"A NZD $350 participation fee is payable only after selection and acceptance."},{"title":"Prepare","body":"Preparation, workshops and the compulsory rehearsal weekend."},{"title":"Grand Finale","body":"Take the stage at The Cloud, Auckland."}]}'::jsonb, 'pending_approval', now()) on conflict (page_slug, key) do nothing;
insert into mrindianz.content_sections (page_slug, key, sort_order, published, approval_status, published_at) values ('home', 'peoples_choice', 50, '{"title":"People''s Choice","body":"Supporters will be able to back their favourite finalist through the People''s Choice Award once finalists are announced. The People''s Choice Award is separate from the main Mr. IndiaNZ title."}'::jsonb, 'pending_approval', now()) on conflict (page_slug, key) do nothing;
insert into mrindianz.content_sections (page_slug, key, sort_order, published, approval_status, published_at) values ('home', 'organiser', 60, '{"title":"Presented by Rhythm House Events & Films","body":"Mr. IndiaNZ is produced by Rhythm House Events & Films, building on the experience of the teams behind Miss IndiaNZ and Miss India South Pacific."}'::jsonb, 'pending_approval', now()) on conflict (page_slug, key) do nothing;
insert into mrindianz.content_sections (page_slug, key, sort_order, published, approval_status, published_at) values ('about', 'purpose', 10, '{"title":"Our purpose","body":"Mr. IndiaNZ is a new national platform celebrating the confidence, character, cultural heritage and individuality of Kiwi-Indian men. Building on the experience of the teams behind Miss IndiaNZ and Miss India South Pacific, the competition brings together Indian cultural expression, contemporary fashion, personality, talent and stage presentation."}'::jsonb, 'pending_approval', now()) on conflict (page_slug, key) do nothing;
insert into mrindianz.content_sections (page_slug, key, sort_order, published, approval_status, published_at) values ('about', 'identity', 20, '{"title":"Kiwi-Indian identity","body":"Mr. IndiaNZ celebrates what it means to be Kiwi-Indian: the heritage carried from many regions of India and the wider diaspora, and the individuality, confidence and character of men who call Aotearoa New Zealand home.\n\nWe welcome applicants with diverse stories, interests and aspirations who are ready to represent Kiwi-Indian identity with confidence."}'::jsonb, 'pending_approval', now()) on conflict (page_slug, key) do nothing;
insert into mrindianz.content_sections (page_slug, key, sort_order, published, approval_status, published_at) values ('about', 'legacy', 30, '{"title":"A legacy of Kiwi-Indian pageantry","body":"Mr. IndiaNZ builds on the experience of the teams behind Miss IndiaNZ and Miss India South Pacific, while establishing itself as its own credible, premium Kiwi-Indian competition."}'::jsonb, 'pending_approval', now()) on conflict (page_slug, key) do nothing;
insert into mrindianz.content_sections (page_slug, key, sort_order, published, approval_status, published_at) values ('about', 'inaugural', 40, '{"title":"The inaugural competition","body":"The first Mr. IndiaNZ Grand Finale takes place on Saturday 3 April 2027 at The Cloud, Queens Wharf, Auckland. Selected contestants take part in preparation, workshops and a compulsory rehearsal weekend on 20–21 March 2027."}'::jsonb, 'pending_approval', now()) on conflict (page_slug, key) do nothing;
insert into mrindianz.content_sections (page_slug, key, sort_order, published, approval_status, published_at) values ('competition', 'rounds', 10, '{"title":"Competition rounds","body":"The competition format is consistent with existing Miss IndiaNZ and Miss India South Pacific events.","items":[{"title":"Round 1: Made in India","body":"Traditional Indian menswear and a short contestant introduction. Showcase regional identity and cultural expression."},{"title":"Round 2: Kiwi Guy","body":"Modern, contemporary or Indo-Western menswear and runway presentation. Focus on individuality, style and confidence."},{"title":"Round 3: Desi Gentleman","body":"Formal or Indian eveningwear and on-stage Q&A. Assessing communication, authenticity and presence."},{"title":"Optional: Mr. Talent","body":"By audition only. A separate award that is not part of the main title score."},{"title":"Finale","body":"Special awards, runners-up and the crowning of Mr. IndiaNZ 2027."}]}'::jsonb, 'pending_approval', now()) on conflict (page_slug, key) do nothing;
insert into mrindianz.content_sections (page_slug, key, sort_order, published, approval_status, published_at) values ('competition', 'eligibility', 20, '{"title":"Eligibility (draft — pending organiser and legal approval)","body":"Final eligibility definitions will be confirmed before applications open.","items":[{"title":"Who can apply","body":"Open to men of Indian origin or heritage living in New Zealand, including members of the wider Indian diaspora. Exact legal eligibility definitions are to be approved."},{"title":"Age","body":"Proposed minimum age: 18 on Grand Finale day (3 April 2027). Final age policy to be confirmed."},{"title":"Experience","body":"No prior pageant or modelling experience is necessary. There is no minimum height or physique requirement."},{"title":"Availability","body":"Available for official obligations, including the 20–21 March 2027 rehearsal weekend and the 3 April 2027 Grand Finale."},{"title":"Rules","body":"Participation is subject to acceptance of the official rules and contestant agreement."}]}'::jsonb, 'pending_approval', now()) on conflict (page_slug, key) do nothing;
insert into mrindianz.content_sections (page_slug, key, sort_order, published, approval_status, published_at) values ('competition', 'auditions', 30, '{"title":"Auditions","body":"Shortlisted applicants are invited to an audition. The suggested audition and screening weekend is 6–7 February 2027, with finalist selection and offers targeted for 12 February 2027. Mr. Talent is assessed through audition."}'::jsonb, 'pending_approval', now()) on conflict (page_slug, key) do nothing;
insert into mrindianz.content_sections (page_slug, key, sort_order, published, approval_status, published_at) values ('competition', 'judging', 40, '{"title":"Judging principles","body":"Each round focuses on a different quality: cultural expression in Made in India, individuality, style and confidence in Kiwi Guy, and communication, authenticity and presence in Desi Gentleman. Applications are not assessed on the quality or cost of professional photography.\n\nDetailed judging criteria will be published once approved by the organiser."}'::jsonb, 'pending_approval', now()) on conflict (page_slug, key) do nothing;
insert into mrindianz.content_sections (page_slug, key, sort_order, published, approval_status, published_at) values ('competition', 'rehearsals', 50, '{"title":"Compulsory rehearsals","body":"The rehearsal weekend is Saturday 20 and Sunday 21 March 2027 (the weekend before Easter). Attendance is compulsory for selected contestants. No compulsory rehearsal is planned over Easter weekend."}'::jsonb, 'approved', now()) on conflict (page_slug, key) do nothing;
insert into mrindianz.content_sections (page_slug, key, sort_order, published, approval_status, published_at) values ('competition', 'fee', 60, '{"title":"Contestant fee","body":"Applying for Mr. IndiaNZ 2027 is free. If you are selected as an official contestant and accept the invitation, a NZD $350 contestant participation fee will apply. No payment is required when submitting this application. Full payment, withdrawal and refund terms will be provided before acceptance."}'::jsonb, 'approved', now()) on conflict (page_slug, key) do nothing;
insert into mrindianz.content_sections (page_slug, key, sort_order, published, approval_status, published_at) values ('competition', 'awards', 70, '{"title":"Awards","body":"The Grand Finale includes special awards, runners-up and the crowning of Mr. IndiaNZ 2027. The Mr. Talent award and the People''s Choice Award are separate from the main title."}'::jsonb, 'pending_approval', now()) on conflict (page_slug, key) do nothing;
insert into mrindianz.content_sections (page_slug, key, sort_order, published, approval_status, published_at) values ('competition', 'process', 80, '{"title":"Application process","body":"Check eligibility and key dates → complete the free application → receive an acknowledgement → shortlisted applicants are invited to audition → selection offer → accept conditions → pay the NZD $350 fee by secure link → receive onboarding information and the rehearsal schedule → participate."}'::jsonb, 'pending_approval', now()) on conflict (page_slug, key) do nothing;
insert into mrindianz.faqs (question, answer, category, sort_order, is_published, approval_status)
select v.question, v.answer, v.category, v.sort_order, true, v.approval_status from (values
  ('Does it cost anything to apply?', 'No. Online applications are free. The $350 contestant fee is charged only if you are selected and accept an official place.', 'applying', 10, 'approved'),
  ('Do I need modelling experience?', 'No. The competition welcomes first-time applicants.', 'applying', 20, 'approved'),
  ('Who is eligible?', 'The proposed eligibility is men of Indian origin or heritage living in New Zealand, including members of the wider Indian diaspora, aged 18 or over on Grand Finale day. Final eligibility definitions are being confirmed and will be published before applications open.', 'applying', 30, 'pending_approval'),
  ('When is rehearsal?', 'Saturday 20 and Sunday 21 March 2027. Attendance is compulsory for selected contestants.', 'competition', 40, 'approved'),
  ('What are the competition rounds?', 'Round 1: Made in India (traditional Indian menswear and a short introduction), Round 2: Kiwi Guy (modern, contemporary or Indo-Western menswear and runway), and Round 3: Desi Gentleman (formal or Indian eveningwear and on-stage Q&A).', 'competition', 50, 'pending_approval'),
  ('Will I need outfits?', 'Contestants will receive detailed wardrobe guidance after selection. Anticipate traditional Indian, contemporary and formal menswear.', 'competition', 60, 'approved'),
  ('Is the talent round mandatory?', 'No. The optional Mr. Talent award is assessed separately from the main title.', 'competition', 70, 'approved'),
  ('When do I pay $350?', 'After official selection and acceptance, according to the published contestant agreement. Payment methods and refund terms will be supplied before acceptance.', 'fees', 80, 'approved'),
  ('How are contestants selected?', 'Applications are reviewed and shortlisted applicants are invited to an audition. Successful applicants then receive an official contestant offer. Suggested dates: auditions 6–7 February 2027 and finalist offers by 12 February 2027.', 'applying', 90, 'pending_approval'),
  ('What is the People''s Choice Award?', 'Supporters can back their favourite finalist by purchasing votes once People''s Choice voting opens. The People''s Choice Award is separate from the main Mr. IndiaNZ title.', 'voting', 100, 'pending_approval'),
  ('How do voting packages work?', 'Each package provides a fixed number of votes for a fixed price, shown before you pay. Votes are credited only after your payment is verified. Final package prices are yet to be approved.', 'voting', 110, 'pending_approval'),
  ('Is payment secure?', 'Payments will be processed by Stripe on a secure hosted checkout page. Card details are never entered on or stored by this website.', 'voting', 120, 'pending_approval'),
  ('Can I get a refund on votes?', 'Refund terms for People''s Choice votes are being finalised and will be published in the voting rules before voting opens. Refunded or disputed payments have their votes removed from the leaderboard.', 'voting', 130, 'pending_approval')
) as v(question, answer, category, sort_order, approval_status)
where not exists (select 1 from mrindianz.faqs);
insert into mrindianz.email_templates (key, name, subject, body, description) values ('application_received', 'Application received', 'Your Mr. IndiaNZ 2027 application has been received ({{reference}})', 'Kia ora {{first_name}},

Thank you for applying to Mr. IndiaNZ 2027. Your application has been received.

Your application reference is {{reference}}.

Our team will contact shortlisted applicants regarding auditions. Please check your inbox and spam folder.

Applying is free. If you are selected as an official contestant and accept the invitation, a NZD $350 contestant participation fee will apply. Full payment, withdrawal and refund terms will be provided before acceptance.

Ngā mihi,
The Mr. IndiaNZ team', 'Sent to the applicant after a successful submission.') on conflict (key) do nothing;
insert into mrindianz.email_templates (key, name, subject, body, description) values ('application_shortlisted', 'Application shortlisted', 'Mr. IndiaNZ 2027 — you have been shortlisted', 'Kia ora {{first_name}},

Congratulations — your application ({{reference}}) has been shortlisted for Mr. IndiaNZ 2027.

We will be in touch shortly with audition details.

Ngā mihi,
The Mr. IndiaNZ team', 'Optional notification when an application is shortlisted.') on conflict (key) do nothing;
insert into mrindianz.email_templates (key, name, subject, body, description) values ('audition_invitation', 'Audition invitation', 'Mr. IndiaNZ 2027 — audition invitation', 'Kia ora {{first_name}},

We are delighted to invite you to audition for Mr. IndiaNZ 2027.

Date and time: {{audition_details}}

Please reply to confirm your attendance. If you applied for Mr. Talent, please be prepared to present your talent.

Ngā mihi,
The Mr. IndiaNZ team', 'Invitation to the audition/screening weekend. Edit date, time and venue before sending.') on conflict (key) do nothing;
insert into mrindianz.email_templates (key, name, subject, body, description) values ('selection_offer', 'Selection offer', 'Mr. IndiaNZ 2027 — official contestant offer', 'Kia ora {{first_name}},

Congratulations! We are pleased to offer you an official place as a contestant in Mr. IndiaNZ 2027.

Please review the contestant agreement, including payment, withdrawal and refund terms, before accepting: {{site_url}}/contestant-terms

The NZD $350 contestant participation fee is payable only after you accept this offer.

{{offer_details}}

Ngā mihi,
The Mr. IndiaNZ team', 'Official contestant offer. Must link to the approved contestant agreement.') on conflict (key) do nothing;
insert into mrindianz.email_templates (key, name, subject, body, description) values ('application_unsuccessful', 'Unsuccessful application', 'Your Mr. IndiaNZ 2027 application', 'Kia ora {{first_name}},

Thank you for applying to Mr. IndiaNZ 2027 and for sharing your story with us.

After careful consideration, we are unable to offer you a place in this year''s competition. We received many strong applications and this decision was not easy.

We hope you will stay connected with Mr. IndiaNZ and consider applying again in future.

Ngā mihi,
The Mr. IndiaNZ team', 'Rejection template for unsuccessful applicants.') on conflict (key) do nothing;
insert into mrindianz.email_templates (key, name, subject, body, description) values ('acceptance_confirmation', 'Acceptance confirmation', 'Mr. IndiaNZ 2027 — acceptance received', 'Kia ora {{first_name}},

Thank you for accepting your place in Mr. IndiaNZ 2027. Fee payment instructions will follow separately.

Ngā mihi,
The Mr. IndiaNZ team', 'Confirms the applicant accepted the offer.') on conflict (key) do nothing;
insert into mrindianz.email_templates (key, name, subject, body, description) values ('contestant_fee_instructions', 'Contestant fee instructions', 'Mr. IndiaNZ 2027 — contestant fee', 'Kia ora {{first_name}},

Please pay your NZD $350 contestant participation fee using this secure link: {{payment_link}}

Payment due: {{due_date}}

Ngā mihi,
The Mr. IndiaNZ team', 'Secure payment link for the NZD $350 fee. Disabled until fee/GST/refund terms are approved.') on conflict (key) do nothing;
insert into mrindianz.email_templates (key, name, subject, body, description) values ('contestant_confirmation', 'Contestant confirmation', 'Welcome to Mr. IndiaNZ 2027', 'Kia ora {{first_name}},

Your place in Mr. IndiaNZ 2027 is confirmed. Onboarding information and the rehearsal schedule will follow.

Compulsory rehearsals: Saturday 20 and Sunday 21 March 2027.
Grand Finale: Saturday 3 April 2027, The Cloud, Auckland.

Ngā mihi,
The Mr. IndiaNZ team', 'Sent once the contestant is confirmed.') on conflict (key) do nothing;
insert into mrindianz.email_templates (key, name, subject, body, description) values ('voting_receipt', 'Voting payment receipt', 'Your People''s Choice votes for {{contestant_name}} ({{order_ref}})', 'Kia ora {{supporter_name}},

Thank you for supporting {{contestant_name}} in the Mr. IndiaNZ 2027 People''s Choice Award.

Order reference: {{order_ref}}
Package: {{package_name}} × {{quantity}}
Votes credited: {{votes}}
Amount paid: {{amount}}

The People''s Choice Award is separate from the main Mr. IndiaNZ title.

Ngā mihi,
The Mr. IndiaNZ team', 'Sent after a verified People''s Choice payment.') on conflict (key) do nothing;
insert into mrindianz.email_templates (key, name, subject, body, description) values ('voting_payment_failed', 'Failed payment', 'Your People''s Choice payment was not completed', 'Kia ora {{supporter_name}},

Your payment for order {{order_ref}} was not completed, so no votes were credited and you have not been charged.

You can try again at {{site_url}}/peoples-choice

Ngā mihi,
The Mr. IndiaNZ team', 'Sent when a voting payment fails or expires.') on conflict (key) do nothing;
insert into mrindianz.email_templates (key, name, subject, body, description) values ('refund_confirmation', 'Refund confirmation', 'Refund processed for order {{order_ref}}', 'Kia ora {{supporter_name}},

A refund of {{amount}} has been processed for order {{order_ref}}. The associated votes have been removed from the leaderboard.

Ngā mihi,
The Mr. IndiaNZ team', 'Sent when a voting payment is refunded.') on conflict (key) do nothing;
insert into mrindianz.email_templates (key, name, subject, body, description) values ('contact_acknowledgement', 'Contact acknowledgement', 'We have received your message', 'Kia ora {{name}},

Thank you for contacting Mr. IndiaNZ. We have received your message about "{{subject}}" and will reply as soon as possible.

Ngā mihi,
The Mr. IndiaNZ team', 'Sent after the contact form is submitted.') on conflict (key) do nothing;
insert into mrindianz.email_templates (key, name, subject, body, description) values ('admin_notification', 'Admin notification', '[Mr. IndiaNZ] {{event}}', '{{event}}

Reference: {{reference}}

Open the admin dashboard to review: {{site_url}}/admin', 'Internal notification. Contains no applicant personal details beyond a reference.') on conflict (key) do nothing;

-- People's Choice campaign for 2027: created in DRAFT (not public). Packages are DEMONSTRATION VALUES
-- copied from the reference voting model and are NOT approved Mr. IndiaNZ prices.
insert into mrindianz.voting_campaigns (slug, name, status, is_demo, rules_version, price_note)
values ('peoples-choice-2027', 'People''s Choice Award 2027', 'draft', false, 'draft-2026-11',
        'Demonstration pricing — package prices, GST and processing-fee treatment are pending organiser approval.')
on conflict (slug) do nothing;
insert into mrindianz.voting_packages (campaign_id, name, display_label, price_cents, votes, sort_order, is_demo_value)
select c.id, v.name, v.label, v.price_cents, v.votes, v.sort_order, true
  from mrindianz.voting_campaigns c,
       (values ('Starter', 'Demonstration value', 400, 20, 10), ('Supporter', 'Demonstration value', 1000, 50, 20),
               ('Champion', 'Demonstration value', 2200, 120, 30), ('Premium', 'Demonstration value', 5000, 300, 40),
               ('Ultimate', 'Demonstration value', 10000, 700, 50)) as v(name, label, price_cents, votes, sort_order)
 where c.slug = 'peoples-choice-2027'
   and not exists (select 1 from mrindianz.voting_packages p where p.campaign_id = c.id);



-- ---------------------------------------------------------------------------
-- 20261118000006_admin_functions.sql
-- ---------------------------------------------------------------------------
-- Admin helper functions. SECURITY INVOKER: callers' RLS policies still apply.

create or replace function mrindianz.change_application_status(p_ids uuid[], p_status mrindianz.application_status, p_note text default null)
returns int language plpgsql security invoker set search_path = '' as $$
declare v_count int;
begin
  perform set_config('app.status_note', coalesce(left(p_note, 500), ''), true);
  update mrindianz.applications set status = p_status where id = any (p_ids) and status is distinct from p_status and anonymised_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
grant execute on function mrindianz.change_application_status(uuid[], mrindianz.application_status, text) to authenticated;

-- Dashboard figures, computed from the ledger and orders (never from editable totals).
create or replace function mrindianz.admin_finance_summary(p_mode mrindianz.payment_mode default 'live')
returns table (verified_votes bigint, gross_cents bigint, refunded_cents bigint, paid_orders bigint, pending_orders bigint, disputed_orders bigint)
language sql stable security invoker set search_path = '' as $$
  select
    (select coalesce(sum(votes), 0) from mrindianz.vote_ledger where payment_mode = p_mode)::bigint,
    (select coalesce(sum(total_cents), 0) from mrindianz.voting_orders where payment_mode = p_mode and paid_at is not null)::bigint,
    (select coalesce(sum(r.amount_cents), 0) from mrindianz.payment_refunds r join mrindianz.voting_orders o on o.id = r.order_id where o.payment_mode = p_mode)::bigint,
    (select count(*) from mrindianz.voting_orders where payment_mode = p_mode and status = 'paid')::bigint,
    (select count(*) from mrindianz.voting_orders where payment_mode = p_mode and status in ('pending', 'awaiting_payment'))::bigint,
    (select count(*) from mrindianz.voting_orders where payment_mode = p_mode and status = 'disputed')::bigint;
$$;
grant execute on function mrindianz.admin_finance_summary(mrindianz.payment_mode) to authenticated;

-- Per-contestant tallies for finance reconciliation (all entry types, including reversals).
create or replace function mrindianz.admin_contestant_tallies(p_campaign_id uuid, p_mode mrindianz.payment_mode default 'live')
returns table (contestant_id uuid, public_name text, credits bigint, reversals bigint, net bigint)
language sql stable security invoker set search_path = '' as $$
  select k.id, k.public_name,
         coalesce(sum(l.votes) filter (where l.votes > 0), 0)::bigint,
         coalesce(sum(l.votes) filter (where l.votes < 0), 0)::bigint,
         coalesce(sum(l.votes), 0)::bigint
    from mrindianz.contestants k
    left join mrindianz.vote_ledger l on l.contestant_id = k.id and l.campaign_id = p_campaign_id and l.payment_mode = p_mode
   group by k.id, k.public_name
   order by 5 desc, 2;
$$;
grant execute on function mrindianz.admin_contestant_tallies(uuid, mrindianz.payment_mode) to authenticated;

insert into mrindianz.email_templates (key, name, subject, body, description) values
  ('application_unsuccessful', 'Unsuccessful application', 'Your Mr. IndiaNZ 2027 application',
   E'Kia ora {{first_name}},\n\nThank you for applying to Mr. IndiaNZ 2027 and for sharing your story with us.\n\nAfter careful consideration, we are unable to offer you a place in this year''s competition. We received many strong applications and this decision was not easy.\n\nWe hope you will stay connected with Mr. IndiaNZ and consider applying again in future.\n\nNgā mihi,\nThe Mr. IndiaNZ team',
   'Rejection template for unsuccessful applicants.')
on conflict (key) do nothing;

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
