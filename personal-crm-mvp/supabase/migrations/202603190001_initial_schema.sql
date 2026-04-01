create extension if not exists pgcrypto;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.persons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text,
  photo_url text,
  created_at timestamptz not null default now()
);

create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  person_id uuid not null references public.persons (id) on delete cascade,
  event_id uuid references public.events (id) on delete set null,
  raw_note text not null,
  created_at timestamptz not null default now()
);

create index events_user_id_idx on public.events (user_id);
create index persons_user_id_idx on public.persons (user_id);
create index interactions_user_id_created_at_idx on public.interactions (user_id, created_at desc);
create index interactions_person_id_idx on public.interactions (person_id);
create index interactions_event_id_idx on public.interactions (event_id);

alter table public.events enable row level security;
alter table public.persons enable row level security;
alter table public.interactions enable row level security;

create policy "events_owner_only"
on public.events
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "persons_owner_only"
on public.persons
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "interactions_owner_only"
on public.interactions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);