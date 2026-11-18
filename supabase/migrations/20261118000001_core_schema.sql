-- Mr. IndiaNZ 2027 — core schema
-- All primary keys are UUIDs. Money is stored as integer cents. Timestamps are timestamptz (UTC);
-- the event timezone (Pacific/Auckland) is applied in presentation and in voting-window checks.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------
create type public.admin_role as enum (
  'super_admin', 'organiser_admin', 'content_editor', 'application_reviewer', 'finance_viewer'
);

create type public.application_status as enum (
  'new', 'in_review', 'shortlisted', 'offered', 'accepted', 'awaiting_payment',
  'confirmed', 'waitlisted', 'unsuccessful', 'withdrawn'
);

create type public.publication_status as enum ('draft', 'published', 'archived');

create type public.voting_status as enum ('draft', 'scheduled', 'open', 'paused', 'closed', 'finalised');

create type public.payment_mode as enum ('live', 'test', 'demo');

create type public.order_status as enum (
  'pending', 'awaiting_payment', 'paid', 'failed', 'expired', 'cancelled',
  'refunded', 'partially_refunded', 'disputed', 'review_required'
);

create type public.ledger_entry_type as enum (
  'credit', 'refund_reversal', 'dispute_reversal', 'dispute_reinstatement', 'admin_adjustment'
);

-- ---------------------------------------------------------------------------
-- Utility: updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Admin identity and roles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.admin_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);
create index admin_roles_role_idx on public.admin_roles (role);

-- has_role(): true when the current user holds any of the given roles. super_admin implicitly passes.
create or replace function public.has_role(roles public.admin_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admin_roles ar
    where ar.user_id = auth.uid()
      and (ar.role = any (roles) or ar.role = 'super_admin')
  );
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_roles ar where ar.user_id = auth.uid());
$$;

-- Prevent removing the final super admin (lock-out protection).
create or replace function public.protect_last_super_admin() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.role = 'super_admin'
     and (tg_op = 'DELETE' or new.role <> 'super_admin')
     and (select count(*) from public.admin_roles where role = 'super_admin') <= 1 then
    raise exception 'Cannot remove the last super_admin';
  end if;
  return coalesce(new, old);
end $$;
create trigger admin_roles_protect_last_super
  before delete or update on public.admin_roles
  for each row execute function public.protect_last_super_admin();

-- ---------------------------------------------------------------------------
-- Event, settings and CMS
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  timezone text not null default 'Pacific/Auckland',
  finale_starts_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Key/value settings with a draft and a published value. Public reads see only `published`.
create table public.site_settings (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  published jsonb not null default '{}'::jsonb,
  draft jsonb,
  description text,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table public.content_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  meta_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.content_sections (
  id uuid primary key default gen_random_uuid(),
  page_slug text not null references public.content_pages (slug) on update cascade on delete cascade,
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

create table public.faqs (
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
create index faqs_published_idx on public.faqs (is_published, sort_order);

create table public.partners (
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
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('MINZ27-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  client_submission_id uuid not null unique, -- duplicate-submission protection
  status public.application_status not null default 'new',
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
create index applications_status_idx on public.applications (status, submitted_at desc);
create index applications_email_idx on public.applications (lower(email));

create table public.application_media (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  kind text not null check (kind in ('headshot', 'full_length', 'traditional')),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 5242880),
  created_at timestamptz not null default now(),
  unique (application_id, kind)
);

create table public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  from_status public.application_status,
  to_status public.application_status not null,
  changed_by uuid references auth.users (id) on delete set null,
  note text,
  changed_at timestamptz not null default now()
);
create index application_status_history_app_idx on public.application_status_history (application_id, changed_at);

create table public.application_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

-- Contestant fee (NZ$350) — separate from voting. Disabled until fee/GST/refund terms are approved.
create table public.contestant_fee_payments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete restrict,
  amount_cents int not null check (amount_cents > 0),
  currency text not null default 'NZD' check (currency = 'NZD'),
  status text not null default 'not_started' check (status in ('not_started', 'link_sent', 'paid', 'refunded', 'waived', 'cancelled')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  payment_mode public.payment_mode,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Contestants (public once published)
-- ---------------------------------------------------------------------------
create table public.contestants (
  id uuid primary key default gen_random_uuid(),
  application_id uuid unique references public.applications (id) on delete set null,
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
  publication_status public.publication_status not null default 'draft',
  voting_eligible boolean not null default false,
  sort_order int not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contestants_voting_requires_published check (not voting_eligible or publication_status = 'published')
);
create index contestants_public_idx on public.contestants (publication_status, contestant_number);

create or replace function public.contestants_guard() returns trigger
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
create trigger contestants_guard before insert or update on public.contestants
  for each row execute function public.contestants_guard();

create table public.contestant_media (
  id uuid primary key default gen_random_uuid(),
  contestant_id uuid not null references public.contestants (id) on delete cascade,
  storage_path text not null,
  alt_text text not null default '' check (char_length(alt_text) <= 200),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Contact, email and audit
-- ---------------------------------------------------------------------------
create table public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  subject text not null check (char_length(subject) between 2 and 150),
  message text not null check (char_length(message) between 10 and 4000),
  status text not null default 'new' check (status in ('new', 'read', 'replied', 'spam', 'archived')),
  created_at timestamptz not null default now()
);

create table public.email_templates (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  name text not null,
  subject text not null,
  body text not null,
  description text,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.email_delivery_logs (
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

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create table public.rate_limits (
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
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;
