alter table public.persons
add column if not exists preferred_channel text;

alter table public.persons
add column if not exists preferred_channel_other text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'persons_preferred_channel_check'
  ) then
    alter table public.persons
    add constraint persons_preferred_channel_check
    check (
      preferred_channel in ('linkedin', 'whatsapp', 'email', 'phone', 'other')
      or preferred_channel is null
    );
  end if;
end $$;
