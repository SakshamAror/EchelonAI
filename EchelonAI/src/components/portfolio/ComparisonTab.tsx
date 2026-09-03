import { useEffect, useMemo, useState } from "react";
import EquityCurve, { type SeriesLine } from "@/components/portfolio/EquityCurve";
import { RANGES, RANGE_LABEL } from "@/components/portfolio/CsvPortfolio";
import { listProfiles, listTrades, listCashFlows, toFlowEvents, type Profile } from "@/lib/portfolioApi";
import { getHistory, getQuote, type HistoryRange, type HistoryPoint } from "@/lib/priceApi";
import { replayPositions, buildCsvCurves, type CashFlowEvent, type RealizedEvent } from "@/lib/tradeReplay";
import { computeStats, periodsPerYear, isShortWindow, type Stats } from "@/lib/portfolioStats";
import { STAT_DEFS } from "@/lib/statDefs";
import { useStatsTier } from "@/lib/useStatsTier";

const SELECTED_KEY = "echelon_compare_profiles";

function loadSelected(): string[] {
  try { return JSON.parse(localStorage.getItem(SELECTED_KEY) ?? "[]"); } catch { return []; }
}

// Stable color per profile, independent of selection order
function hashColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 65%, 58%)`;
}

interface BuiltProfile {
  nlv: { t: number; value: number }[];
  perf: { t: number; value: number }[];   // unlevered return index, axis-aligned across all selected profiles
  flows: CashFlowEvent[];
  realizedEvents: RealizedEvent[];
  firstTradeMs: number | null;
}

const dMs = (iso: string) => new Date(iso + "T00:00:00Z").getTime();

const thStyle: React.CSSProperties = {
  fontSize: 9, letterSpacing: "0.1em", color: "var(--text-dim)", textTransform: "uppercase",
  textAlign: "right", padding: "0 0 8px", whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = {
  fontSize: 12, textAlign: "right", padding: "8px 0", borderTop: "1px solid var(--border)", whiteSpace: "nowrap",
};

export default function ComparisonTab() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>(loadSelected);
  const [range, setRange] = useState<HistoryRange>("6mo");
  const [annualRiskFree, setAnnualRiskFree] = useState(0.045);
  const [built, setBuilt] = useState<Record<string, BuiltProfile>>({});
  const [spy, setSpy] = useState<HistoryPoint[]>([]);
  const [curveLoading, setCurveLoading] = useState(false);
  const tier = useStatsTier();

  useEffect(() => { localStorage.setItem(SELECTED_KEY, JSON.stringify(selected)); }, [selected]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { setProfiles(await listProfiles()); } finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    getQuote("^IRX").then(q => {
      if (q?.price != null && q.price > 0 && q.price < 30) setAnnualRiskFree(q.price / 100);
    }).catch(() => {});
  }, []);

  function toggle(id: string) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }

  const activeProfiles = useMemo(
    () => profiles.filter(p => selected.includes(p.id)),
    [profiles, selected]
  );

  // Fetch trades/flows/prices for the selected profiles and build axis-aligned curves
  useEffect(() => {
    let cancelled = false;
    async function build() {
      if (activeProfiles.length === 0) { setBuilt({}); setSpy([]); return; }
      setCurveLoading(true);
      try {
        const perProfileData = await Promise.all(activeProfiles.map(async p => {
          const [trades, cashFlows] = await Promise.all([listTrades(p.id), listCashFlows(p.id)]);
          return { profile: p, trades, cashFlows };
        }));
        if (cancelled) return;

        const tickers = Array.from(new Set(perProfileData.flatMap(d => d.trades.map(t => t.ticker))));
        const [spyHist, ...hists] = await Promise.all([
          getHistory("SPY", range),
          ...tickers.map(t => getHistory(t, range)),
        ]);
        if (cancelled) return;
        const histByTicker: Record<string, HistoryPoint[]> = {};
        tickers.forEach((t, i) => { histByTicker[t] = hists[i]; });
        const axis = spyHist.map(p => p.t);

        const next: Record<string, BuiltProfile> = {};
        for (const d of perProfileData) {
          const flowEvents = toFlowEvents(d.cashFlows);
          const curves = buildCsvCurves(d.trades, d.profile.starting_cash, flowEvents, histByTicker, axis);
          const rep = replayPositions(d.trades, d.profile.starting_cash, flowEvents);
          const firstTradeMs = d.trades.length
            ? Math.min(...d.trades.map(t => dMs(t.date)))
            : null;
          next[d.profile.id] = {
            nlv: curves.nlv, perf: curves.performance,
            flows: flowEvents, realizedEvents: rep.realizedEvents, firstTradeMs,
          };
        }
        setBuilt(next);
        setSpy(spyHist);
      } catch {
        if (!cancelled) { setBuilt({}); setSpy([]); }
      } finally {
        if (!cancelled) setCurveLoading(false);
      }
    }
    build();
    return () => { cancelled = true; };
  }, [activeProfiles, range]);

  // Clip every curve to the window where ALL selected profiles have live data,
  // then rebase each to 0% at that common start — a fair, leverage-neutral % comparison.
  const { series, statsById, windowOk } = useMemo(() => {
    const ids = Object.keys(built);
    const axis = spy.map(p => p.t);
    const starts = ids.map(id => built[id].firstTradeMs).filter((v): v is number => v != null);
    const commonStartMs = starts.length === ids.length && starts.length > 0 ? Math.max(...starts) : null;
    const startIdx = commonStartMs != null ? axis.findIndex(t => t >= commonStartMs) : -1;
    const ok = startIdx >= 0 && axis.length - startIdx >= 2;

    if (!ok) return { series: [] as SeriesLine[], statsById: {} as Record<string, Stats | null>, windowOk: false };

    const winStart = axis[startIdx], winEnd = axis[axis.length - 1];
    const spyClipped = spy.slice(startIdx);
    const spyRef = spyClipped[0].close || 1;

    const s: SeriesLine[] = ids.map(id => {
      const clipped = built[id].perf.slice(startIdx);
      const ref = clipped[0].value || 1;
      return {
        id, label: profiles.find(p => p.id === id)?.account_name ?? id, color: hashColor(id),
        points: clipped.map(p => ({ t: p.t, value: (p.value / ref - 1) * 100 })),
      };
    });
    s.push({
      id: "__spy", label: "SPY", color: "var(--text-dim)", dashed: true,
      points: spyClipped.map(p => ({ t: p.t, value: (p.close / spyRef - 1) * 100 })),
    });

    const stats: Record<string, Stats | null> = {};
    for (const id of ids) {
      const p = built[id];
      const nlvClipped = p.nlv.slice(startIdx);
      const perfClipped = p.perf.slice(startIdx);
      const benchmarkClipped = spyClipped.map(pt => ({ t: pt.t, value: pt.close }));
      const netFlowInWindow = p.flows.reduce((sum, f) => {
        const d = dMs(f.date); return d > winStart && d <= winEnd ? sum + f.amount : sum;
      }, 0);
      const realizedInWindow = p.realizedEvents
        .filter(e => { const d = dMs(e.date); return d >= winStart && d <= winEnd; })
        .map(e => e.amount);
      stats[id] = perfClipped.length >= 2 ? computeStats({
        nlv: nlvClipped, perf: perfClipped, benchmark: benchmarkClipped,
        netFlowInWindow, realizedInWindow,
        periodsPerYear: periodsPerYear(perfClipped), annualRiskFree, shortWindow: isShortWindow(range),
      }) : null;
    }
    return { series: s, statsById: stats, windowOk: true };
  }, [built, spy, profiles, range, annualRiskFree]);

  const statDefs = STAT_DEFS.filter(d => tier === "advanced" || d.tier === "core");

  if (loading) return <div style={{ fontSize: 11, color: "var(--text-dim)", padding: 20 }} className="blink">Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 20 }}>
      {/* profile picker */}
      <div className="panel-box">
        <div className="panel-label">Compare Profiles</div>
        {profiles.length === 0 ? (
          <p style={{ fontSize: 11, color: "var(--text-dim)" }}>No portfolios yet — create one on the Portfolio tab first.</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {profiles.map(p => {
              const on = selected.includes(p.id);
              return (
                <label key={p.id} style={{
                  display: "flex", alignItems: "center", gap: 7, fontSize: 12, cursor: "pointer",
                  padding: "6px 10px", border: "1px solid " + (on ? "var(--accent-dim)" : "var(--border)"),
                  background: on ? "rgba(245,166,35,0.08)" : "transparent",
                }}>
                  <input type="checkbox" checked={on} onChange={() => toggle(p.id)} style={{ accentColor: "var(--accent)" }} />
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: hashColor(p.id), flexShrink: 0 }} />
                  {p.account_name}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {selected.length === 0 ? (
        <div className="panel-box" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
          <p style={{ fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Select profiles above to compare.
          </p>
        </div>
      ) : (
        <>
          {/* chart */}
          <div className="panel-box">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
              <div className="panel-label" style={{ marginBottom: 0 }}>Performance Comparison · TWR %</div>
              <div style={{ display: "flex", gap: 4 }}>
                {RANGES.map(r => (
                  <button key={r} onClick={() => setRange(r)}
                    style={{ background: r === range ? "var(--accent)" : "transparent", color: r === range ? "#000" : "var(--text-muted)", border: "1px solid " + (r === range ? "var(--accent)" : "var(--border)"), fontFamily: "'DM Mono', monospace", fontSize: 9, padding: "4px 8px", cursor: "pointer" }}>
                    {RANGE_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>
            <EquityCurve
              series={series}
              loading={curveLoading}
              valueFormat="percent"
              emptyMessage={windowOk ? "No data." : "Not enough overlapping history for the selected profiles in this range."}
            />
          </div>

          {/* stats table */}
          {windowOk && (
            <div className="panel-box" style={{ overflowX: "auto" }}>
              <div className="panel-label">Stats · {RANGE_LABEL[range]}</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, textAlign: "left" }}>Profile</th>
                    {statDefs.map(d => <th key={d.key} style={thStyle}>{d.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {activeProfiles.map(p => {
                    const st = statsById[p.id];
                    return (
                      <tr key={p.id}>
                        <td style={{ ...tdStyle, textAlign: "left" }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: hashColor(p.id), display: "inline-block", marginRight: 7 }} />
                          {p.account_name}
                        </td>
                        {statDefs.map(d => {
                          const v = st ? st[d.key] : null;
                          return (
                            <td key={d.key} style={{ ...tdStyle, color: v == null ? "var(--text-dim)" : (d.color ? d.color(v) : "var(--text)") }}>
                              {v == null ? "—" : d.fmt(v)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
