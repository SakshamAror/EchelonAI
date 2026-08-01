-- EchelonAI Portfolio — migration 0004: table grants for the browser (authenticated) role
-- Needed because "Automatically expose new tables" is OFF. RLS still gates rows;
-- these GRANTs allow the operation types at the table level. Run AFTER 0003. Idempotent.

grant usage on schema public to authenticated;

-- Profiles: read + update own row (insert handled by signup trigger, security definer)
grant select, update on public.profiles to authenticated;

-- Portfolio accounts: manual profiles are user-managed (RLS restricts to own + type='manual')
grant select, insert, update, delete on public.portfolio_accounts to authenticated;

-- Positions: user-managed for manual profiles (RLS restricts writes to own manual)
grant select, insert, update, delete on public.positions to authenticated;

-- Read-only from the browser:
grant select on public.trades to authenticated;            -- trade log (SnapTrade), RLS-scoped
grant select on public.equity_snapshots to authenticated;  -- equity curve, RLS-scoped
grant select on public.price_cache to authenticated;       -- shared prices

-- NOT granted to authenticated (backend/service_role only): snaptrade_creds, aggregate_stats.
