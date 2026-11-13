-- Private buckets. Object names start with the child id: "<child_id>/<file>".

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false), ('child-photos', 'child-photos', false)
on conflict (id) do nothing;

-- receipts: any member uploads; readable by the uploader and by view_expenses+.
create policy "receipts: members upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and public.is_member(public.path_child(name)));

create policy "receipts: uploader or expense viewers read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and (
      (owner_id = (select auth.uid())::text and public.is_member(public.path_child(name)))
      or public.has_permission(public.path_child(name), 'view_expenses')
    )
  );

-- child-photos: members read; full permission writes.
create policy "child photos: members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'child-photos' and public.is_member(public.path_child(name)));

create policy "child photos: full upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'child-photos' and public.has_permission(public.path_child(name), 'full'));

create policy "child photos: full replace" on storage.objects
  for update to authenticated
  using (bucket_id = 'child-photos' and public.has_permission(public.path_child(name), 'full'))
  with check (bucket_id = 'child-photos' and public.has_permission(public.path_child(name), 'full'));
