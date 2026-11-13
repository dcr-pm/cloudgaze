-- KidLog access rules. Everything is denied unless a policy below allows it.
--
--   log_only       log entries; see activities and routines, and your own expenses
--   view_expenses  also see everyone's expenses and receipts
--   full           also edit anyone's entries, manage the circle, routines and child

alter table public.profiles       enable row level security;
alter table public.children       enable row level security;
alter table public.circle_members enable row level security;
alter table public.invites        enable row level security;
alter table public.routines       enable row level security;
alter table public.entries        enable row level security;
alter table public.entry_edits    enable row level security;

-- Table privileges: only what the policies can ever allow. No hard deletes of
-- entries, no client writes to entry_edits, no direct inserts of children.
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select, update (display_name, simple_mode)         on public.profiles       to authenticated;
grant select, update (name, birthdate, photo_url)        on public.children       to authenticated;
grant select, update (role, permission), delete          on public.circle_members to authenticated;
grant select, insert, delete                             on public.invites        to authenticated;
grant select, insert, update (name, schedule, sort_order, archived_at)
                                                         on public.routines       to authenticated;
grant select, insert,
      update (type, title, note, occurred_at, amount, currency, category, receipt_url, deleted_at)
                                                         on public.entries        to authenticated;
grant select                                             on public.entry_edits    to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_member(uuid)                               to authenticated;
grant execute on function public.has_permission(uuid, public.member_permission) to authenticated;
grant execute on function public.shares_circle(uuid)                           to authenticated;
grant execute on function public.path_child(text)                              to authenticated;
grant execute on function public.create_child(text, date)                      to authenticated;
grant execute on function public.accept_invite(text)                           to authenticated;
grant execute on function public.invite_preview(text)                          to anon, authenticated;

-- profiles ------------------------------------------------------------------
create policy "profiles: read self and circle" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_circle(id));

create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- children ------------------------------------------------------------------
-- Inserts go through create_child().
create policy "children: members read" on public.children
  for select to authenticated
  using (public.is_member(id));

create policy "children: full updates" on public.children
  for update to authenticated
  using (public.has_permission(id, 'full'))
  with check (public.has_permission(id, 'full'));

-- circle_members ------------------------------------------------------------
-- Inserts go through create_child() and accept_invite().
create policy "circle: members read" on public.circle_members
  for select to authenticated
  using (public.is_member(child_id));

create policy "circle: full updates" on public.circle_members
  for update to authenticated
  using (public.has_permission(child_id, 'full'))
  with check (public.has_permission(child_id, 'full'));

create policy "circle: full removes, anyone leaves" on public.circle_members
  for delete to authenticated
  using (public.has_permission(child_id, 'full') or user_id = (select auth.uid()));

-- invites -------------------------------------------------------------------
create policy "invites: full read" on public.invites
  for select to authenticated
  using (public.has_permission(child_id, 'full'));

create policy "invites: full create" on public.invites
  for insert to authenticated
  with check (
    public.has_permission(child_id, 'full')
    and created_by = (select auth.uid())
    and accepted_by is null and accepted_at is null
  );

create policy "invites: full revoke" on public.invites
  for delete to authenticated
  using (public.has_permission(child_id, 'full'));

-- routines ------------------------------------------------------------------
create policy "routines: members read" on public.routines
  for select to authenticated
  using (public.is_member(child_id));

create policy "routines: full create" on public.routines
  for insert to authenticated
  with check (public.has_permission(child_id, 'full'));

create policy "routines: full update" on public.routines
  for update to authenticated
  using (public.has_permission(child_id, 'full'))
  with check (public.has_permission(child_id, 'full'));

-- entries -------------------------------------------------------------------
create policy "entries: members read, expenses need permission" on public.entries
  for select to authenticated
  using (
    public.is_member(child_id)
    and (
      type <> 'expense'
      or author_id = (select auth.uid())
      or public.has_permission(child_id, 'view_expenses')
    )
  );

create policy "entries: members log as themselves" on public.entries
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.is_member(child_id)
    and deleted_at is null
  );

create policy "entries: author or full edits" on public.entries
  for update to authenticated
  using (
    (author_id = (select auth.uid()) and public.is_member(child_id))
    or public.has_permission(child_id, 'full')
  )
  with check (
    (author_id = (select auth.uid()) and public.is_member(child_id))
    or public.has_permission(child_id, 'full')
  );

-- entry_edits ---------------------------------------------------------------
-- Visible to anyone who can see the entry (the subquery runs under the
-- reader's own entries policy). Written only by the entries trigger.
create policy "edits: visible with the entry" on public.entry_edits
  for select to authenticated
  using (exists (select 1 from public.entries e where e.id = entry_id));
