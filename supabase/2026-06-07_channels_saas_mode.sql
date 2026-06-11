-- Channel connection upgrades for SaaS mode.
-- Run this after the Instagram integration migration.

alter table public.business_phone_numbers
  add column if not exists access_token text,
  add column if not exists waba_id text,
  add column if not exists token_expires_at timestamptz,
  add column if not exists last_webhook_at timestamptz;

alter table public.business_instagram_accounts
  add column if not exists token_expires_at timestamptz,
  add column if not exists last_webhook_at timestamptz;

create index if not exists business_phone_numbers_waba_id_idx
  on public.business_phone_numbers(waba_id);

create index if not exists business_phone_numbers_last_webhook_idx
  on public.business_phone_numbers(last_webhook_at);

create index if not exists business_instagram_accounts_last_webhook_idx
  on public.business_instagram_accounts(last_webhook_at);
