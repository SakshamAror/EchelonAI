-- EchelonAI Portfolio — migration 0005: remove manual profiles, add CSV (trade-based) profiles
-- Run in Supabase SQL editor AFTER 0004. Idempotent where possible.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Remove the manual feature entirely (cascade deletes their positions)
-- ─────────────────────────────────────────────────────────────────────────────
delete from public.portfolio_accounts where type = 'manual';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Profile types: csv | snaptrade. Default csv. Add starting_cash.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.portfolio_accounts drop constraint if exists portfolio_accounts_type_chk;
do $$ begin
  alter table public.portfolio_accounts
    add constraint portfolio_accounts_type_chk check (type in ('csv','snaptrade'));
exception when duplicate_object then null; end $$;

alter table public.portfolio_accounts alter column type set default 'csv';
alter table public.portfolio_accounts
  add column if not exists starting_cash numeric not null default 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Account policies: users manage their own CSV profiles (was: manual)
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "own manual accounts insert" on public.portfolio_accounts;
drop policy if exists "own manual accounts update" on public.portfolio_accounts;
drop policy if exists "own manual accounts delete" on public.portfolio_accounts;

create policy "own csv accounts insert" on public.portfolio_accounts
  for insert to authenticated with check (user_id = auth.uid() and type = 'csv');
create policy "own csv accounts update" on public.portfolio_accounts
  for update to authenticated using (user_id = auth.uid() and type = 'csv')
  with check (user_id = auth.uid() and type = 'csv');
create policy "own csv accounts delete" on public.portfolio_accounts
  for delete to authenticated using (user_id = auth.uid() and type = 'csv');

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Positions are now DERIVED (replayed from trades) — drop manual write policy.
--    Select policy stays (used as a cache for SnapTrade later).
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "own manual positions write" on public.positions;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Trades: users insert/delete their own CSV-profile trades (parsed client-side)
-- ─────────────────────────────────────────────────────────────────────────────
grant insert, delete on public.trades to authenticated;

drop policy if exists "own csv trades insert" on public.trades;
create policy "own csv trades insert" on public.trades
  for insert to authenticated with check (
    account_id in (select id from public.portfolio_accounts
                   where user_id = auth.uid() and type = 'csv')
  );

drop policy if exists "own csv trades delete" on public.trades;
create policy "own csv trades delete" on public.trades
  for delete to authenticated using (
    account_id in (select id from public.portfolio_accounts
                   where user_id = auth.uid() and type = 'csv')
  );
