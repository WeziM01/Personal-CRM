alter table public.persons
add column if not exists linkedin_url text,
add column if not exists phone_number text;
