-- KidLog schema: tables, helper functions and triggers.
-- Access rules live in 0002_rls.sql; storage buckets in 0003_storage.sql.

create type public.member_role       as enum ('parent', 'grandparent', 'caregiver');
-- Ordered: log_only < view_expenses < full, so `permission >= 'view_expenses'` works.
create type public.member_permission as enum ('log_only', 'view_expenses', 'full');
create type public.entry_type        as enum ('activity', 'expense', 'routine');

-- "users": one profile per auth.users row, created by trigger on signup.
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  simple_mode  boolean not null default false,
  created_at   timestamptz not null default now()
);

create table public.children (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  birthdate  date,
  photo_url  text, -- storage path in the private "child-photos" bucket
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.circle_members (
  child_id   uuid not null references public.children (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.member_role not null,
  permission public.member_permission not null,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (child_id, user_id)
);
create index circle_members_user_idx on public.circle_members (user_id);

create table public.invites (
  token       text primary key
              default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  child_id    uuid not null references public.children (id) on delete cascade,
  role        public.member_role not null,
  permission  public.member_permission not null,
  created_by  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days',
  accepted_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz
);
create index invites_child_idx on public.invites (child_id);

create table public.routines (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null references public.children (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  -- {"days":[0..6]} with 0 = Sunday; optional "time":"19:30". JSON so calendar sync fits later.
  schedule    jsonb not null default '{"days":[0,1,2,3,4,5,6]}'::jsonb,
  sort_order  int not null default 0,
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);
create index routines_child_idx on public.routines (child_id);

create table public.entries (
  id          uuid primary key default gen_random_uuid(), -- client-generated for optimistic UI
  child_id    uuid not null references public.children (id) on delete cascade,
  author_id   uuid not null default auth.uid() references public.profiles (id),
  type        public.entry_type not null,
  title       text not null check (length(trim(title)) > 0),
  note        text,
  occurred_at timestamptz not null default now(),
  amount      numeric(10,2) check (amount >= 0),
  currency    char(3) not null default 'USD',
  category    text,
  receipt_url text,  -- storage path in the private "receipts" bucket
  routine_id  uuid references public.routines (id) on delete set null,
  group_id    uuid,  -- links the activity + expense that came from one sentence
  source      text not null default 'text'
              check (source in ('text', 'voice', 'receipt', 'routine')),
  deleted_at  timestamptz, -- soft delete only; recorded in entry_edits like any edit
  created_at  timestamptz not null default now(),
  constraint entries_amount_iff_expense check ((type = 'expense') = (amount is not null))
);
create index entries_child_time_idx on public.entries (child_id, occurred_at desc);
create index entries_author_idx on public.entries (author_id);

create table public.entry_edits (
  id        uuid primary key default gen_random_uuid(),
  entry_id  uuid not null references public.entries (id) on delete cascade,
  editor_id uuid not null references public.profiles (id),
  before    jsonb not null, -- only the fields that changed, old values
  after     jsonb not null, -- only the fields that changed, new values
  edited_at timestamptz not null default now()
);
create index entry_edits_entry_idx on public.entry_edits (entry_id, edited_at desc);

-- ---------------------------------------------------------------------------
-- Membership helpers. SECURITY DEFINER so policies on circle_members can call
-- them without recursing into circle_members' own policies.
-- ---------------------------------------------------------------------------

create function public.is_member(_child uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.circle_members m
    where m.child_id = _child and m.user_id = (select auth.uid())
  );
$$;

create function public.has_permission(_child uuid, _min public.member_permission) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.circle_members m
    where m.child_id = _child and m.user_id = (select auth.uid()) and m.permission >= _min
  );
$$;

create function public.shares_circle(_other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.circle_members mine
    join public.circle_members theirs on theirs.child_id = mine.child_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = _other
  );
$$;

-- First path segment of a storage object name, as a child id (null if not a uuid).
create function public.path_child(_name text) returns uuid
language sql immutable set search_path = '' as $$
  select case
    when split_part(_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(_name, '/', 1)::uuid
  end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles: created automatically for every new auth user.
-- ---------------------------------------------------------------------------

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(initcap(split_part(coalesce(new.email, ''), '@', 1)), ''),
      'Someone'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Children and circles
-- ---------------------------------------------------------------------------

-- Creates a child and makes the caller its first parent with full permission.
create function public.create_child(_name text, _birthdate date default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _id  uuid;
begin
  if _uid is null then
    raise exception 'You need to sign in first' using errcode = '28000';
  end if;
  insert into public.children (name, birthdate, created_by)
  values (trim(_name), _birthdate, _uid)
  returning id into _id;
  insert into public.circle_members (child_id, user_id, role, permission)
  values (_id, _uid, 'parent', 'full');
  return _id;
end;
$$;

-- What an invite link shows before joining. The token itself is the secret.
create function public.invite_preview(_token text)
returns table (
  child_id uuid, child_name text, role public.member_role,
  permission public.member_permission, invited_by_name text, valid boolean
)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, i.role, i.permission, p.display_name,
         (i.accepted_at is null and i.expires_at > now())
  from public.invites i
  join public.children c on c.id = i.child_id
  join public.profiles p on p.id = i.created_by
  where i.token = _token;
$$;

-- Joins the caller to the invite's circle. Single use, expires.
create function public.accept_invite(_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _inv public.invites;
begin
  if _uid is null then
    raise exception 'You need to sign in first' using errcode = '28000';
  end if;
  select * into _inv from public.invites where token = _token for update;
  if not found then
    raise exception 'This invite link is not valid';
  end if;
  -- Already in the circle: nothing to do, and the invite stays usable.
  if exists (select 1 from public.circle_members
             where child_id = _inv.child_id and user_id = _uid) then
    return _inv.child_id;
  end if;
  if _inv.accepted_at is not null or _inv.expires_at <= now() then
    raise exception 'This invite link has expired or was already used';
  end if;
  insert into public.circle_members (child_id, user_id, role, permission, invited_by)
  values (_inv.child_id, _uid, _inv.role, _inv.permission, _inv.created_by);
  update public.invites set accepted_by = _uid, accepted_at = now() where token = _token;
  return _inv.child_id;
end;
$$;

-- A circle must always keep at least one member with full permission,
-- and a membership row can't be re-pointed at another child or user.
create function public.circle_members_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.child_id <> old.child_id or new.user_id <> old.user_id) then
    raise exception 'A membership cannot be moved to another child or person';
  end if;
  if old.permission = 'full' and (tg_op = 'DELETE' or new.permission <> 'full') then
    -- Allow cascades when the child or the user's account is being removed.
    if exists (select 1 from public.children where id = old.child_id)
       and exists (select 1 from public.profiles where id = old.user_id)
       and not exists (
         select 1 from public.circle_members
         where child_id = old.child_id and user_id <> old.user_id and permission = 'full'
       ) then
      raise exception 'Every circle needs at least one person with full access';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger circle_members_guard
  before update or delete on public.circle_members
  for each row execute function public.circle_members_guard();

-- ---------------------------------------------------------------------------
-- Entries: every change is written to entry_edits by trigger, so history
-- cannot be skipped or forged by a client.
-- ---------------------------------------------------------------------------

create function public.entries_record_edit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  _uid    uuid := auth.uid();
  _old    jsonb := to_jsonb(old);
  _new    jsonb := to_jsonb(new);
  _before jsonb := '{}'::jsonb;
  _after  jsonb := '{}'::jsonb;
  _key    text;
begin
  if new.id <> old.id
     or new.child_id <> old.child_id
     or new.author_id <> old.author_id
     or new.created_at <> old.created_at
     or new.source <> old.source
     or new.routine_id is distinct from old.routine_id
     or new.group_id is distinct from old.group_id then
    raise exception 'An entry''s child, author, source and creation time cannot be changed';
  end if;

  foreach _key in array array[
    'type', 'title', 'note', 'occurred_at', 'amount', 'currency',
    'category', 'receipt_url', 'deleted_at'
  ] loop
    if (_old -> _key) is distinct from (_new -> _key) then
      _before := _before || jsonb_build_object(_key, _old -> _key);
      _after  := _after  || jsonb_build_object(_key, _new -> _key);
    end if;
  end loop;

  if _before = '{}'::jsonb then
    return new; -- nothing actually changed
  end if;
  if _uid is null then
    raise exception 'Edits must be made by a signed-in person so they can be attributed';
  end if;

  insert into public.entry_edits (entry_id, editor_id, before, after)
  values (old.id, _uid, _before, _after);
  return new;
end;
$$;

create trigger entries_record_edit
  before update on public.entries
  for each row execute function public.entries_record_edit();

-- A routine check-off must point at a routine of the same child.
create function public.entries_check_routine() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.routine_id is not null and not exists (
    select 1 from public.routines r where r.id = new.routine_id and r.child_id = new.child_id
  ) then
    raise exception 'That routine belongs to a different child';
  end if;
  return new;
end;
$$;

create trigger entries_check_routine
  before insert on public.entries
  for each row execute function public.entries_check_routine();

-- Live timeline updates (Supabase Realtime), where the publication exists.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.entries;
  end if;
end;
$$;
