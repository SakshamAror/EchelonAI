# Portfolio Page — Feature Plan

Step-by-step approval checklist. Review each item and say yes/no/modify.
Items marked [?] are pending your decision. [Y] = approved. [N] = skipped.
See PORTFOLIO_MANUAL.md for the authoritative math + current architecture.

---

## Build Log (what's shipped)
- ✅ Portfolio tab in top nav (persists across reload, centered) + black anti-flash bg
- ✅ Supabase Google OAuth sign-in; RLS; migrations 0001–0006
- ✅ Data sources: **CSV upload** (smart column mapping) + **Alpaca direct** (read-only keys, `/alpaca/sync`)
- ✅ Trade-replay engine: positions (avg-cost, long/short/margin), realized P&L
- ✅ Equity curve: NLV + **unlevered return index** (flow- and leverage-neutral), clipped to first trade, Value/Perf toggle
- ✅ Ranges 1D/5D/1M/6M/1Y/5Y/ALL (intraday for 1D/5D); SPY benchmark overlay
- ✅ Holdings table (live price, day %, mkt value, unrealized, weight); cash-flow editor
- ✅ Manual holdings profile type **removed** (trade-based only)
- ✅ Full-width **stats bar**: Core (7) + Advanced (7) tiers via gear toggle (localStorage). Unlevered-return-based, risk-free from ^IRX, annualization by data frequency, closed-trade win/PL ratio
- ✅ Curve UX: draw-in animation, shimmer skeleton while building, cursor-following tooltip, history cache
- ✅ Equity curve **Log** view (advanced-mode only) — Value $ series on a log y-axis, log-spaced gridlines
- ✅ Portfolio-page **sub-tabs**: Portfolio (existing dashboard) + **Comparison** (multi-profile % overlay,
  common-window clipped + rebased, per-profile stats table) — full-bleed sticky bar w/ orange sheen
- ✅ Alpaca key editing — gear icon on the sync panel to replace stored key/secret without recreating the profile
- ✅ 1M chart range bumped to 5-minute bars, 6M/1Y bumped to hourly (60m) — all were daily; annualization
  (`periodsPerYear()`) now derived from the actual sampled series instead of a static per-range guess
- ✅ **Unlevered (gross-exposure) return basis** — `buildCsvCurves` now computes return on gross
  exposure instead of equity, so leverage cancels out (verified: 2x-levered vs. unlevered accounts
  holding identical positions produce byte-identical `performance` curves). Applies to both the
  single-profile Perf % view and the Comparison tab; both are inherently flow-neutral too, since
  cash never enters the formula. Single-profile Perf % now renders via `EquityCurve`'s multi-series
  mode (percent-formatted) instead of the legacy single-line dollar-anchored path, since a %-return
  series starting at 0 broke the old SPY-rebase-by-multiplication logic.
- 🔜 Allocation pie, rolling Sharpe, drawdown, SnapTrade, Comparison tab per-symbol overlap/diff
- 🔜 **Monte Carlo return-path reshuffling** (§9 below) — approved, not yet implemented
- 🔜 Supabase price/snapshot caching (v1 fetches live), production FastAPI port

---

## Global UI Rules
- **Expandable panels** — every chart/panel has a full-screen expand button. Compact view shows summary (e.g. top 10). Expanded view shows full data + additional detail.

---

## Layout
- Top half: portfolio equity chart (dominant, full width minus right panel).
- Right panel (~1/4 screen): positions list, always visible.
- Bottom half: all other panels (allocation, return by symbol, drawdown, etc.)

---

## 0. Foundation

- [Y] **0.1 Tab routing** — "Portfolio" tab in top nav. Page reload is fine.
- [N] **0.2 Design tokens TS file** — Skipped.
- [N] **0.3 Demo fixtures** — Skipped. Show "No data available" empty state when no data.

---

## 1. Equity Chart (first thing on screen)

- [Y] **1.1 Portfolio vs SPY equity curve** — Dominant chart, top half of screen. Portfolio value over time vs SPY rebased to same starting point. Amber line = portfolio, dashed muted = SPY. Hover tooltip: date, portfolio value, SPY value, spread.
- [Y] **1.2 Timeframe bar** — Scoped to chart + all stats below: 1D | 5D | 1M | 6M | 1Y | 5Y | ALL | Custom range.

---

## 2. Stats Bar

- [Y] **2.1 Timeframe bar** — Sticky: 1D | 5D | 1M | 6M | 1Y | 5Y | ALL | Custom range. All stats + charts scope to selected range. CAGR/Sharpe show "—" for 1D/5D.
- [Y] **2.2 Stats row** — Scoped to timeframe: PnL ($), Total Return (%), CAGR, Sharpe, Sortino, Calmar, Max DD, Volatility (ann.), Beta (vs SPY), Alpha (Jensen's), Win Rate, P/L Ratio.
- [Y] **2.3 Connection + profile selector** — v1 supports two data sources (manual holdings REMOVED — trade-based only):
    - **CSV upload** — user uploads a trade history (any format; smart column mapping). Rows → `trades` table.
    - **Alpaca (direct)** — user provides a **read-only** Alpaca API key + secret (Access Controls → Read only, so it cannot trade/withdraw — preserves trust). Paper/live. Proxied server-side (dev: Vite middleware `/alpaca/sync`); pulls fills + CSD/CSW cash activities; reconciles starting_cash to match Alpaca's reported cash. Keys in localStorage for dev (production → Vault + backend, or OAuth so the secret is never shared).
    - Both feed the SAME trade-replay engine (`lib/tradeReplay.ts`) → positions, equity curve, unlevered return, realized P&L.
    - **SnapTrade** — deferred; will be added for OTHER brokers later via the same engine (normalize SnapTrade JSON → trades).
    Each source = a profile (type='csv', `broker` field distinguishes). Dropdown to switch. Data scoped to active profile.

---

## 3. Positions Panel (right, always visible)

- [Y] **3.1 Cash row** — Top of panel: cash balance (negative for margin), cash % of NLV, gross exposure %. Red-tinted when margin in use. Supports leveraged portfolios (negative cash, >100% gross).
- [Y] **3.2 Open positions list** — Each row: ticker + L/S, qty, weight %, market value, avg cost → current price, day %, unrealized P&L ($+%), and **period P&L ($+%) scoped to the selected timeframe** (+ annualized when a date is available). Computed on the fly from price_cache + trades/positions. Pure math only. Positions table is populated for SnapTrade profiles too (backend cache), not just manual.
- [Y] **3.3 Click-to-analyze** — Clicking a position shows confirmation prompt. On confirm, navigates to Analyze tab pre-filled with that ticker.
- [Y] **3.4 Manual position editor** — For manual profiles: add/edit/remove positions (ticker, qty, avg cost, long/short) + set cash balance. Ticker validated. Edits update holdings; forward snapshots use yfinance prices. Same equity-curve + metrics pipeline as SnapTrade profiles.

---

## 4. Allocation Chart

- [Y] **4.1 Allocation pie chart** — Current portfolio allocation as a pie/donut chart. Slices grouped by sector (adjacent), color-coded by sector (fetched from yfinance). Tooltip: ticker, % allocation, sector. Cash shown as its own slice.
- [N] **4.2 Margin threshold line** — Skipped.
- [N] **4.3 Summary footer** — Skipped.

---

## 5. Return by Symbol

- [Y] **5.1 Horizontal bar chart** — Top 10 positions by absolute return, red/green bars. Expandable to full screen showing all positions.
- [Y] **5.2 Click-to-analyze** — Confirmation prompt then navigates to Analyze tab.

---

## 6. Risk / Trader Metrics

- [Y] **6.1 Rolling Sharpe chart** — 30-day rolling Sharpe line chart over time. [ADVANCED]
- [Y] **6.2 Drawdown chart** — Underwater equity chart, red fill. Shows max DD % and recovery period. [ADVANCED]
- [N] **6.3 Returns by hold time scatter** — Skipped.

> **[ADVANCED] panels** are hidden by default. A toggle ("Advanced Mode") in the portfolio page header reveals them. Targeted at algo traders. Regular investors see a clean overview without noise.

---

## 7. Sub-tabs

- [Y] **7.0 Portfolio-page sub-tabs (built)** — Top-level split above everything else on the Portfolio
  page: **Portfolio** (single-profile dashboard, §7.1 below) and **Comparison** (§8). Distinct from
  §7.2–7.5 below, which are still-pending sub-tabs *within* the single-profile dashboard itself.
- [Y] **7.1 Portfolio tab** — Default. All approved charts: equity curve, pie chart, return by symbol, rolling sharpe, drawdown.
- [?] **7.2 Positions tab** — Full-width expanded positions table.
- [?] **7.3 Trades tab** — Closed trades: entry/exit date, qty, prices, P&L, hold time. Filterable. CSV export.
- [?] **7.4 Orders tab** — Pending/filled orders from SnapTrade.
- [?] **7.5 Per-stock tab** — Deep per-stock statistics (contents TBD).

---

## 8. Comparison Tab

- [Y] **8.1 Profile multi-select** — Checklist of the user's profiles, any combination, persisted in
  `localStorage`. Stable per-profile color (hash of profile id), independent of selection order.
- [Y] **8.2 Independent timeframe** — Own 1D–ALL range bar, separate state from the Portfolio tab.
- [Y] **8.3 Overlay chart** — Each selected profile's unlevered return plotted on the same % axis,
  clipped to the window where all selected profiles have data, rebased to 0% at that common start.
  SPY always included as a dashed reference line. See PORTFOLIO_MANUAL.md for the exact rebasing math.
- [Y] **8.4 Stats table** — Profiles × metrics grid, same core/advanced tier toggle as the single-profile
  Stats Bar, computed over the same common window as the chart.
- [ ] **8.5 Per-symbol overlap/diff** — Deferred fast-follow: shared tickers across selected profiles,
  weight in each, overlap indicator. Not started.
- [Y] **8.6 Unlevered (gross-exposure) return basis** — Shipped. `buildCsvCurves` computes
  `r(t) = Σ[qty_i(t-1)×Δprice_i(t)] / Σ|qty_i(t-1)×price_i(t-1)|` so a leveraged and unleveraged
  profile holding the same positions produce identical curves — leverage cancels out of both
  numerator and denominator (numerically verified). See PORTFOLIO_MANUAL.md's Comparison Tab section.
  See PORTFOLIO_MANUAL.md's Comparison Tab callout for the full explanation.

---

## 9. Monte Carlo Reshuffling

- [Y] **9.1 Return-path reshuffling via stationary bootstrap** — Approved, not yet implemented.
  Resample the actual periodic return series in **contiguous random-length blocks** (Politis &
  Romano stationary bootstrap, circular wrap-around), not a plain i.i.d. permutation — preserves
  volatility clustering (bad days really do cluster in real markets; naive shuffling would scatter
  them and understate real drawdown risk). Sampling is with replacement, so unlike plain
  permutation, **ending value also varies** across simulations, not just the path — this is a
  genuine joint path+outcome distribution for the historical window, not a fixed-outcome
  path-risk-only view. See PORTFOLIO_MANUAL.md for the full algorithm, fan chart design, and mean
  block-length parameter guidance.
- [?] **9.2 Cash-flow interaction** — Deferred design question: does reshuffling also re-run
  deposit/withdrawal timing against the resampled sequence (classic retirement-style
  sequence-of-returns risk, more insightful but only applies to profiles with real flows), or stay
  pure-return-series only (simpler, always applicable)? Recommend starting with pure-return-series.
- [?] **9.3 Placement** — Likely an [ADVANCED] panel alongside Rolling Sharpe / Drawdown on the
  single-profile Portfolio tab, scoped to the selected timeframe. Not confirmed.
- [?] **9.4 Mean block length (`L`)** — Deferred tuning question: a fixed default (~15–20 periods
  for daily-ish data) vs. a user-adjustable slider. Too short degenerates toward plain i.i.d.
  bootstrap (loses clustering); too long makes simulations look nearly identical to the real path.

---

## Backend

- [Y] **B.1 Supabase + FastAPI** — Supabase Auth (Google OAuth only). Vault for SnapTrade secrets (AES-256). RLS on all tables. Anon key → frontend only. Service role key → FastAPI `.env` only.
- [Y] **B.2 Data split** — SnapTrade: trade history + positions mirrored in Supabase, delta-synced. yfinance: all prices (upgrade path: Polygon.io). Equity curve replayed from trades × prices.
- [Y] **B.3 Granularity** — 1-min equity snapshots for last 7 days. Daily close for history. History starts from connect date (backfill planned post-v1). Metrics (Sharpe, CAGR, Beta etc.) computed on the fly from snapshot array — no metrics cache table needed.
- [Y] **B.4 Price cache** — SPY + all position tickers cached in shared `price_cache` table, reused across all users.

---

## Notes
- Sections 1–5 target long-term investors. Section 6 targets algo/HFT traders.
- Build order: 0 → B → 1 → 2 → 3 → 4 → 5 → 6 → 7.
