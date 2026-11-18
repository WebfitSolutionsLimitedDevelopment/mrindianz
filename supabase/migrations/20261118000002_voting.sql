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
