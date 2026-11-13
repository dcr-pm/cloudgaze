-- KidLog seed data: 2 parents, 1 grandparent, 2 children, 5 routines, 20 entries.
-- Sign in with any of the emails below by magic link (locally the emails land
-- in the Supabase mail catcher at http://localhost:54324).
--
--   alex@kidlog.test   parent, full
--   sam@kidlog.test    parent, full
--   rosa@kidlog.test   grandparent, log_only, simple mode on

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'alex@kidlog.test', '', now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Alex"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'sam@kidlog.test', '', now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Sam"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000003',
   'authenticated', 'authenticated', 'rosa@kidlog.test', '', now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Rosa"}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       now(), now(), now()
from auth.users u
where u.email in ('alex@kidlog.test', 'sam@kidlog.test', 'rosa@kidlog.test');

-- Profiles were created by the signup trigger.
update public.profiles set simple_mode = true where id = 'a0000000-0000-4000-8000-000000000003';

insert into public.children (id, name, birthdate, created_by) values
  ('c0000000-0000-4000-8000-000000000001', 'Maya', '2018-03-14', 'a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000002', 'Leo',  '2021-09-02', 'a0000000-0000-4000-8000-000000000001');

insert into public.circle_members (child_id, user_id, role, permission, invited_by) values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'parent',      'full',     null),
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'parent',      'full',     'a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'grandparent', 'log_only', 'a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'parent',      'full',     null),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'parent',      'full',     'a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003', 'grandparent', 'log_only', 'a0000000-0000-4000-8000-000000000001');

insert into public.routines (id, child_id, name, schedule, sort_order) values
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Homework', '{"days":[1,2,3,4,5],"time":"16:30"}', 1),
  ('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Meds',     '{"days":[0,1,2,3,4,5,6],"time":"08:00"}', 2),
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'Bedtime',  '{"days":[0,1,2,3,4,5,6],"time":"20:00"}', 3),
  ('d0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002', 'Bath',     '{"days":[0,1,2,3,4,5,6],"time":"18:30"}', 1),
  ('d0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000002', 'Bedtime',  '{"days":[0,1,2,3,4,5,6],"time":"19:15"}', 2);

-- 20 entries across the last week. alex = ...01, sam = ...02, rosa = ...03.
insert into public.entries
  (id, child_id, author_id, type, title, note, occurred_at, amount, category, routine_id, group_id, source)
values
  -- Maya
  ('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'activity', 'Swimming lesson', 'Moved up to the deep end group', now() - interval '6 days 3 hours', null, 'sports', null, 'f0000000-0000-4000-8000-000000000001', 'voice'),
  ('e0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'expense',  'Swimming lesson', null, now() - interval '6 days 3 hours', 40.00, 'sports', null, 'f0000000-0000-4000-8000-000000000001', 'voice'),
  ('e0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'routine',  'Bedtime', null, now() - interval '5 days 4 hours', null, null, 'd0000000-0000-4000-8000-000000000003', null, 'routine'),
  ('e0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'expense',  'School shoes', 'Size 1, the old pair had holes', now() - interval '5 days 8 hours', 54.99, 'clothing', null, null, 'receipt'),
  ('e0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'activity', 'Baked cookies together', null, now() - interval '4 days 6 hours', null, 'play', null, null, 'voice'),
  ('e0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'routine',  'Homework', null, now() - interval '4 days 5 hours', null, null, 'd0000000-0000-4000-8000-000000000001', null, 'routine'),
  ('e0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'activity', 'Dentist check-up', 'No cavities. Next visit in six months', now() - interval '3 days 7 hours', null, 'health', null, 'f0000000-0000-4000-8000-000000000002', 'text'),
  ('e0000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'expense',  'Dentist co-pay', null, now() - interval '3 days 7 hours', 25.00, 'health', null, 'f0000000-0000-4000-8000-000000000002', 'text'),
  ('e0000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'routine',  'Meds', null, now() - interval '2 days 12 hours', null, null, 'd0000000-0000-4000-8000-000000000002', null, 'routine'),
  ('e0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'activity', 'Playdate with Priya', 'At the park after school', now() - interval '2 days 5 hours', null, 'social', null, null, 'text'),
  ('e0000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'expense',  'Ice cream', null, now() - interval '1 day 6 hours', 6.50, 'food', null, null, 'voice'),
  ('e0000000-0000-4000-8000-000000000012', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'routine',  'Bedtime', null, now() - interval '1 day 2 hours', null, null, 'd0000000-0000-4000-8000-000000000003', null, 'routine'),
  ('e0000000-0000-4000-8000-000000000013', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'activity', 'Piano practice', '20 minutes, working on the recital piece', now() - interval '5 hours', null, 'school', null, null, 'text'),
  -- Leo
  ('e0000000-0000-4000-8000-000000000014', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'activity', 'Toddler gym', null, now() - interval '6 days 5 hours', null, 'sports', null, null, 'text'),
  ('e0000000-0000-4000-8000-000000000015', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'expense',  'Nappies and wipes', null, now() - interval '5 days 2 hours', 32.40, 'childcare', null, null, 'receipt'),
  ('e0000000-0000-4000-8000-000000000016', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003', 'routine',  'Bath', null, now() - interval '4 days 3 hours', null, null, 'd0000000-0000-4000-8000-000000000004', null, 'routine'),
  ('e0000000-0000-4000-8000-000000000017', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'activity', 'Doctor visit', 'Ear infection, drops twice a day for a week', now() - interval '3 days 4 hours', null, 'health', null, null, 'text'),
  ('e0000000-0000-4000-8000-000000000018', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'expense',  'Pharmacy', 'Ear drops', now() - interval '3 days 3 hours', 18.75, 'health', null, null, 'receipt'),
  ('e0000000-0000-4000-8000-000000000019', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003', 'activity', 'Fed the ducks at the pond', null, now() - interval '1 day 7 hours', null, 'outing', null, null, 'voice'),
  ('e0000000-0000-4000-8000-000000000020', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'routine',  'Bedtime', null, now() - interval '3 hours', null, null, 'd0000000-0000-4000-8000-000000000005', null, 'routine');

-- Two edits, so the "edited" marker and history have something to show.
-- The trigger attributes each edit to the signed-in user.
select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000002', false);
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}', false);
update public.entries set amount = 49.99, note = 'Size 1, the old pair had holes. Used the 10% coupon'
where id = 'e0000000-0000-4000-8000-000000000004';

select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', false);
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', false);
update public.entries set title = 'Playdate with Priya and Noor'
where id = 'e0000000-0000-4000-8000-000000000010';

select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claims', '', false);
