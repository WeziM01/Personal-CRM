alter table public.persons
add column if not exists is_vip boolean not null default false;