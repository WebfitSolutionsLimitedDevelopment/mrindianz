-- Storage buckets. Application photographs are PRIVATE; reviewers see them via short-lived signed URLs
-- generated server-side. Public media holds only approved contestant/partner imagery.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('application-media', 'application-media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('public-media', 'public-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No anon/authenticated policies on application-media: uploads use server-issued signed upload URLs,
-- reads use server-issued signed URLs after a role check. Public users can never list or read it.

create policy "public media readable" on storage.objects for select to anon, authenticated
  using (bucket_id = 'public-media');
create policy "editors upload public media" on storage.objects for insert to authenticated
  with check (bucket_id = 'public-media'
    and public.has_role(array['organiser_admin','content_editor']::public.admin_role[]));
create policy "editors update public media" on storage.objects for update to authenticated
  using (bucket_id = 'public-media'
    and public.has_role(array['organiser_admin','content_editor']::public.admin_role[]));
create policy "editors delete public media" on storage.objects for delete to authenticated
  using (bucket_id = 'public-media'
    and public.has_role(array['organiser_admin','content_editor']::public.admin_role[]));

