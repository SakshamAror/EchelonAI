import type { EquityPoint } from "@/components/portfolio/EquityCurve";
import type { HistoryPoint } from "@/lib/priceApi";

// Canonical trade the engine consumes (same shape SnapTrade will normalize into).
export interface ReplayTrade {
  date: string;                 // ISO yyyy-mm-dd
  ticker: string;
  action: "buy" | "sell";
  qty: number;
  price: number;
  fees: number;
}

export interface DerivedPosition {
  ticker: string;
  qty: number;                  // net (negative if net short)
  avgCost: number;              // weighted average cost of the open position
  side: "long" | "short";
  realized: number;             // realized P&L to date for this ticker
  openedAt: string | null;      // first trade date that opened the current position
}

// A realizing (position-reducing) trade — one round-trip result for win-rate/P&L stats.
export interface RealizedEvent {
  date: string;
  ticker: string;
  amount: number;     // realized P&L on the closed portion, net of this trade's fees
  costBasis: number;  // cost of the closed shares (for realized return %)
}

export interface ReplayResult {
  positions: DerivedPosition[]; // current open positions (qty != 0)
  cashNow: number;
  realizedTotal: number;
  realizedEvents: RealizedEvent[];
  firstDate: string | null;
}

// External cash movement. amount signed: deposit > 0, withdrawal < 0.
export interface CashFlowEvent {
  date: string;   // ISO yyyy-mm-dd
  amount: number;
}

// Forward-fill price at or before t
function priceAt(series: HistoryPoint[], t: number): number | null {
  if (!series || series.length === 0 || t < series[0].t) return null;
  let lo = 0, hi = series.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid].t <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans >= 0 ? series[ans].close : null;
}

interface Lot { qty: number; avgCost: number; realized: number; openedAt: string | null; }

// Average-cost accounting. Handles long accumulation and full/partial closes.
// Shorts supported: selling more than held flips to negative qty (short).
function applyTrade(lot: Lot, tr: ReplayTrade): Lot {
  const dir = tr.action === "buy" ? 1 : -1;
  const signedQty = dir * tr.qty;
  const prevQty = lot.qty;
  const newQty = prevQty + signedQty;
  let { avgCost, realized, openedAt } = lot;

  const sameSide = prevQty === 0 || Math.sign(prevQty) === Math.sign(signedQty);
  if (prevQty === 0) {
    avgCost = tr.price;
    openedAt = tr.date;
  } else if (sameSide) {
    // adding to the position → weighted average
    avgCost = (Math.abs(prevQty) * avgCost + tr.qty * tr.price) / (Math.abs(prevQty) + tr.qty);
  } else {
    // reducing / closing → realize P&L on the closed portion
    const closedQty = Math.min(tr.qty, Math.abs(prevQty));
    const pnlPerShare = prevQty > 0 ? tr.price - avgCost : avgCost - tr.price;
    realized += pnlPerShare * closedQty;
    if (Math.abs(signedQty) > Math.abs(prevQty)) {
      // flipped through zero → new position at trade price
      avgCost = tr.price;
      openedAt = tr.date;
    }
    if (newQty === 0) openedAt = null;
  }
  realized -= tr.fees;
  return { qty: newQty, avgCost, realized, openedAt };
}

export function replayPositions(
  trades: ReplayTrade[], startingCash: number, flows: CashFlowEvent[] = []
): ReplayResult {
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  const lots = new Map<string, Lot>();
  const realizedEvents: RealizedEvent[] = [];
  let cash = startingCash + flows.reduce((s, f) => s + f.amount, 0);

  for (const tr of sorted) {
    const lot = lots.get(tr.ticker) ?? { qty: 0, avgCost: 0, realized: 0, openedAt: null };
    const dir = tr.action === "buy" ? 1 : -1;
    // a trade that reduces an opposite-signed position realizes P&L (a round-trip close)
    const isClose = lot.qty !== 0 && Math.sign(lot.qty) !== dir;
    const closedQty = isClose ? Math.min(tr.qty, Math.abs(lot.qty)) : 0;
    const costBasis = closedQty * lot.avgCost;
    const before = lot.realized;
    const next = applyTrade(lot, tr);
    lots.set(tr.ticker, next);
    if (isClose) realizedEvents.push({ date: tr.date, ticker: tr.ticker, amount: next.realized - before, costBasis });
    cash += (tr.action === "buy" ? -1 : 1) * tr.qty * tr.price - tr.fees;
  }

  const positions: DerivedPosition[] = [];
  let realizedTotal = 0;
  for (const [ticker, lot] of lots) {
    realizedTotal += lot.realized;
    if (Math.abs(lot.qty) > 1e-9) {
      positions.push({
        ticker,
        qty: lot.qty,
        avgCost: lot.avgCost,
        side: lot.qty >= 0 ? "long" : "short",
        realized: lot.realized,
        openedAt: lot.openedAt,
      });
    }
  }
  positions.sort((a, b) => a.ticker.localeCompare(b.ticker));

  return {
    positions,
    cashNow: cash,
    realizedTotal,
    realizedEvents,
    firstDate: sorted[0]?.date ?? null,
  };
}

export interface CsvCurves {
  nlv: EquityPoint[];          // account value in $ (includes deposited cash)
  performance: EquityPoint[];  // TWR growth, flow-neutral, scaled to start at nlv[0]
  twrPct: number;              // total time-weighted return %
}

const dayMs = (iso: string) => new Date(iso + "T00:00:00Z").getTime();

/**
 * Build both curves from a dated trade log + cash flows:
 *  - NLV(t) = cash(t) + Σ qty_i(t)×price_i(t), where cash includes external flows
 *  - Performance = Time-Weighted Return index (external flows neutralized), so
 *    deposits/withdrawals never register as gains/losses.
 * Idle cash, margin (negative cash), and shorts (negative qty) all fall out naturally.
 */
export function buildCsvCurves(
  trades: ReplayTrade[],
  startingCash: number,
  flows: CashFlowEvent[],
  histByTicker: Record<string, HistoryPoint[]>,
  axis: number[]
): CsvCurves {
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  const sortedFlows = [...flows].sort((a, b) => a.date.localeCompare(b.date));

  const nlv: EquityPoint[] = axis.map(t => {
    const qtyByTicker = new Map<string, number>();
    let cash = startingCash;
    for (const f of sortedFlows) { if (dayMs(f.date) > t) break; cash += f.amount; }
    for (const tr of sorted) {
      if (dayMs(tr.date) > t) break;
      const dir = tr.action === "buy" ? 1 : -1;
      qtyByTicker.set(tr.ticker, (qtyByTicker.get(tr.ticker) ?? 0) + dir * tr.qty);
      cash += -dir * tr.qty * tr.price - tr.fees;
    }
    let value = cash;
    for (const [ticker, qty] of qtyByTicker) {
      if (Math.abs(qty) < 1e-9) continue;
      const series = histByTicker[ticker];
      // Value at the price at/≤ t; if t precedes this ticker's history, fall back to
      // its earliest known price so a held position is never valued at $0 (which would
      // create an artificial dip-then-jump the moment the price series begins).
      let price = priceAt(series, t);
      if (price == null && series && series.length) price = series[0].close;
      if (price != null) value += qty * price;
    }
    return { t, value };
  });

  // External net flow within each interval (t_{i-1}, t_i]
  const flowAt = (i: number): number => {
    if (i === 0) return 0;
    const lo = axis[i - 1], hi = axis[i];
    return sortedFlows.reduce((s, f) => {
      const d = dayMs(f.date);
      return d > lo && d <= hi ? s + f.amount : s;
    }, 0);
  };

  // Time-weighted return: chain per-interval returns with flows removed.
  // The index only starts once NLV is first positive (capital deployed), so a
  // deposit-funded account (starting NLV = 0) doesn't produce a degenerate flat line.
  const performance: EquityPoint[] = [];
  let base = 0, index = 0, started = false;
  for (let i = 0; i < nlv.length; i++) {
    const v = nlv[i].value;
    if (!started) {
      if (v > 0) { started = true; base = v; index = v; }
    } else {
      const prev = nlv[i - 1].value;
      const r = prev > 0 ? (v - flowAt(i)) / prev - 1 : 0;
      index *= 1 + r;
    }
    performance.push({ t: nlv[i].t, value: started ? index : v });
  }
  const twrPct = started && base !== 0 ? (index / base - 1) * 100 : 0;

  return { nlv, performance, twrPct };
}
