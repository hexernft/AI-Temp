-- Instagram DM integration support.
-- Run this in Supabase SQL editor before using /dashboard/instagram.

create table if not exists public.business_instagram_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  instagram_business_account_id text not null,
  page_id text,
  username text,
  access_token text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, instagram_business_account_id)
);

create index if not exists business_instagram_accounts_business_id_idx
  on public.business_instagram_accounts(business_id);

create index if not exists business_instagram_accounts_instagram_id_idx
  on public.business_instagram_accounts(instagram_business_account_id);

create index if not exists business_instagram_accounts_page_id_idx
  on public.business_instagram_accounts(page_id);

alter table public.business_instagram_accounts enable row level security;

-- This app uses server-side service-role routes for admin/business access.
-- RLS is enabled to keep direct client access closed by default.
