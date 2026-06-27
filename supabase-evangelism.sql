-- Run this in the Supabase SQL editor before using the Evangelism funnel.

create table if not exists public.evangelism_contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  prayer_request text not null default '',
  evangelist_worker_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'coming_to_church', 'converted', 'not_interested')),
  converted_first_timer_id uuid references public.first_timers(id) on delete set null,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists evangelism_contacts_worker_idx
  on public.evangelism_contacts(evangelist_worker_id);

create index if not exists evangelism_contacts_status_idx
  on public.evangelism_contacts(status);

create index if not exists evangelism_contacts_created_at_idx
  on public.evangelism_contacts(created_at);

create or replace function public.set_evangelism_contacts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_evangelism_contacts_updated_at on public.evangelism_contacts;

create trigger set_evangelism_contacts_updated_at
before update on public.evangelism_contacts
for each row
execute function public.set_evangelism_contacts_updated_at();

alter table public.evangelism_contacts enable row level security;

drop policy if exists "Active workers can create evangelism contacts" on public.evangelism_contacts;
create policy "Active workers can create evangelism contacts"
on public.evangelism_contacts
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_active = true
  )
  and (
    evangelist_worker_id = auth.uid()
    or exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_active = true
        and profiles.role in ('super_admin', 'admin', 'pastor')
    )
  )
);

drop policy if exists "Workers can read relevant evangelism contacts" on public.evangelism_contacts;
create policy "Workers can read relevant evangelism contacts"
on public.evangelism_contacts
for select
to authenticated
using (
  evangelist_worker_id = auth.uid()
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_active = true
      and profiles.role in ('super_admin', 'admin', 'pastor')
  )
);

drop policy if exists "Workers can update relevant evangelism contacts" on public.evangelism_contacts;
create policy "Workers can update relevant evangelism contacts"
on public.evangelism_contacts
for update
to authenticated
using (
  evangelist_worker_id = auth.uid()
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_active = true
      and profiles.role in ('super_admin', 'admin', 'pastor')
  )
)
with check (
  evangelist_worker_id = auth.uid()
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_active = true
      and profiles.role in ('super_admin', 'admin', 'pastor')
  )
);
