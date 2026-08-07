import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import EquityCurve, { type EquityPoint, type SeriesLine } from "@/components/portfolio/EquityCurve";
import CsvImport from "@/components/portfolio/CsvImport";
import { AlpacaConnectForm, AlpacaSyncPanel } from "@/components/portfolio/AlpacaConnect";
import StatsBar from "@/components/portfolio/StatsBar";
import ReturnBySymbol, { type SymbolReturn } from "@/components/portfolio/ReturnBySymbol";
import { getQuotes, getQuote, getHistory, type Quote, type HistoryRange } from "@/lib/priceApi";
import { replayPositions, buildCsvCurves, type ReplayTrade, type DerivedPosition, type RealizedEvent } from "@/lib/tradeReplay";
import { computeStats, periodsPerYear, isShortWindow } from "@/lib/portfolioStats";
import { useStatsTier } from "@/lib/useStatsTier";
import {
  listProfiles, createProfile, deleteProfile, listTrades, listCashFlows,
  addCashFlow, deleteCashFlow, toFlowEvents, type Profile, type CashFlow,
} from "@/lib/portfolioApi";

const labelStyle: React.CSSProperties = {
  fontSize: 9, letterSpacing: "0.2em", color: "var(--text-muted)", textTransform: "uppercase",
};
const inputStyle: React.CSSProperties = {
  border: "1px solid var(--border)", color: "var(--text)", background: "var(--surface-2)",
  fontFamily: "'DM Mono', monospace", fontSize: 13, padding: "10px 12px", outline: "none", width: "100%",
};
const btnStyle: React.CSSProperties = {
  background: "var(--accent)", border: "none", color: "#000", fontFamily: "'DM Mono', monospace",
  fontSize: 11, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase",
  padding: "10px 20px", cursor: "pointer",
};

function fmtMoney(v: number | null): string {
  if (v == null) return "—";
  return `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function pnlColor(v: number | null): string {
  if (v == null || v === 0) return "var(--text-muted)";
  return v > 0 ? "var(--green)" : "var(--red)";
}

// Empty state: choose a data source
function EmptyState({ onCreated }: { onCreated: () => void }) {
  const [source, setSource] = useState<"choose" | "alpaca" | "csv">("choose");
  if (source === "alpaca") return <AlpacaConnectForm onCreated={onCreated} />;
  if (source === "csv") return <CreateProfileForm onCreated={onCreated} />;
  return (
    <div className="panel-box" style={{ maxWidth: 460, margin: "0 auto", textAlign: "center" }}>
      <div className="panel-label">Add a Portfolio</div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 18 }}>Connect a broker or import a trade history.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button style={btnStyle} onClick={() => setSource("alpaca")}>Connect Alpaca</button>
        <button onClick={() => setSource("csv")} style={{
          background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)",
          fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
          padding: "10px 20px", cursor: "pointer",
        }}>Upload CSV</button>
      </div>
    </div>
  );
}

export const RANGES: HistoryRange[] = ["1d", "5d", "1mo", "6mo", "1y", "5y", "max"];
export const RANGE_LABEL: Record<HistoryRange, string> = { "1d": "1D", "5d": "5D", "1mo": "1M", "6mo": "6M", "1y": "1Y", "5y": "5Y", "max": "ALL" };

const dayMsOf = (iso: string) => new Date(iso + "T00:00:00Z").getTime();

function priceAtLocal(series: { t: number; close: number }[] | undefined, t: number): number | null {
  if (!series || series.length === 0) return null;
  if (t < series[0].t) return series[0].close;
  let lo = 0, hi = series.length - 1, ans = 0;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (series[m].t <= t) { ans = m; lo = m + 1; } else hi = m - 1; }
  return series[ans].close;
}

// Period return per open position, scoped to [tStart, tEnd] (Option B):
//   held before window → price(tEnd)/price(tStart) − 1
//   opened during window → price(tEnd)/avg_cost − 1
// Sign-adjusted so a profitable short reads positive.
function computeSymbolReturns(
  positions: DerivedPosition[], histByTicker: Record<string, { t: number; close: number }[]>,
  tStart: number, tEnd: number
): SymbolReturn[] {
  const out: SymbolReturn[] = [];
  for (const pos of positions) {
    const hist = histByTicker[pos.ticker];
    const priceEnd = priceAtLocal(hist, tEnd);
    const openedMs = pos.openedAt ? dayMsOf(pos.openedAt) : null;
    const startBasis = (openedMs != null && openedMs > tStart) ? pos.avgCost : (priceAtLocal(hist, tStart) ?? pos.avgCost);
    if (priceEnd == null || !startBasis) continue;
    const sign = pos.qty >= 0 ? 1 : -1;
    out.push({
      ticker: pos.ticker, side: pos.side,
      returnPct: sign * (priceEnd / startBasis - 1) * 100,
      pnl: pos.qty * (priceEnd - startBasis),
    });
  }
  return out;
}

// Symbols fully closed within the window (not currently held) → realized return.
function computeClosedReturns(
  events: RealizedEvent[], openTickers: Set<string>, tStart: number, tEnd: number
): SymbolReturn[] {
  const agg = new Map<string, { amount: number; cost: number }>();
  for (const e of events) {
    const d = dayMsOf(e.date);
    if (d < tStart || d > tEnd || openTickers.has(e.ticker)) continue;
    const a = agg.get(e.ticker) ?? { amount: 0, cost: 0 };
    a.amount += e.amount; a.cost += e.costBasis;
    agg.set(e.ticker, a);
  }
  const out: SymbolReturn[] = [];
  for (const [ticker, { amount, cost }] of agg) {
    out.push({ ticker, side: "long", closed: true, pnl: amount, returnPct: cost > 0 ? (amount / cost) * 100 : 0 });
  }
  return out;
}

// ── Create profile ─────────────────────────────────────────────────────────
function CreateProfileForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [cash, setCash] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!name.trim()) { setErr("Name required."); return; }
    setBusy(true);
    try { await createProfile(name, Number(cash) || 0, "CSV"); onCreated(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="panel-box" style={{ maxWidth: 460, margin: "0 auto" }}>
      <div className="panel-label">New Portfolio</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle}>Portfolio name</label>
          <input style={inputStyle} value={name} maxLength={40} placeholder="e.g. My Roth IRA" onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Starting cash before first trade (USD)</label>
          <input style={inputStyle} value={cash} type="number" step="any" placeholder="0.00" onChange={e => setCash(e.target.value)} />
          <span style={{ fontSize: 9, color: "var(--text-dim)" }}>Cash balance in the account before the earliest trade in your CSV.</span>
        </div>
        {err && <div style={{ fontSize: 11, color: "var(--red)" }}>{err}</div>}
        <button style={{ ...btnStyle, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={submit}>
          {busy ? "Creating…" : "Create Portfolio"}
        </button>
      </div>
    </div>
  );
}

// ── Cash flow editor ─────────────────────────────────────────────────────────
function CashFlowEditor({ accountId, flows, onChange }: {
  accountId: string; flows: CashFlow[]; onChange: () => void;
}) {
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"deposit" | "withdrawal">("deposit");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!date || !(Number(amount) > 0)) return;
    setBusy(true);
    try { await addCashFlow(accountId, date, Number(amount), kind); setDate(""); setAmount(""); onChange(); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ fontSize: 10, color: "var(--text-dim)" }}>
        Record deposits/withdrawals so funding isn't counted as a gain (time-weighted return).
      </p>
      {flows.map(f => (
        <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
          <span style={{ color: "var(--text-dim)", width: 90 }}>{f.flow_date}</span>
          <span style={{ color: f.kind === "deposit" ? "var(--green)" : "var(--red)", textTransform: "uppercase", fontSize: 9 }}>{f.kind}</span>
          <span style={{ marginLeft: "auto" }}>{fmtMoney(f.kind === "withdrawal" ? -f.amount : f.amount)}</span>
          <button onClick={async () => { await deleteCashFlow(f.id); onChange(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input style={{ ...inputStyle, flex: 1, minWidth: 130 }} type="date" value={date} onChange={e => setDate(e.target.value)} />
        <input style={{ ...inputStyle, flex: 1, minWidth: 100 }} type="number" step="any" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} />
        <select style={{ ...inputStyle, flex: 1, minWidth: 110, cursor: "pointer" }} value={kind} onChange={e => setKind(e.target.value as "deposit" | "withdrawal")}>
          <option value="deposit">Deposit</option>
          <option value="withdrawal">Withdrawal</option>
        </select>
        <button style={{ ...btnStyle, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={add}>Add</button>
      </div>
    </div>
  );
}

// ── Holdings (derived from trades) ────────────────────────────────────────────
interface HoldingRow { pos: DerivedPosition; price: number | null; dayPct: number | null; mv: number | null; unreal: number | null; unrealPct: number | null; weight: number | null; }

function buildHoldingRows(positions: DerivedPosition[], quotes: Record<string, Quote>, nlv: number): HoldingRow[] {
  return positions.map(pos => {
    const q = quotes[pos.ticker];
    const price = q?.price ?? null;
    const mv = price != null ? pos.qty * price : null;                 // qty signed
    const unreal = price != null ? pos.qty * (price - pos.avgCost) : null;
    const unrealPct = price != null ? (pos.qty >= 0 ? 1 : -1) * (price / pos.avgCost - 1) * 100 : null;
    const weight = mv != null && nlv !== 0 ? (mv / nlv) * 100 : null;
    return { pos, price, dayPct: q?.changePercent ?? null, mv, unreal, unrealPct, weight };
  });
}

function HoldingsTable({ rows }: { rows: HoldingRow[] }) {
  if (rows.length === 0) return <div style={{ fontSize: 11, color: "var(--text-dim)", padding: "12px 0" }}>No open positions.</div>;
  const head: React.CSSProperties = { fontSize: 9, letterSpacing: "0.12em", color: "var(--text-dim)", textTransform: "uppercase" };
  return (
    <div style={{ display: "flex", flexDirection: "column", fontSize: 12 }}>
      <div style={{ display: "flex", gap: 10, padding: "0 0 8px", borderBottom: "1px solid var(--border)" }}>
        <span style={{ ...head, width: 130 }}>Position</span>
        <span style={{ ...head, flex: 1, textAlign: "right" }}>Price</span>
        <span style={{ ...head, flex: 1, textAlign: "right" }}>Mkt Value</span>
        <span style={{ ...head, flex: 1, textAlign: "right" }}>Unrealized</span>
        <span style={{ ...head, width: 60, textAlign: "right" }}>Weight</span>
      </div>
      {rows.map(({ pos, price, dayPct, mv, unreal, unrealPct, weight }) => (
        <div key={pos.ticker} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
          <span style={{ width: 130, display: "flex", flexDirection: "column" }}>
            <span>
              <span style={{ color: "var(--accent)" }}>{pos.ticker}</span>
              <span style={{ fontSize: 8, marginLeft: 6, padding: "1px 5px", border: "1px solid var(--border)", color: pos.side === "short" ? "var(--red)" : "var(--green)", textTransform: "uppercase" }}>{pos.side}</span>
            </span>
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{Math.abs(pos.qty)} @ ${pos.avgCost.toFixed(2)}</span>
          </span>
          <span style={{ flex: 1, textAlign: "right", display: "flex", flexDirection: "column" }}>
            <span>{price != null ? `$${price.toFixed(2)}` : "—"}</span>
            <span style={{ fontSize: 10, color: pnlColor(dayPct) }}>{fmtPct(dayPct)}</span>
          </span>
          <span style={{ flex: 1, textAlign: "right" }}>{fmtMoney(mv)}</span>
          <span style={{ flex: 1, textAlign: "right", color: pnlColor(unreal), display: "flex", flexDirection: "column" }}>
            <span>{fmtMoney(unreal)}</span>
            <span style={{ fontSize: 10 }}>{fmtPct(unrealPct)}</span>
          </span>
          <span style={{ width: 60, textAlign: "right", color: "var(--text-muted)" }}>{weight != null ? `${weight.toFixed(1)}%` : "—"}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CsvPortfolio() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [trades, setTrades] = useState<ReplayTrade[]>([]);
  const [flows, setFlows] = useState<CashFlow[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [range, setRange] = useState<HistoryRange>("6mo");
  const [view, setView] = useState<"value" | "log" | "performance">("value");
  const tier = useStatsTier();
  const [nlvCurve, setNlvCurve] = useState<EquityPoint[]>([]);
  const [perfCurve, setPerfCurve] = useState<EquityPoint[]>([]);
  const [benchmark, setBenchmark] = useState<EquityPoint[]>([]);
  const [symbolReturns, setSymbolReturns] = useState<SymbolReturn[]>([]);
  const [curveLoading, setCurveLoading] = useState(false);
  const [annualRiskFree, setAnnualRiskFree] = useState(0.045);
  const [adding, setAdding] = useState(false);

  const active = profiles.find(p => p.id === activeId) ?? null;

  // Log view is advanced-only — drop back to Equity $ if advanced mode gets turned off
  useEffect(() => { if (view === "log" && tier !== "advanced") setView("value"); }, [tier, view]);

  // 3-month T-bill yield (^IRX) → annual risk-free rate for Sharpe/Sortino/Alpha
  useEffect(() => {
    getQuote("^IRX").then(q => {
      if (q?.price != null && q.price > 0 && q.price < 30) setAnnualRiskFree(q.price / 100);
    }).catch(() => {});
  }, []);

  async function loadProfiles() {
    setLoading(true); setErr(null);
    try {
      const list = await listProfiles();
      setProfiles(list);
      setActiveId(prev => prev && list.some(p => p.id === prev) ? prev : (list[0]?.id ?? null));
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed to load portfolios"); }
    finally { setLoading(false); }
  }

  async function loadData(accountId: string) {
    try {
      const [t, f] = await Promise.all([listTrades(accountId), listCashFlows(accountId)]);
      setTrades(t); setFlows(f);
      const tickers = Array.from(new Set(t.map(x => x.ticker)));
      setQuotes(tickers.length ? await getQuotes(tickers) : {});
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed to load data"); }
  }

  useEffect(() => { loadProfiles(); }, []);
  useEffect(() => { if (activeId) loadData(activeId); }, [activeId]);

  // Build curves when trades/flows/range/profile change
  useEffect(() => {
    let cancelled = false;
    async function build() {
      if (!active || trades.length === 0) { setNlvCurve([]); setPerfCurve([]); setBenchmark([]); setSymbolReturns([]); return; }
      setCurveLoading(true);
      try {
        const tickers = Array.from(new Set(trades.map(t => t.ticker)));
        const [spy, ...hists] = await Promise.all([getHistory("SPY", range), ...tickers.map(t => getHistory(t, range))]);
        if (cancelled) return;
        const histByTicker: Record<string, typeof spy> = {};
        tickers.forEach((t, i) => { histByTicker[t] = hists[i]; });

        // Clip the axis to start at the first trade — no flat starting_cash line before
        // any activity (matters most for ALL, where SPY history spans decades).
        const firstTradeMs = Math.min(...trades.map(t => new Date(t.date + "T00:00:00Z").getTime()));
        const clipped = spy.filter(p => p.t >= firstTradeMs);
        const src = clipped.length >= 2 ? clipped : spy;

        const axis = src.map(p => p.t);
        const curves = buildCsvCurves(trades, active.starting_cash, toFlowEvents(flows), histByTicker, axis);
        setNlvCurve(curves.nlv); setPerfCurve(curves.performance);
        setBenchmark(src.map(p => ({ t: p.t, value: p.close })));

        const rep = replayPositions(trades, active.starting_cash, toFlowEvents(flows));
        const openRows = computeSymbolReturns(rep.positions, histByTicker, axis[0], axis[axis.length - 1]);
        const closedRows = computeClosedReturns(rep.realizedEvents, new Set(rep.positions.map(p => p.ticker)), axis[0], axis[axis.length - 1]);
        setSymbolReturns([...openRows, ...closedRows]);
      } catch { if (!cancelled) { setNlvCurve([]); setPerfCurve([]); setBenchmark([]); } }
      finally { if (!cancelled) setCurveLoading(false); }
    }
    build();
    return () => { cancelled = true; };
  }, [active, trades, flows, range]);

  if (loading) return <div style={{ fontSize: 11, color: "var(--text-dim)", padding: 20 }} className="blink">Loading…</div>;
  if (err) return <div style={{ fontSize: 12, color: "var(--red)", padding: 16, border: "1px solid var(--red)" }}>{err}</div>;
  if (profiles.length === 0) return <EmptyState onCreated={loadProfiles} />;

  const replay = active ? replayPositions(trades, active.starting_cash, toFlowEvents(flows)) : null;
  const positionsMV = replay ? replay.positions.reduce((s, p) => {
    const q = quotes[p.ticker]; return s + (q?.price != null ? p.qty * q.price : 0);
  }, 0) : 0;
  const nlv = replay ? replay.cashNow + positionsMV : 0;
  const holdingRows = replay ? buildHoldingRows(replay.positions, quotes, nlv) : [];

  const portfolioSeries = view === "performance" ? perfCurve : nlvCurve;
  const logScale = view === "log" && tier === "advanced";

  // Perf % is an unlevered return index that starts at 0% — the legacy single-line EquityCurve
  // mode rebases SPY by multiplying against portfolio[0].value, which breaks at a zero anchor.
  // Multi-series mode sidesteps that (each series is pre-computed in its own display units).
  const perfSeries: SeriesLine[] | undefined = view === "performance" && perfCurve.length >= 2
    ? (() => {
        const ref = perfCurve[0].value || 1;
        const s: SeriesLine[] = [{
          id: "portfolio", label: active?.account_name ?? "Portfolio", color: "var(--accent)",
          points: perfCurve.map(p => ({ t: p.t, value: (p.value / ref - 1) * 100 })),
        }];
        if (benchmark.length >= 2) {
          const bRef = benchmark[0].value || 1;
          s.push({
            id: "spy", label: "SPY", color: "var(--text-dim)", dashed: true,
            points: benchmark.map(b => ({ t: b.t, value: (b.value / bRef - 1) * 100 })),
          });
        }
        return s;
      })()
    : undefined;

  // Click a symbol → confirm → open the Analyze tab prefilled with that ticker
  function analyzeTicker(ticker: string) {
    if (!confirm(`Run EchelonAI analysis for ${ticker}?`)) return;
    localStorage.setItem("echelon_page", "analyze");
    localStorage.setItem("echelon_analyze_ticker", ticker);
    location.reload();
  }

  // Stats scoped to the visible window (curve axis)
  const dMs = (iso: string) => new Date(iso + "T00:00:00Z").getTime();
  const stats = (active && perfCurve.length >= 2)
    ? (() => {
        const winStart = perfCurve[0].t, winEnd = perfCurve[perfCurve.length - 1].t;
        const flowEvents = toFlowEvents(flows);
        const netFlowInWindow = flowEvents.reduce((s, f) => {
          const d = dMs(f.date); return d > winStart && d <= winEnd ? s + f.amount : s;
        }, 0);
        const realizedInWindow = (replay?.realizedEvents ?? [])
          .filter(e => { const d = dMs(e.date); return d >= winStart && d <= winEnd; })
          .map(e => e.amount);
        return computeStats({
          nlv: nlvCurve, perf: perfCurve, benchmark,
          netFlowInWindow, realizedInWindow,
          periodsPerYear: periodsPerYear(perfCurve), annualRiskFree, shortWindow: isShortWindow(range),
        });
      })()
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Add-portfolio modal */}
      {adding && (
        <div onClick={() => setAdding(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480 }}>
            <EmptyState onCreated={() => { setAdding(false); loadProfiles(); }} />
          </div>
        </div>
      )}

      {/* full-width stats bar */}
      <StatsBar stats={stats} />
      {/* header + totals */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <label style={labelStyle}>Portfolio</label>
        <select style={{ ...inputStyle, width: "auto", cursor: "pointer" }} value={activeId ?? ""} onChange={e => setActiveId(e.target.value)}>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.account_name}</option>)}
        </select>
        <button onClick={() => setAdding(true)}
          style={{ background: "rgba(245,166,35,0.12)", border: "1px solid var(--accent-dim)", color: "var(--accent)", fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", padding: "6px 10px", cursor: "pointer" }}>
          + Add
        </button>
        <button onClick={async () => { if (active && confirm(`Delete "${active.account_name}"?`)) { await deleteProfile(active.id); loadProfiles(); } }}
          style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-dim)", fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", padding: "6px 10px", cursor: "pointer" }}>
          Delete
        </button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 18, fontSize: 12 }}>
          <span style={labelStyle}>NLV <span style={{ color: "var(--text)", letterSpacing: 0 }}>{fmtMoney(nlv)}</span></span>
          <span style={labelStyle}>Cash <span style={{ color: replay && replay.cashNow < 0 ? "var(--red)" : "var(--text)", letterSpacing: 0 }}>{fmtMoney(replay?.cashNow ?? null)}</span></span>
          <span style={labelStyle}>Realized <span style={{ color: pnlColor(replay?.realizedTotal ?? null), letterSpacing: 0 }}>{fmtMoney(replay?.realizedTotal ?? null)}</span></span>
        </div>
      </div>

      {/* equity curve */}
      <div className="panel-box">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
          <div className="panel-label" style={{ marginBottom: 0 }}>Portfolio vs SPY</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 2 }}>
              {(tier === "advanced"
                ? (["value", "log", "performance"] as const)
                : (["value", "performance"] as const)
              ).map(v => (
                <button key={v} onClick={() => setView(v)}
                  title={v === "performance" ? "Unlevered return on positions — flow- and leverage-neutral (fair vs SPY)" : v === "log" ? "Equity $ on a logarithmic y-axis" : "Equity = cash + market value (cash negative on leverage)"}
                  style={{ background: v === view ? "var(--surface-2)" : "transparent", color: v === view ? "var(--accent)" : "var(--text-dim)", border: "1px solid var(--border)", fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 8px", cursor: "pointer" }}>
                  {v === "performance" ? "Perf %" : v === "log" ? "Log" : "Equity $"}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {RANGES.map(r => (
                <button key={r} onClick={() => setRange(r)}
                  style={{ background: r === range ? "var(--accent)" : "transparent", color: r === range ? "#000" : "var(--text-muted)", border: "1px solid " + (r === range ? "var(--accent)" : "var(--border)"), fontFamily: "'DM Mono', monospace", fontSize: 9, padding: "4px 8px", cursor: "pointer" }}>
                  {RANGE_LABEL[r]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <EquityCurve
          portfolio={perfSeries ? undefined : portfolioSeries}
          benchmark={perfSeries ? undefined : benchmark}
          series={perfSeries}
          valueFormat={view === "performance" ? "percent" : "money"}
          loading={curveLoading} logScale={logScale}
          emptyMessage="Import trades to see your equity curve." />
      </div>

      {/* import / sync */}
      <div className="panel-box">
        <div className="panel-label">{active?.broker === "Alpaca" ? "Alpaca Sync" : "Import Trades"}</div>
        {active && (active.broker === "Alpaca"
          ? <AlpacaSyncPanel profileId={active.id} onSynced={() => loadData(active.id)} />
          : <CsvImport accountId={active.id} hasTrades={trades.length > 0} onImported={() => loadData(active.id)} />)}
      </div>

      {/* return by symbol (period-scoped) */}
      <div className="panel-box">
        <div className="panel-label">Return by Symbol · {RANGE_LABEL[range]}</div>
        <ReturnBySymbol data={symbolReturns} onPick={analyzeTicker} />
      </div>

      {/* holdings */}
      <div className="panel-box">
        <div className="panel-label">Holdings</div>
        <HoldingsTable rows={holdingRows} />
      </div>

      {/* cash flows — manual editor only for CSV profiles (Alpaca pulls CSD/CSW on sync) */}
      {active && active.broker !== "Alpaca" && (
        <div className="panel-box">
          <div className="panel-label">Deposits & Withdrawals</div>
          <CashFlowEditor accountId={active.id} flows={flows} onChange={() => loadData(active.id)} />
        </div>
      )}
    </div>
  );
}
