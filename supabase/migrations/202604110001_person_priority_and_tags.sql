alter table public.persons
add column if not exists priority text not null default 'medium',
add column if not exists tags text[] not null default '{}';

update public.persons
set priority = case when is_vip then 'high' else 'medium' end
where priority not in ('high', 'medium', 'low');

alter table public.persons
drop constraint if exists persons_priority_check;

alter table public.persons
add constraint persons_priority_check
check (priority in ('high', 'medium', 'low'));