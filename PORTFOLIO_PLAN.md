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
- ✅ Equity curve: NLV + **TWR** (deposits/withdrawals neutralized), clipped to first trade, Value/Perf toggle
- ✅ Ranges 1D/5D/1M/6M/1Y/5Y/ALL (intraday for 1D/5D); SPY benchmark overlay
- ✅ Holdings table (live price, day %, mkt value, unrealized, weight); cash-flow editor
- ✅ Manual holdings profile type **removed** (trade-based only)
- ✅ Full-width **stats bar**: Core (7) + Advanced (6) tiers via gear toggle (localStorage). TWR-based, risk-free from ^IRX, annualization by data frequency, closed-trade win/PL ratio
- ✅ Curve UX: draw-in animation, shimmer skeleton while building, cursor-following tooltip, history cache
- 🔜 Allocation pie, return-by-symbol, rolling Sharpe, drawdown, sub-tabs, SnapTrade
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
    - Both feed the SAME trade-replay engine (`lib/tradeReplay.ts`) → positions, equity curve, TWR, realized P&L.
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

- [Y] **7.1 Portfolio tab** — Default. All approved charts: equity curve, pie chart, return by symbol, rolling sharpe, drawdown.
- [?] **7.2 Positions tab** — Full-width expanded positions table.
- [?] **7.3 Trades tab** — Closed trades: entry/exit date, qty, prices, P&L, hold time. Filterable. CSV export.
- [?] **7.4 Orders tab** — Pending/filled orders from SnapTrade.
- [?] **7.5 Per-stock tab** — Deep per-stock statistics (contents TBD).

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
