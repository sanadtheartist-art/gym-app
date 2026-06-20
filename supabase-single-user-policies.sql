-- Single-user browser app policies for the gym tracker.
-- Run this in the Supabase SQL Editor for your project.
--
-- This app currently has no login screen, so browser requests run as the
-- public "anon" role. These policies allow that role to read and write the
-- tracker tables used by the app.

alter table public.splits enable row level security;
alter table public.split_exercises enable row level security;
alter table public.workouts enable row level security;

drop policy if exists "gym anon read splits" on public.splits;
drop policy if exists "gym anon insert splits" on public.splits;
drop policy if exists "gym anon update splits" on public.splits;
drop policy if exists "gym anon delete splits" on public.splits;

create policy "gym anon read splits"
on public.splits for select
to anon
using (true);

create policy "gym anon insert splits"
on public.splits for insert
to anon
with check (true);

create policy "gym anon update splits"
on public.splits for update
to anon
using (true)
with check (true);

create policy "gym anon delete splits"
on public.splits for delete
to anon
using (true);

drop policy if exists "gym anon read split exercises" on public.split_exercises;
drop policy if exists "gym anon insert split exercises" on public.split_exercises;
drop policy if exists "gym anon update split exercises" on public.split_exercises;
drop policy if exists "gym anon delete split exercises" on public.split_exercises;

create policy "gym anon read split exercises"
on public.split_exercises for select
to anon
using (true);

create policy "gym anon insert split exercises"
on public.split_exercises for insert
to anon
with check (true);

create policy "gym anon update split exercises"
on public.split_exercises for update
to anon
using (true)
with check (true);

create policy "gym anon delete split exercises"
on public.split_exercises for delete
to anon
using (true);

drop policy if exists "gym anon read workouts" on public.workouts;
drop policy if exists "gym anon insert workouts" on public.workouts;
drop policy if exists "gym anon update workouts" on public.workouts;
drop policy if exists "gym anon delete workouts" on public.workouts;

create policy "gym anon read workouts"
on public.workouts for select
to anon
using (true);

create policy "gym anon insert workouts"
on public.workouts for insert
to anon
with check (true);

create policy "gym anon update workouts"
on public.workouts for update
to anon
using (true)
with check (true);

create policy "gym anon delete workouts"
on public.workouts for delete
to anon
using (true);

-- Media uploads use Supabase Storage. Keep this block if your
-- "workout-media" bucket is public and you want uploads from the app.
drop policy if exists "gym anon read workout media" on storage.objects;
drop policy if exists "gym anon upload workout media" on storage.objects;

create policy "gym anon read workout media"
on storage.objects for select
to anon
using (bucket_id = 'workout-media');

create policy "gym anon upload workout media"
on storage.objects for insert
to anon
with check (bucket_id = 'workout-media');
