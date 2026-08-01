-- EchelonAI Portfolio — migration 0003: opened_at on positions
-- Enables per-ticker period P&L attribution + annualization for manual profiles
-- (SnapTrade profiles derive the open date from trade history instead).
-- Run in Supabase SQL editor AFTER 0002. Idempotent.

alter table public.positions
  add column if not exists opened_at date;

-- Nullable: if a manual position has no opened_at, per-ticker annualized return
-- shows "—" (period P&L still computes from window prices).
