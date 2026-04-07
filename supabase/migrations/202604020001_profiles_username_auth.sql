create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));

alter table public.profiles enable row level security;

drop policy if exists "profiles_owner_only" on public.profiles;
create policy "profiles_owner_only"
on public.profiles
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "profiles_username_lookup" on public.profiles;
create policy "profiles_username_lookup"
on public.profiles
for select
using (true);