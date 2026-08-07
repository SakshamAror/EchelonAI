# Portfolio Tab — Calculation Manual

Reference for every metric and chart on the Portfolio page.
Updated as features are added. All formulas use daily returns unless noted.

---

## Implementation Status (v1, as built)

**Data sources (both feed one trade-replay engine):**
- **CSV upload** — any format; smart column inference (`lib/csvImport.ts`) + confirmation UI.
- **Alpaca (direct)** — user's own **read-only** key/secret (paper/live). Proxied server-side via
  the Vite dev endpoint `/alpaca/sync`; pulls FILL + CSD/CSW; reconciles `starting_cash` so replayed
  cash matches Alpaca exactly. Keys in browser localStorage (dev). SnapTrade deferred (other brokers).
  A gear icon on the sync panel (`AlpacaConnect.tsx`) lets the user re-enter key/secret if the
  originals were wrong, without deleting and recreating the profile.

**Portfolio-page sub-tabs (`PortfolioPage.tsx`):** **Portfolio** (single-profile dashboard, below) and
**Comparison** (multi-profile overlay, see its own section below). Full-bleed sticky bar (`.subtab-bar`
in `index.css`) mirroring the main Analyze/Portfolio nav, with a subtle diagonal orange sheen; selected
sub-tab persisted in `localStorage`.

**Auth + storage:** Supabase (Google OAuth), RLS on every table. Migrations `0001`–`0006`.
- `0001` core tables · `0002` (manual, later removed) · `0003` opened_at · `0004` grants
- `0005` remove manual + CSV profiles + `starting_cash` + trade RLS · `0006` cash_flows

**Server endpoints (dev = Vite middleware; production → FastAPI/`:8000`):**
`/yahoo-search` (ticker search), `/yahoo-quote` (current price), `/yahoo-history` (OHLC per range),
`/alpaca/sync`. All yahoo-finance2 calls use `validateResult:false`.

**Engine (`lib/tradeReplay.ts`):** `replayPositions` (avg-cost positions, realized P&L, signed qty
for long/short, negative cash for margin) + `buildCsvCurves` (NLV curve + unlevered return curve).

**Equity curve:** clipped to the first trade date; **Value $ / Log / Perf %** toggle (Log is
advanced-mode only — same $ series as Value, rendered on a log y-axis with 1/2/5×10ⁿ gridlines,
via `EquityCurve`'s `logScale` prop); ranges below. Chart component `EquityCurve.tsx` rebases SPY
to the portfolio start. `EquityCurve` also supports a **multi-series overlay mode** (`series` prop,
percent-based `valueFormat`) used by the Comparison tab — the single-profile path above is untouched.

**Chart ranges (live yahoo fetch, `/yahoo-history`):**
| Button | Lookback | Interval |
|---|---|---|
| 1D | latest session | 5m |
| 5D | 5 days | 15m |
| 1M | 1 mo | 5m |
| 6M | 6 mo | 60m |
| 1Y | 12 mo | 60m |
| 5Y | 5 yr | 1wk |
| ALL | full | 1mo |

Interval config lives in `scripts/fetch-yahoo-history.mjs`'s `RANGE_CONFIG` (single source of truth,
no duplication in the Vite proxy). 1M was bumped from daily to 5-minute bars, and 6M/1Y from daily
to hourly (60m), for higher-resolution charts — Yahoo serves 5m data for ~60 trailing days and 60m
data for ~730 trailing days, so both 1M (30 days) and 6M/1Y (180–365 days) sit comfortably inside
their respective windows (confirmed live: ~4,000 points/ticker for both 1M and 1Y, including
extended-hours prints — Yahoo's intraday bars aren't limited to the 9:30–16:00 ET session).

No new request-rate risk from this: the client already caches each `ticker:range` history fetch for
5 minutes (`lib/priceApi.ts`, `historyCache`), so switching ranges/views doesn't refetch — this
change only makes each *existing* request's response bigger, not more frequent.

**Stats bar (built).** Full-width, two tiers via a gear toggle (persisted in localStorage):
- **Core (7):** PnL, Total Return, CAGR, vs SPY, Max Drawdown, Sharpe, Win Rate
- **Advanced (+7):** Sortino, Calmar, Volatility, Beta, Alpha, P/L Ratio, Volatility Drag

Implementation specifics (`lib/portfolioStats.ts`):
- All return/risk metrics computed on the **unlevered return series** (flow- and leverage-neutral).
- **Annualization (`periodsPerYear()`) is derived from the actual sampled series** — point count over
  its real time span — rather than a static per-range table. This replaced an earlier hardcoded guess
  (e.g. "1M ≈ 78 bars/day, regular session only") that undercounted real bar density once Yahoo's
  extended-hours prints were accounted for; deriving it from the live data is correct for any range
  or interval without needing to track Yahoo's actual session behavior by hand.
  1D/5D and windows < 25 days → annualized metrics show "—" regardless (`isShortWindow()`).
- Risk-free rate = live **^IRX** (3-mo T-bill) yield ÷ 100; fallback 4.5%.
- **Win Rate / P/L Ratio** from *closed* (position-reducing) trades within the window — the replay
  engine emits a `realizedEvents` list; each round-trip's realized P&L (net of that trade's fees)
  is classified win/loss.
- **Max DD** on the flow-neutral curve; **Beta/Alpha** regress portfolio vs SPY daily returns.
- All scoped to the selected range's window.

**Not yet built (planned):** allocation pie, rolling Sharpe, drawdown chart, Comparison tab's
per-symbol overlap/diff, SnapTrade, per-day snapshot caching in Supabase (`equity_snapshots`/
`price_cache` exist in schema but v1 fetches prices live rather than caching them),
**Monte Carlo return-path reshuffling** (see its own section below).

---

## Data Sources

| Data | Source | Notes |
|---|---|---|
| Trade history (buys/sells, dates, qty) | SnapTrade API **or** manual entry | SnapTrade: mirrored in Supabase, delta-synced. Manual: user-entered positions. |
| Current positions + cash | SnapTrade API **or** manual entry | SnapTrade polled ~60s during market hours. Manual: user edits holdings directly. |
| Price history (OHLCV) | yfinance | All tickers + SPY. **Upgrade path:** Polygon.io ($29/mo) for reliability SLA when needed. |
| Sector per ticker | yfinance `info.sector` | Fetched once per ticker, cached in Supabase |
| Risk-free rate | yfinance `^IRX` (3-month T-bill) | Updated daily |

---

## Database Schema (Supabase / PostgreSQL)

RLS (`user_id = auth.uid()`) enforced on every table. Service role key server-side only.

```
users                 — managed by Supabase Auth (Google OAuth)
snaptrade_creds       — user_id, snaptrade_user_id, vault_secret_id (secret in Supabase Vault)
portfolio_accounts    — id, user_id, broker, account_name, snaptrade_account_id
trades                — account_id, ticker, qty, price, date, direction, fees
equity_snapshots      — account_id, timestamp, granularity, portfolio_value, cash
price_cache           — ticker, timestamp, granularity, open, high, low, close (shared)
aggregate_stats       — anonymized platform-wide stats (no user_id; see below)
```

Metrics (Sharpe, CAGR, Beta etc.) are NOT stored — computed on the fly from `equity_snapshots`
in <10ms using numpy. Different timeframes just slice the array at the matching granularity.

### Granularity tiering (both equity_snapshots + price_cache)

| Timeframe view | Granularity | Retention window |
|---|---|---|
| 1D | 1-minute | today only (captured live) |
| 5D | 15-minute | last ~60 days |
| 1M / 6M / 1Y | daily OHLC | last 1 year |
| 5Y | monthly OHLC | 1–10 years |
| ALL (>10yr) | yearly OHLC | 10–50 years |

Notes:
- **1-minute data cannot be backfilled** — yfinance only serves it for the last ~7 days. Minute
  texture is captured live while the user has the app open; lost permanently on disconnect.
- **price_cache** (shared, raw prices) uses the full tiering now — cheap, powers SPY benchmark +
  per-stock stats.
- **equity_snapshots** (per-user) only goes back to the user's connect date in v1. Backfill from
  SnapTrade trade history (up to 1yr or portfolio start, whichever is sooner) is planned post-v1.
- **Metrics annualization must match granularity:** √252 for daily returns, √52 weekly, √12 monthly.
  Never mix frequencies within one timeframe window.

### Aggregate stats (anonymized, decision #2)
When a user deletes their EchelonAI account, their identifiable data is hard-deleted. Before deletion,
non-identifiable aggregate metrics are rolled into `aggregate_stats` (no user_id, no account_id).
Fields TBD — candidates: total users ever, retention rate, avg holding count, avg session count.
Final field list to be decided before implementing account deletion.

### Data lifecycle (decision #1)
On broker disconnect: all trades + equity_snapshots for that account are deleted. Data is reloaded
fresh from SnapTrade on reconnect (daily curve reconstructable; intraday texture for the gap is lost).

---

## Backend Architecture (FastAPI)

Thin, stateless API between the browser and three external services. It exists because three
things cannot happen in the browser: holding the SnapTrade secret, holding the Supabase
service-role key, and running yfinance (Python).

```
Browser (Supabase JWT)  →  FastAPI  →  Supabase (service role key)
                                   →  SnapTrade (clientId + consumerKey)
                                   →  yfinance (price data)
```

### Endpoints (planned)
| Method + path | Purpose |
|---|---|
| `POST /api/portfolio/register` | Create SnapTrade user, store secret in Vault, store vault id in `snaptrade_creds` |
| `GET  /api/portfolio/connect-url` | Return SnapTrade OAuth portal URL for broker connection |
| `GET  /api/portfolio/accounts` | List the signed-in user's connected profiles (SnapTrade + manual) |
| `POST /api/portfolio/manual` | Create/update a manual profile's positions + cash |
| `POST /api/portfolio/sync` | SnapTrade: pull trades (delta). Both: fetch prices, compute equity curve, write snapshots |
| `GET  /api/portfolio/equity` | Serve cached equity curve for `account` + `timeframe` |

Profile types: a `portfolio_accounts` row is either `type='snaptrade'` (has snaptrade_account_id) or
`type='manual'` (positions entered by the user). Both feed the same equity-curve + metrics pipeline.

### Request lifecycle
1. Browser sends Supabase JWT in `Authorization: Bearer`.
2. FastAPI verifies JWT against Supabase JWKS → extracts trusted `user_id`.
3. Business logic runs, scoped to that `user_id` only.
4. No session state stored — every request re-verifies. Nothing to breach.

### Two hardening rules enforced in code
1. **`user_id` is never trusted from the client body** — always taken from the verified JWT.
   Even if the browser sends someone else's id, it's ignored.
2. **Fail closed** — if JWT verify / Vault / Supabase is unreachable, return 401/503, never
   fall through to unauthenticated behavior.

---

## Security Notes (OWASP)

- **A01 Access Control:** JWT verified every request; `user_id` from token only. Backend queries always scoped `where user_id = <token uid>`. Supabase RLS is the second wall.
- **A02 Crypto:** SnapTrade secret stored in Supabase Vault (encrypted at rest); `snaptrade_creds` holds only the vault secret id. Never returned to browser, never logged. Service role key → backend `.env` only. TLS everywhere. Upgrade path: app-level encryption (key in backend `.env` only) for defense against full DB compromise.
- **A03 Injection:** Supabase parameterized queries only, no raw SQL string-building.
- **A05 Misconfiguration:** Publishable key → frontend only. Service role key → FastAPI `.env` only. Explicit Pydantic response models — only whitelisted fields serialize, so a vault id/secret can't leak into a response.
- **A07 Auth:** Google OAuth via Supabase Auth. JWT signature checked against Supabase JWKS. Expired/forged tokens rejected before any logic runs.
- **A10 SSRF:** yfinance fetches by ticker. Every ticker validated against regex allowlist (`^[A-Z.\-]{1,6}$`) before use — blocks a malicious "ticker" becoming a URL to an internal host.
- **DoS / abuse:** Per-user rate limiting (e.g. `slowapi`) on expensive endpoints (`/sync` hits SnapTrade + yfinance).
- **CORS:** Locked to exact frontend origin (`localhost:5173` dev, deployed domain in prod). No wildcard.
- **Idempotency:** `/sync` dedups on `snaptrade_trade_id` — replays never double-insert trades.

### Data provider (current + upgrade path)
- **v1:** yfinance (free, unofficial, no SLA — breaks occasionally).
- **Upgrade:** Polygon.io (paid, reliable SLA) when moving beyond beta.
- **Aggregator:** SnapTrade (broker connections). Alternative: Plaid Investments. See PORTFOLIO_PLAN notes.

---

## Portfolio Equity Curve

The equity curve is computed by replaying trade history against yfinance price data — not using broker-reported portfolio value (which is 15–20 min delayed and has variable granularity).

```
portfolio_value(t) = cash(t) + Σ [ qty_i(t) × price_i(t) ]
```

- `qty_i(t)` = shares held in position i at time t, derived by replaying all buy/sell trades up to t
- `price_i(t)` = closing price (or intraday last) from yfinance
- `cash(t)` = starting cash ± Σ(trade cash flows up to t)
- Short positions: qty is negative, so `qty × price` subtracts from gross but adds if price falls

SPY is rebased to the same starting value as the portfolio at the start of the selected timeframe:
```
spy_rebased(t) = portfolio_value(t0) × (spy_price(t) / spy_price(t0))
```

### Data model (v1: CSV trade log; manual holdings removed)
The only input is a **dated trade log** (CSV upload now, SnapTrade JSON later) + a `starting_cash`
(balance before the first trade) + optional deposit/withdrawal events. Everything is derived by
the trade-replay engine (`lib/tradeReplay.ts`):
- **Current positions** — replayed from trades (average-cost method; supports long, short via
  signed qty, and margin via negative cash).
- **Realized P&L** — accumulated on each closing trade.
- **NLV(t)** = cash(t) + Σ qty_i(t) × price_i(t), where
  `cash(t) = starting_cash + Σ external_flows(≤t) + Σ trade_cash_flows(≤t)`.
  Idle cash sits in the cash term (dilutes return correctly); margin = negative cash; shorts add
  cash + a negative holding.

### Cash flows + unlevered return (Perf %)
Deposits/withdrawals are external cash movements, NOT performance, and leverage/margin sizing is a
financing choice, not position performance. Counting either as gains/losses would distort every
stat. So `performance` (`buildCsvCurves` in `lib/tradeReplay.ts`) is computed as return on **gross
exposure**, not return on equity:
```
r(t) = Σ[qty_i(t-1) × (price_i(t) - price_i(t-1))] / Σ|qty_i(t-1) × price_i(t-1)|
index(t) = index(t-1) × (1 + r(t))          (index starts at 100)
```
Cash never appears in this formula, so it's automatically both:
- **Flow-neutral** — deposits/withdrawals only affect `cash(t)`, which isn't part of the calc.
- **Leverage-neutral** — a levered and unlevered account holding identical positions produce the
  exact same curve, since leverage scales numerator and denominator equally and cancels out.

Two curve views: **Value $** (NLV, real dollars incl. deposits, cash-inclusive) and **Perf %**
(unlevered return index — rendered via `EquityCurve`'s multi-series mode so it can be shown as a
true percentage rather than an arbitrary-base dollar figure). Sharpe/Vol/Beta/Alpha/Sortino/Calmar/
Volatility Drag all derive from this same return series — all are ratio-based, so they're unaffected
by the index's arbitrary starting value (100). Dividends/interest are skipped in v1 (slightly
understates return; never inflates). External deposits not present in the CSV are added via the
manual deposits/withdrawals editor (they still affect NLV/Value $, just not Perf %).

---

## Stats Bar Metrics

All metrics are computed over the selected timeframe window.

### PnL ($)
```
PnL = portfolio_value(t_end) - portfolio_value(t_start)
```
Includes unrealized gains/losses on open positions.

### Total Return (%)
```
total_return = (portfolio_value(t_end) / portfolio_value(t_start)) - 1
```

### CAGR (Compound Annual Growth Rate)
```
CAGR = (portfolio_value(t_end) / portfolio_value(t_start)) ^ (365 / days) - 1
```
- `days` = calendar days in selected timeframe
- Shown as "—" for timeframes < 30 days (not meaningful)

### Daily Returns Series
Used as input for Sharpe, Sortino, Volatility, Beta, Alpha:
```
r(t) = portfolio_value(t) / portfolio_value(t-1) - 1
```

### Volatility (Annualized)
```
volatility = std_dev(r) × √252
```
Standard deviation of daily returns, annualized assuming 252 trading days.

### Sharpe Ratio
```
sharpe = (mean(r) - r_f/252) / std_dev(r) × √252
```
- `r_f` = current annualized risk-free rate (3-month T-bill, `^IRX`)
- Shown as "—" for timeframes < 30 days

### Sortino Ratio
Like Sharpe but only penalizes downside volatility (shortfalls below the per-period risk-free rate, MAR = r_f):
```
downside_dev = sqrt( Σ min(r_t - r_f/252, 0)^2 / N ) × √252     (N = total periods, not just losing ones)
sortino = (mean(r) - r_f/252) / downside_dev × √252
```

### Max Drawdown
```
peak(t) = max(portfolio_value(t0..t))
drawdown(t) = (portfolio_value(t) - peak(t)) / peak(t)
max_DD = min(drawdown(t)) for all t in range
```

### Calmar Ratio
```
calmar = CAGR / abs(max_DD)
```

### Beta (vs SPY)
```
beta = covariance(r_portfolio, r_spy) / variance(r_spy)
```
Uses daily returns for both portfolio and SPY over the selected timeframe.

### Alpha (Jensen's)
```
alpha = mean(r_portfolio) - [r_f/252 + beta × (mean(r_spy) - r_f/252)]
```
Annualized: `alpha × 252`

### Win Rate
```
win_rate = closed_trades_with_positive_PnL / total_closed_trades
```
Only counts fully closed trades within the selected timeframe.
Shown as "—" if fewer than 5 closed trades.

### P/L Ratio (Profit Factor)
```
pl_ratio = mean(winning_trade_PnL) / abs(mean(losing_trade_PnL))
```
Average win divided by average loss (absolute). > 1 means average win > average loss.

---

## Positions Panel

### Average Cost Basis
```
avg_cost = Σ(buy_price_i × buy_qty_i) / Σ(buy_qty_i)
```
Weighted average across all buy trades for the position.
Uses broker-reported value from SnapTrade where available; computed from trade history as fallback.
Note: multi-buy positions use average cost method (not FIFO/LIFO).

### Weight %
```
weight = position_market_value / total_portfolio_NLV
```

### Gross Exposure %
```
gross_exposure = Σ(abs(position_market_value)) / NLV × 100
```
Can exceed 100% for leveraged/margin portfolios.

### Per-ticker Period P&L (scoped to selected timeframe)
Computed on the fly from `price_cache` (per-ticker prices) + `trades` (SnapTrade qty timeline)
or `positions` + `opened_at` (manual). NOT stored — same principle as portfolio metrics, so it
works for any timeframe including custom ranges and never goes stale.

For a selected window `[t0, t1]` (constant-qty case; SnapTrade sums over segments between trades):
```
open_date   = first buy date (SnapTrade) | opened_at (manual)
start_basis = price(t0)   if open_date <= t0     (held before the window)
            = avg_cost    if open_date  > t0     (opened during the window)
start_ref   = t0          if open_date <= t0  else open_date

period_pnl(ticker)    = qty × (price(t1) - start_basis)
period_return(ticker) = price(t1) / start_basis - 1
annualized(ticker)    = (price(t1) / start_basis) ^ (365 / days(start_ref, t1)) - 1
```
- `annualized` shown as "—" for manual positions with no `opened_at`, or windows < 30 days.
- For SnapTrade positions with buys/sells inside the window, attribute P&L per sub-interval
  between trades and sum (proper money-weighted attribution).

### Current Unrealized P&L (position total, not period-scoped)
```
unrealized_pnl     = (current_price - avg_cost) × qty
unrealized_pnl_pct = (current_price / avg_cost) - 1
```

---

## Allocation Pie Chart

Slice size = `position_market_value / total_market_value` (cash included as own slice).
Slices grouped by sector (adjacent) and color-coded by sector.
Sector fetched from `yfinance.Ticker(ticker).info['sector']`, cached in Supabase.

---

## Return by Symbol

```
symbol_return = (current_price / avg_cost) - 1
```
Top 10 by `abs(symbol_return)`. Expanded view shows all positions.

---

## Advanced Panels

### Rolling Sharpe (30-day)
At each date t:
```
rolling_sharpe(t) = sharpe computed over the 30 calendar days ending at t
```
Plotted as a line chart over the selected timeframe.

### Drawdown Chart
```
drawdown(t) = (portfolio_value(t) - running_peak(t)) / running_peak(t)
```
Plotted as area fill below 0 (red). Annotated with max drawdown value and recovery date.

### Volatility Drag
Gap between arithmetic and geometric mean return caused by compounding variance — the
higher the volatility, the more the geometric return lags the simple average return.
```
arithmetic_mean = mean(r)
geometric_mean  = exp(mean(ln(1 + r))) - 1
volatility_drag = [(1 + arithmetic_mean)^ppy - 1] - [(1 + geometric_mean)^ppy - 1]
```
Computed exactly from the period-return series (not the `σ²/2` small-returns approximation).

---

## Comparison Tab

Cross-profile overlay (`ComparisonTab.tsx`), a Portfolio-page sub-tab alongside the single-profile
dashboard. Lets a user pick any subset of their own profiles and compare performance on a common,
flow- **and leverage-neutral** % basis — no per-symbol overlap/diff yet (deferred).

**Leverage-neutral by construction.** `buildCsvCurves` in `tradeReplay.ts` computes `performance` as
return on **gross exposure**, not return on equity:
```
r(t) = Σ[qty_i(t-1) × (price_i(t) - price_i(t-1))] / Σ|qty_i(t-1) × price_i(t-1)|
```
Cash and margin never enter this formula, so leverage cancels out of both numerator and denominator
— a 3x-margined and unlevered profile holding the identical position produce the **exact same**
curve (verified: simulating 10 unlevered vs. 20 2x-levered shares of the same price path produces
NLV curves that diverge sharply, e.g. $1000→$1200→$900→$1400 vs. $1000→$1100→$950→$1200, while the
`performance` index is byte-identical for both, exactly tracking the underlying price path). This is
also inherently flow-neutral — deposits/withdrawals affect cash, which isn't part of the formula at
all, so no separate flow-removal step is needed the way the old NLV-ratio TWR needed one.

**Profile selection:** multi-select checklist, persisted to `localStorage`
(`echelon_compare_profiles`). Each profile gets a **stable color** derived from a hash of its id
(`hashColor()`), so a profile's color never shifts based on selection order or what else is picked.

**Timeframe:** independent range selector (own `1D…ALL` bar, separate state from the Portfolio tab).

**Data pipeline:** for the selected profiles, fetches trades/cash-flows per profile, then one shared
price history per ticker (union across all selected profiles) **on a single shared time axis**
(`getHistory("SPY", range)`'s timestamps). Running `buildCsvCurves` with that same axis for every
profile keeps all curves point-aligned for free — no separate interpolation step.

**Common-window clipping + rebasing** (the leverage- and flow-neutral % comparison):
```
commonStart = max(firstTradeDate_i)  for every selected profile i
window      = [commonStart, latest axis point]
```
Only the range where **every** selected profile has live data is shown — a profile connected
recently shortens the visible window for everyone rather than showing a misleading flat/zero
segment for the others. Each profile's unlevered return index is then rebased to the window start:
```
pct_i(t) = perf_i(t) / perf_i(window_start) - 1     (× 100 for display)
```
SPY gets the same treatment and is always included as a dashed reference line. Rebasing by a later
reference point is just a chain-rule shift of the same index — ratios are invariant to it, so this
works regardless of what `performance`'s starting value happens to be (it starts at a flat 100 from
`buildCsvCurves`, not tied to the profile's actual NLV).

**Chart:** `EquityCurve`'s multi-series mode (`series` prop, `valueFormat="percent"`) — one path per
profile plus SPY, shared x/y scale, per-series hover tooltip, auto-generated legend with each
series' total return over the window.

**Stats table:** profiles as rows, metrics as columns, reusing `computeStats()` per profile scoped
to the common window (same `netFlowInWindow` / `realizedInWindow` / `periodsPerYear` /
`shortWindow` construction as the single-profile Stats Bar). Column set (core 7 or core+advanced 14)
matches the same tier toggle as `StatsBar`, synced live via `useStatsTier()`
(`src/lib/useStatsTier.ts` — a small pub-sub over `localStorage` so both components stay in sync
without a page reload). Metric labels/formatters shared with `StatsBar` via `src/lib/statDefs.ts`.

---

## Monte Carlo Reshuffling (planned, not yet built)

"What if the same market moves had happened in a different order?" — a path-dependency /
sequence-of-returns visualization. Not yet built; documenting the intended design so it's ready
to implement.

**Core idea — stationary bootstrap** (Politis & Romano), not plain permutation. Plain permutation
(shuffle each return exactly once) destroys volatility clustering — it can place a crash-era day
right next to a calm bull-market day, understating how real drawdowns actually cluster together.
Stationary bootstrap instead resamples **contiguous blocks** of the actual return series, with
random block length, so short-run autocorrelation/clustering survives even though the overall
order is randomized:
```
L        = mean block length (tunable, e.g. 20 periods)
p        = 1 / L                     (probability of starting a fresh block each step)
i_0      = random start index in [0, n)
for k in 1..n:
  r_shuffled(k) = r[i_k mod n]        // circular wrap — avoids edge bias (this is what
                                       // makes it "stationary" rather than plain block bootstrap)
  i_{k+1} = i_k + 1            with probability (1 - p)   // continue current block
          = random index in [0, n)    with probability p  // jump to a new block

value_sim(0) = 100
value_sim(k) = value_sim(k-1) × (1 + r_shuffled(k))
```
Sampling is **with replacement** (some historical returns appear multiple times in a given
simulation, others not at all) — unlike plain permutation, this means **ending value is no longer
guaranteed identical across simulations**. That's an intentional tradeoff: the output becomes a
genuine joint distribution of both path *and* outcome for the same historical window, not just a
fixed-outcome path-risk view — while still respecting real volatility clustering far better than
i.i.d. resampling of individual returns.
- **Max drawdown distribution** — e.g. "your real max DD was −18%; 1,000 stationary-bootstrap
  resamples of this same return history ranged from −9% to −31%."
- **Ending value distribution** — now meaningfully varies too (unlike plain permutation), giving a
  rough sense of how much of the realized total return depended on clustering/timing luck.
- **Worst peak-to-trough duration distribution** — how long the deepest drawdown could have lasted.
- A **fan chart**: N simulated paths (or percentile bands — 5th/25th/50th/75th/95th) overlaid with
  the actual historical path highlighted, using `EquityCurve`'s existing multi-series mode.
- **Mean block length `L` is a real design parameter**, not an implementation detail — too short
  (e.g. L=1) degenerates to plain i.i.d. bootstrap and loses clustering; too long produces few
  effective blocks and simulations that look nearly identical to the actual path. Start around
  L≈15–20 periods for daily-ish data and tune from there.

**Scope decision needed:** operate purely on the flow-neutral return series (ignore deposit/
withdrawal timing entirely — cleanest, since remapping real calendar-dated flows onto a reordered
sequence is ambiguous once the order changes) vs. the classic retirement-style simulation where
withdrawals interact with return order (a withdrawal landing during a shuffled bad patch compounds
worse than during a good patch) — the latter is more insightful but only applies to profiles with
real cash flows, and requires deciding whether flows re-anchor to shuffled positions or stay fixed
to original dates. Recommend starting with the pure-return-series version (simpler, always
applicable) and revisiting cash-flow interaction as a fast-follow if there's demand for it.

**Where it'd live:** likely an [ADVANCED] panel on the single-profile Portfolio tab (same section as
Rolling Sharpe / Drawdown), scoped to the currently selected timeframe range.

---

*This file is updated as each feature is built. Formulas are the authoritative reference for backend implementation.*
