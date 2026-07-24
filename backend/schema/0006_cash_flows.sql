-- EchelonAI Portfolio — migration 0006: external cash flows (deposits/withdrawals)
-- Needed for Time-Weighted Return so funding the account isn't counted as a gain.
-- Run in Supabase SQL editor AFTER 0005. Idempotent.

create table if not exists public.cash_flows (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.portfolio_accounts(id) on delete cascade,
  flow_date   date not null,
  amount      numeric not null check (amount > 0),   -- magnitude; direction via kind
  kind        text not null check (kind in ('deposit','withdrawal')),
  created_at  timestamptz not null default now()
);

create index if not exists cash_flows_account on public.cash_flows (account_id, flow_date);
alter table public.cash_flows enable row level security;

grant select, insert, delete on public.cash_flows to authenticated;

drop policy if exists "own cash_flows select" on public.cash_flows;
create policy "own cash_flows select" on public.cash_flows
  for select to authenticated using (
    account_id in (select id from public.portfolio_accounts where user_id = auth.uid())
  );

drop policy if exists "own csv cash_flows insert" on public.cash_flows;
create policy "own csv cash_flows insert" on public.cash_flows
  for insert to authenticated with check (
    account_id in (select id from public.portfolio_accounts
                   where user_id = auth.uid() and type = 'csv')
  );

drop policy if exists "own csv cash_flows delete" on public.cash_flows;
create policy "own csv cash_flows delete" on public.cash_flows
  for delete to authenticated using (
    account_id in (select id from public.portfolio_accounts
                   where user_id = auth.uid() and type = 'csv')
  );
