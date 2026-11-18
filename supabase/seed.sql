-- LOCAL / STAGING DEMO DATA ONLY. Never run against production.
-- Creates a clearly-labelled demo voting campaign and placeholder demo contestants (no photographs).
-- Demo votes use payment_mode = 'demo' and are counted only on the demo campaign's leaderboard.

insert into public.voting_campaigns (slug, name, status, is_demo, opens_at, closes_at, rules_version, show_supporter_history, price_note)
values ('demo-peoples-choice', 'DEMO — People''s Choice (test environment)', 'open', true,
        now() - interval '1 day', now() + interval '60 days', 'draft-2026-11', true,
        'DEMO environment — no real payments are taken and demo votes are never shown on production.')
on conflict (slug) do nothing;

insert into public.voting_packages (campaign_id, name, display_label, price_cents, votes, sort_order, is_demo_value)
select c.id, v.name, 'Demonstration value', v.price_cents, v.votes, v.sort_order, true
  from public.voting_campaigns c,
       (values ('Starter', 400, 20, 10), ('Supporter', 1000, 50, 20), ('Champion', 2200, 120, 30),
               ('Premium', 5000, 300, 40), ('Ultimate', 10000, 700, 50)) as v(name, price_cents, votes, sort_order)
 where c.slug = 'demo-peoples-choice'
   and not exists (select 1 from public.voting_packages p where p.campaign_id = c.id);

insert into public.contestants (slug, contestant_number, public_name, short_bio, biography, city_region, interests,
  publication_status, voting_eligible)
select 'demo-contestant-' || lpad(n::text, 2, '0'), 900 + n, 'Demo Contestant ' || lpad(n::text, 2, '0'),
       'Placeholder profile for testing. Not a real contestant.',
       'This is a demonstration profile used to test the contestant gallery, QR codes and People''s Choice voting. It will not appear on production.',
       'Auckland', array['Demo'], 'published', true
  from generate_series(1, 6) as n
on conflict (slug) do nothing;
