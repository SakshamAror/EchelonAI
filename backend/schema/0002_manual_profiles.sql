-- EchelonAI Portfolio — migration 0002: manual profiles + positions table
-- Run in Supabase SQL editor AFTER 0001_init.sql. Idempotent.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. portfolio_accounts: add profile type, allow null snaptrade_account_id
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.portfolio_accounts
  add column if not exists type text not null default 'snaptrade';

do $$ begin
  alter table public.portfolio_accounts
    add constraint portfolio_accounts_type_chk check (type in ('snaptrade','manual'));
exception when duplicate_object then null; end $$;

-- manual profiles have no snaptrade_account_id
alter table public.portfolio_accounts
  alter column snaptrade_account_id drop not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. positions: current holdings.
--    Manual profiles: edited directly by the user.
--    SnapTrade profiles: cache of latest positions (populated by backend sync).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.positions (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.portfolio_accounts(id) on delete cascade,
  ticker      text not null,
  qty         numeric not null,
  avg_cost    numeric not null,
  side        text not null default 'long' check (side in ('long','short')),
  updated_at  timestamptz not null default now(),
  unique (account_id, ticker, side)
);

create index if not exists positions_account on public.positions (account_id);
alter table public.positions enable row level security;

-- Read: user can see positions for accounts they own
drop policy if exists "own positions select" on public.positions;
create policy "own positions select" on public.positions
  for select to authenticated using (
    account_id in (select id from public.portfolio_accounts where user_id = auth.uid())
  );

-- Write (insert/update/delete): user can edit positions in their OWN MANUAL profiles only.
-- SnapTrade position rows are written by the backend (service_role, bypasses RLS).
drop policy if exists "own manual positions write" on public.positions;
create policy "own manual positions write" on public.positions
  for all to authenticated
  using (
    account_id in (
      select id from public.portfolio_accounts
      where user_id = auth.uid() and type = 'manual'
    )
  )
  with check (
    account_id in (
      select id from public.portfolio_accounts
      where user_id = auth.uid() and type = 'manual'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. portfolio_accounts: let users create their OWN manual profiles from the client.
--    (SnapTrade profiles are still created backend-side only.)
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "own manual accounts insert" on public.portfolio_accounts;
create policy "own manual accounts insert" on public.portfolio_accounts
  for insert to authenticated
  with check (user_id = auth.uid() and type = 'manual');

drop policy if exists "own manual accounts update" on public.portfolio_accounts;
create policy "own manual accounts update" on public.portfolio_accounts
  for update to authenticated
  using (user_id = auth.uid() and type = 'manual')
  with check (user_id = auth.uid() and type = 'manual');

drop policy if exists "own manual accounts delete" on public.portfolio_accounts;
create policy "own manual accounts delete" on public.portfolio_accounts
  for delete to authenticated
  using (user_id = auth.uid() and type = 'manual');
