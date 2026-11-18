-- Give a Supabase Auth user access to the Mr. IndiaNZ admin (https://www.mrindianz.co.nz/admin).
-- 1) First create the user: Supabase → Authentication → Users → Add user → "Create new user",
--    enter the email and a strong password, tick "Auto Confirm User".
-- 2) Replace the email below, then Run. Roles: super_admin, organiser_admin, content_editor,
--    application_reviewer, finance_viewer. This grants access ONLY to Mr. IndiaNZ data.
do $$
declare v_email text := 'CHANGE-ME@example.com';  -- <— the admin's email
        v_role  mrindianz.admin_role := 'super_admin';
        v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(v_email);
  if v_id is null then
    raise exception 'No Supabase user with email %. Create it under Authentication → Users first.', v_email;
  end if;
  insert into mrindianz.profiles (id, email) values (v_id, lower(v_email)) on conflict (id) do nothing;
  insert into mrindianz.admin_roles (user_id, role) values (v_id, v_role) on conflict do nothing;
  raise notice 'Granted % to %', v_role, v_email;
end $$;

select u.email, r.role, r.granted_at
  from mrindianz.admin_roles r join auth.users u on u.id = r.user_id
 order by r.granted_at;
