-- Run this in the Supabase SQL editor before using programme-specific forms.

create table if not exists public.programmes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  programme_date date,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.first_timers
  add column if not exists programme_id uuid references public.programmes(id) on delete set null;

create index if not exists programmes_slug_idx on public.programmes(slug);
create index if not exists programmes_is_active_idx on public.programmes(is_active);
create index if not exists first_timers_programme_id_idx on public.first_timers(programme_id);

create or replace function public.set_programmes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_programmes_updated_at on public.programmes;

create trigger set_programmes_updated_at
before update on public.programmes
for each row
execute function public.set_programmes_updated_at();

alter table public.programmes enable row level security;

drop policy if exists "Anyone can read active programmes" on public.programmes;
create policy "Anyone can read active programmes"
on public.programmes
for select
using (is_active = true);

drop policy if exists "Active workers can read all programmes" on public.programmes;
create policy "Active workers can read all programmes"
on public.programmes
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_active = true
  )
);
