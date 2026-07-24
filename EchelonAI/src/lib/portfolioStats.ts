import type { EquityPoint } from "@/components/portfolio/EquityCurve";
import type { HistoryRange } from "@/lib/priceApi";

// Trading periods per year by sampling frequency of the selected range's data.
export function periodsPerYear(range: HistoryRange): number {
  if (range === "5y") return 52;    // weekly bars
  if (range === "max") return 12;   // monthly bars
  return 252;                        // daily (1M/6M/1Y); intraday gated out below
}

// Annualized metrics aren't meaningful on very short windows.
export function isShortWindow(range: HistoryRange): boolean {
  return range === "1d" || range === "5d";
}

export interface StatsInput {
  nlv: EquityPoint[];            // account value $ (for PnL)
  perf: EquityPoint[];           // TWR index, flow-neutral (for all returns/risk)
  benchmark: EquityPoint[];      // SPY close, same axis as perf
  netFlowInWindow: number;       // deposits − withdrawals within the window
  realizedInWindow: number[];    // realized P&L of closed trades in the window
  periodsPerYear: number;
  annualRiskFree: number;        // e.g. 0.045
  shortWindow: boolean;          // gate annualized metrics
}

export interface Stats {
  pnl: number | null;
  totalReturn: number | null;    // %
  cagr: number | null;           // %
  vsSpy: number | null;          // % (portfolio TWR − SPY return)
  maxDrawdown: number | null;    // % (negative)
  winRate: number | null;        // %
  sharpe: number | null;
  sortino: number | null;
  calmar: number | null;
  volatility: number | null;     // % annualized
  beta: number | null;
  alpha: number | null;          // % annualized
  plRatio: number | null;
}

function returns(series: EquityPoint[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const p = series[i - 1].value;
    if (p !== 0) r.push(series[i].value / p - 1);
  }
  return r;
}
const mean = (a: number[]) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
function std(a: number[]): number {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}

function maxDrawdown(series: EquityPoint[]): number | null {
  if (series.length < 2) return null;
  let peak = series[0].value, worst = 0;
  for (const p of series) {
    if (p.value > peak) peak = p.value;
    if (peak > 0) worst = Math.min(worst, p.value / peak - 1);
  }
  return worst * 100;
}

export function computeStats(inp: StatsInput): Stats {
  const { perf, benchmark, nlv } = inp;
  const empty: Stats = {
    pnl: null, totalReturn: null, cagr: null, vsSpy: null, maxDrawdown: null,
    winRate: null, sharpe: null, sortino: null, calmar: null, volatility: null,
    beta: null, alpha: null, plRatio: null,
  };
  if (perf.length < 2) return empty;

  const rp = returns(perf);
  const rb = returns(benchmark);
  const ppy = inp.periodsPerYear;
  const rfPer = inp.annualRiskFree / ppy;

  // Total return (TWR) + benchmark return
  const totalReturn = (perf[perf.length - 1].value / perf[0].value - 1) * 100;
  const spyReturn = benchmark.length >= 2 ? (benchmark[benchmark.length - 1].value / benchmark[0].value - 1) * 100 : null;
  const vsSpy = spyReturn != null ? totalReturn - spyReturn : null;

  // PnL $ = change in account value minus cash added/removed
  const pnl = nlv.length >= 2 ? (nlv[nlv.length - 1].value - nlv[0].value) - inp.netFlowInWindow : null;

  // CAGR
  const days = (perf[perf.length - 1].t - perf[0].t) / 86_400_000;
  const cagr = !inp.shortWindow && days >= 25 && perf[0].value > 0
    ? ((perf[perf.length - 1].value / perf[0].value) ** (365 / days) - 1) * 100
    : null;

  const dd = maxDrawdown(perf);

  // Win rate + P/L ratio from closed trades in window
  const closed = inp.realizedInWindow;
  const wins = closed.filter(x => x > 0);
  const losses = closed.filter(x => x < 0);
  const winRate = closed.length ? (wins.length / closed.length) * 100 : null;
  const avgWin = wins.length ? mean(wins) : null;
  const avgLoss = losses.length ? Math.abs(mean(losses)) : null;
  const plRatio = avgWin != null && avgLoss != null && avgLoss > 0 ? avgWin / avgLoss : null;

  // Risk-adjusted (gated on window length + enough points)
  const canRisk = !inp.shortWindow && rp.length >= 20;
  const sd = std(rp);
  const volatility = canRisk ? sd * Math.sqrt(ppy) * 100 : null;
  const sharpe = canRisk && sd > 0 ? ((mean(rp) - rfPer) / sd) * Math.sqrt(ppy) : null;

  const downside = rp.filter(x => x < rfPer).map(x => (x - rfPer) ** 2);
  const dDev = downside.length ? Math.sqrt(downside.reduce((s, x) => s + x, 0) / downside.length) : 0;
  const sortino = canRisk && dDev > 0 ? ((mean(rp) - rfPer) / dDev) * Math.sqrt(ppy) : null;

  const calmar = cagr != null && dd != null && dd < 0 ? cagr / Math.abs(dd) : null;

  // Beta / Alpha vs SPY
  let beta: number | null = null, alpha: number | null = null;
  if (canRisk && rb.length === rp.length && rb.length >= 20) {
    const mb = mean(rb), mp = mean(rp);
    const varB = rb.reduce((s, x) => s + (x - mb) ** 2, 0) / (rb.length - 1);
    const cov = rb.reduce((s, x, i) => s + (x - mb) * (rp[i] - mp), 0) / (rb.length - 1);
    if (varB > 0) {
      beta = cov / varB;
      const alphaPer = mp - (rfPer + beta * (mb - rfPer));
      alpha = alphaPer * ppy * 100; // annualized %
    }
  }

  return {
    pnl, totalReturn, cagr, vsSpy, maxDrawdown: dd, winRate,
    sharpe, sortino, calmar, volatility, beta, alpha, plRatio,
  };
}
