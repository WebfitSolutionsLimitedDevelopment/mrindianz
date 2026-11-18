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
