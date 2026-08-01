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

**Auth + storage:** Supabase (Google OAuth), RLS on every table. Migrations `0001`–`0006`.
- `0001` core tables · `0002` (manual, later removed) · `0003` opened_at · `0004` grants
- `0005` remove manual + CSV profiles + `starting_cash` + trade RLS · `0006` cash_flows

**Server endpoints (dev = Vite middleware; production → FastAPI/`:8000`):**
`/yahoo-search` (ticker search), `/yahoo-quote` (current price), `/yahoo-history` (OHLC per range),
`/alpaca/sync`. All yahoo-finance2 calls use `validateResult:false`.

**Engine (`lib/tradeReplay.ts`):** `replayPositions` (avg-cost positions, realized P&L, signed qty
for long/short, negative cash for margin) + `buildCsvCurves` (NLV curve + TWR performance curve).

**Equity curve:** clipped to the first trade date; **Value $ / Perf %** toggle; ranges below.
Chart component `EquityCurve.tsx` rebases SPY to the portfolio start.

**Chart ranges (live yahoo fetch, `/yahoo-history`):**
| Button | Lookback | Interval |
|---|---|---|
| 1D | latest session | 5m |
| 5D | 5 days | 15m |
| 1M / 6M / 1Y | 1–12 mo | 1d |
| 5Y | 5 yr | 1wk |
| ALL | full | 1mo |

**Stats bar (built).** Full-width, two tiers via a gear toggle (persisted in localStorage):
- **Core (7):** PnL, Total Return, CAGR, vs SPY, Max Drawdown, Sharpe, Win Rate
- **Advanced (+6):** Sortino, Calmar, Volatility, Beta, Alpha, P/L Ratio

Implementation specifics (`lib/portfolioStats.ts`):
- All return/risk metrics computed on the **TWR performance series** (flow-neutral).
- **Annualization by data frequency** (periods/year): 252 daily (1M/6M/1Y), 52 weekly (5Y), 12 monthly (ALL).
  1D/5D and windows < 25 days → annualized metrics show "—".
- Risk-free rate = live **^IRX** (3-mo T-bill) yield ÷ 100; fallback 4.5%.
- **Win Rate / P/L Ratio** from *closed* (position-reducing) trades within the window — the replay
  engine emits a `realizedEvents` list; each round-trip's realized P&L (net of that trade's fees)
  is classified win/loss.
- **Max DD** on the flow-neutral curve; **Beta/Alpha** regress portfolio vs SPY daily returns.
- All scoped to the selected range's window.

**Not yet built (planned):** allocation pie, return-by-symbol, rolling Sharpe, drawdown chart,
sub-tabs, SnapTrade, per-day snapshot caching in Supabase (`equity_snapshots`/`price_cache` exist in
schema but v1 fetches prices live rather than caching them).

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

### Cash flows + Time-Weighted Return (TWR)
Deposits/withdrawals are external cash movements, NOT performance. Counting them as gains would
distort every stat. So:
- They're stored as signed events and included in `cash(t)` (→ correct NLV).
- **Performance** uses TWR: chain per-interval returns with flows removed, so funding the account
  has zero effect on the % return. This is the fair vs-SPY comparison.
```
r_i   = (NLV_i − external_flow_i) / NLV_{i-1} − 1     (flow_i = net deposit/withdrawal in interval i)
TWR   = Π(1 + r_i) − 1
```
Two curve views: **Value $** (NLV, real dollars incl. deposits) and **Perf %** (TWR index, flow-neutral).
Sharpe/vol/drawdown derive from the TWR return series. Dividends/interest are skipped in v1
(slightly understates return; never inflates). External deposits not present in the CSV are added
via the manual deposits/withdrawals editor.

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
Like Sharpe but only penalizes downside volatility:
```
downside_returns = r[r < 0]
downside_std = std_dev(downside_returns) × √252
sortino = (mean(r) × 252 - r_f) / downside_std
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

---

*This file is updated as each feature is built. Formulas are the authoritative reference for backend implementation.*
