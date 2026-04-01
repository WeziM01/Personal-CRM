alter table public.persons
add column if not exists company text;

alter table public.events
add column if not exists category text;

update public.persons
set company = null
where company is null;

update public.events
set category = 'other'
where category is null;
