-- EchelonAI Portfolio — initial schema
-- Run in Supabase SQL editor. Safe to re-run (idempotent guards where possible).
-- RLS is enabled on every table. The service_role key (backend only) bypasses RLS;
-- the authenticated (browser) role is restricted to the policies defined below.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. profiles — app-level user record, 1:1 with auth.users
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "own profile select" on public.profiles;
create policy "own profile select" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update to authenticated using (id = auth.uid());

-- Auto-create a profile row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. snaptrade_creds — one SnapTrade user per app user.
--    NO client access at all: RLS on, zero policies for authenticated role.
--    Only the backend (service_role) reads/writes this.
--    The SnapTrade secret itself lives in Supabase Vault (encrypted at rest).
--    This table stores only the Vault secret id, not the secret.
--
--    Backend flow:
--      write:  select vault.create_secret('<secret>', 'snaptrade_'||user_id, 'SnapTrade user secret')
--              → returns uuid → store as vault_secret_id below
--      read:   select decrypted_secret from vault.decrypted_secrets where id = vault_secret_id
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists supabase_vault with schema vault;

create table if not exists public.snaptrade_creds (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  snaptrade_user_id  text not null,
  vault_secret_id    uuid not null,
  created_at         timestamptz not null default now()
);

alter table public.snaptrade_creds enable row level security;
-- intentionally no policies → browser role fully blocked, backend bypasses.
-- vault.decrypted_secrets is likewise inaccessible to the authenticated role.

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. portfolio_accounts — each connected brokerage account = one profile
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.portfolio_accounts (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  snaptrade_account_id text not null,
  broker               text not null,
  account_name         text not null,
  currency             text not null default 'USD',
  connected_at         timestamptz not null default now(),
  last_synced_at       timestamptz,
  unique (user_id, snaptrade_account_id)
);

alter table public.portfolio_accounts enable row level security;

drop policy if exists "own accounts select" on public.portfolio_accounts;
create policy "own accounts select" on public.portfolio_accounts
  for select to authenticated using (user_id = auth.uid());
-- inserts/updates/deletes: backend (service_role) only

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. trades — mirrored trade history
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.trades (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid not null references public.portfolio_accounts(id) on delete cascade,
  ticker            text not null,
  direction         text not null check (direction in ('buy','sell')),
  qty               numeric not null,
  price             numeric not null,
  fees              numeric not null default 0,
  executed_at       timestamptz not null,
  snaptrade_trade_id text,
  created_at        timestamptz not null default now(),
  unique (account_id, snaptrade_trade_id)
);

create index if not exists trades_account_time on public.trades (account_id, executed_at);
alter table public.trades enable row level security;

drop policy if exists "own trades select" on public.trades;
create policy "own trades select" on public.trades
  for select to authenticated using (
    account_id in (select id from public.portfolio_accounts where user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. equity_snapshots — computed portfolio value time series (tiered granularity)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.equity_snapshots (
  id              bigint generated always as identity primary key,
  account_id      uuid not null references public.portfolio_accounts(id) on delete cascade,
  ts              timestamptz not null,
  granularity     text not null check (granularity in ('1min','15min','1day','1month','1year')),
  portfolio_value numeric not null,
  cash            numeric not null,
  unique (account_id, ts, granularity)
);

create index if not exists equity_lookup on public.equity_snapshots (account_id, granularity, ts);
alter table public.equity_snapshots enable row level security;

drop policy if exists "own equity select" on public.equity_snapshots;
create policy "own equity select" on public.equity_snapshots
  for select to authenticated using (
    account_id in (select id from public.portfolio_accounts where user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. price_cache — shared raw prices (no user data). Readable by any logged-in
--    user; writable only by backend.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.price_cache (
  id          bigint generated always as identity primary key,
  ticker      text not null,
  ts          timestamptz not null,
  granularity text not null check (granularity in ('1min','15min','1day','1month','1year')),
  open        numeric,
  high        numeric,
  low         numeric,
  close       numeric not null,
  unique (ticker, ts, granularity)
);

create index if not exists price_lookup on public.price_cache (ticker, granularity, ts);
alter table public.price_cache enable row level security;

drop policy if exists "prices readable" on public.price_cache;
create policy "prices readable" on public.price_cache
  for select to authenticated using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. aggregate_stats — anonymized platform-wide stats (no user_id). Backend only.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.aggregate_stats (
  key        text primary key,
  value      numeric not null,
  updated_at timestamptz not null default now()
);

alter table public.aggregate_stats enable row level security;
-- no policies → backend only
