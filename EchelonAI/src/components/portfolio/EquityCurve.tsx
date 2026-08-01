import { useRef, useState } from "react";

export interface EquityPoint {
  t: number;      // epoch ms
  value: number;  // portfolio value in USD
}

interface Props {
  portfolio: EquityPoint[];
  benchmark?: EquityPoint[];   // e.g. SPY, rebased to portfolio start
  benchmarkLabel?: string;
  height?: number;
  emptyMessage?: string;
  loading?: boolean;           // show animated shimmer skeleton while building
}

// Animated placeholder shown while a curve is being built (no data yet)
function ChartSkeleton({ height }: { height: number }) {
  return (
    <div style={{ position: "relative", height, overflow: "hidden" }}>
      <svg viewBox={`0 0 ${VB_W} ${height}`} width="100%" height={height} preserveAspectRatio="none" style={{ display: "block" }}>
        {[0.25, 0.5, 0.75].map((f, i) => (
          <line key={i} className="skeleton-line" x1={PAD.left} x2={VB_W - PAD.right}
            y1={PAD.top + f * (height - PAD.top - PAD.bottom)} y2={PAD.top + f * (height - PAD.top - PAD.bottom)}
            stroke="var(--border)" strokeWidth={0.5} />
        ))}
        {/* faint placeholder curve */}
        <path className="skeleton-line" d={`M${PAD.left},${height * 0.7} C${VB_W * 0.3},${height * 0.4} ${VB_W * 0.6},${height * 0.8} ${VB_W - PAD.right},${height * 0.35}`}
          fill="none" stroke="var(--accent-dim)" strokeWidth={1.4} />
      </svg>
      <div className="chart-shimmer" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
      <span className="blink" style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-dim)",
      }}>
        Building curve…
      </span>
    </div>
  );
}

const VB_W = 1000;
// right padding holds the y-axis price labels (Google/Yahoo style)
const PAD = { top: 20, right: 66, bottom: 26, left: 14 };

function fmtMoney(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

// Full number with commas for the y-axis price labels (e.g. $99,164)
function fmtAxisMoney(v: number): string {
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${Math.round(v).toLocaleString()}`;
}

function fmtDate(t: number): string {
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Adaptive x-axis label: hours → days → months → years, by total span
function fmtAxisTime(t: number, spanMs: number): string {
  const d = new Date(t);
  const DAY = 86_400_000;
  if (spanMs < 1.5 * DAY)  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (spanMs < 60 * DAY)   return d.toLocaleDateString([], { month: "short", day: "numeric" });
  if (spanMs < 400 * DAY)  return d.toLocaleDateString([], { month: "short" });
  if (spanMs < 1500 * DAY) return d.toLocaleDateString([], { month: "short", year: "2-digit" });
  return String(d.getFullYear());
}

// Round "nice" gridline values (1/2/5 × 10^n) spanning [min, max]
function niceNum(range: number, round: boolean): number {
  const exp = Math.floor(Math.log10(range || 1));
  const f = (range || 1) / Math.pow(10, exp);
  const nf = round
    ? (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10)
    : (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10);
  return nf * Math.pow(10, exp);
}
function niceTicks(min: number, max: number, count = 4): number[] {
  const step = niceNum(niceNum(max - min, false) / (count - 1), true);
  const lo = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= max + step * 0.5; v += step) ticks.push(v);
  return ticks;
}

export default function EquityCurve({
  portfolio,
  benchmark,
  benchmarkLabel = "SPY",
  height = 340,
  emptyMessage = "No data available.",
  loading = false,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const VB_H = height;
  const plotW = VB_W - PAD.left - PAD.right;
  const plotH = VB_H - PAD.top - PAD.bottom;

  // While building, always show the skeleton (never the stale curve)
  if (loading) return <ChartSkeleton height={height} />;

  // Empty state
  if (!portfolio || portfolio.length < 2) {
    return (
      <div style={{
        height, display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--text-dim)", fontSize: 11, letterSpacing: "0.08em",
      }}>
        {emptyMessage}
      </div>
    );
  }

  // Rebase benchmark to portfolio's starting value
  const rebased: EquityPoint[] | undefined = benchmark && benchmark.length >= 2
    ? benchmark.map(b => ({ t: b.t, value: portfolio[0].value * (b.value / benchmark[0].value) }))
    : undefined;

  const allValues = [...portfolio.map(p => p.value), ...(rebased?.map(b => b.value) ?? [])];
  const minV = Math.min(...allValues);
  const maxV = Math.max(...allValues);
  const range = maxV - minV || 1;
  const pad = range * 0.08;
  const yMin = minV - pad;
  const yMax = maxV + pad;

  const t0 = portfolio[0].t;
  const t1 = portfolio[portfolio.length - 1].t;
  const tSpan = t1 - t0 || 1;

  const x = (t: number) => PAD.left + ((t - t0) / tSpan) * plotW;
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  const pathFor = (pts: EquityPoint[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");

  const portfolioPath = pathFor(portfolio);
  const areaPath = `${portfolioPath} L${x(t1).toFixed(1)},${y(yMin).toFixed(1)} L${x(t0).toFixed(1)},${y(yMin).toFixed(1)} Z`;

  // Y gridlines at round values, drawn only within the visible range
  const gridVals = niceTicks(minV, maxV, 4).filter(v => v >= yMin && v <= yMax);

  // X-axis time ticks (adaptive granularity)
  const xTickN = 6;
  const xTicks = Array.from({ length: xTickN + 1 }, (_, i) => t0 + (tSpan * i) / xTickN);

  const startVal = portfolio[0].value;
  const endVal = portfolio[portfolio.length - 1].value;
  const totalReturn = (endVal / startVal - 1) * 100;
  const up = endVal >= startVal;
  const lineColor = "var(--accent)";

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * VB_W;
    const tGuess = t0 + ((relX - PAD.left) / plotW) * tSpan;
    // nearest index
    let lo = 0, hi = portfolio.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (portfolio[mid].t < tGuess) lo = mid + 1; else hi = mid;
    }
    setHoverIdx(lo);
  }

  const hp = hoverIdx != null ? portfolio[hoverIdx] : null;
  const hb = hoverIdx != null && rebased ? rebased[Math.min(hoverIdx, rebased.length - 1)] : null;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
        style={{ display: "block", overflow: "visible" }}
      >
        {/* horizontal gridlines at round equity levels, labels on the right */}
        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={y(v)} x2={VB_W - PAD.right} y2={y(v)}
              stroke="var(--border)" strokeWidth={0.5} opacity={0.45} />
            <text x={VB_W - PAD.right + 8} y={y(v) + 3} textAnchor="start"
              fill="var(--text-dim)" fontSize={11} fontFamily="'DM Mono', monospace">
              {fmtAxisMoney(v)}
            </text>
          </g>
        ))}

        {/* area fill */}
        <path d={areaPath} fill={lineColor} opacity={0.06} />

        {/* benchmark line (dashed) */}
        {rebased && (
          <path d={pathFor(rebased)} fill="none" stroke="var(--text-dim)"
            strokeWidth={1.2} strokeDasharray="4 4" opacity={0.7} />
        )}

        {/* portfolio line — draws in on data change (key remounts to replay) */}
        <path
          key={`${portfolio.length}:${t0}:${Math.round(endVal)}`}
          className="equity-draw"
          pathLength={1}
          d={portfolioPath} fill="none" stroke={lineColor} strokeWidth={1.8}
        />

        {/* x-axis time labels — adaptive granularity, multiple evenly-spaced ticks */}
        {xTicks.map((t, i) => (
          <text key={i} x={x(t)} y={VB_H - 8}
            textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
            fill="var(--text-dim)" fontSize={11} fontFamily="'DM Mono', monospace">
            {fmtAxisTime(t, tSpan)}
          </text>
        ))}

        {/* hover crosshair */}
        {hp && (
          <g>
            <line x1={x(hp.t)} y1={PAD.top} x2={x(hp.t)} y2={PAD.top + plotH}
              stroke="var(--border-2)" strokeWidth={0.8} />
            <circle cx={x(hp.t)} cy={y(hp.value)} r={3.5} fill={lineColor} />
            {hb && <circle cx={x(hb.t)} cy={y(hb.value)} r={3} fill="var(--text-dim)" />}
          </g>
        )}
      </svg>

      {/* return badge */}
      <div style={{
        position: "absolute", top: 0, right: 8,
        fontSize: 12, fontFamily: "'DM Mono', monospace",
        color: up ? "var(--green)" : "var(--red)",
      }}>
        {up ? "+" : ""}{totalReturn.toFixed(2)}%
      </div>

      {/* hover tooltip — follows the cursor, flips left near the right edge */}
      {hp && (() => {
        const frac = x(hp.t) / VB_W;                 // 0..1 across the plot
        const intraday = (t1 - t0) < 3 * 24 * 3600 * 1000;
        const when = intraday
          ? new Date(hp.t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
          : fmtDate(hp.t);
        const flip = frac > 0.62;
        return (
          <div style={{
            position: "absolute", top: 8,
            left: `${frac * 100}%`,
            transform: `translateX(${flip ? "calc(-100% - 10px)" : "10px"})`,
            background: "var(--surface-2)", border: "1px solid var(--border-2)",
            padding: "8px 12px", fontSize: 10, fontFamily: "'DM Mono', monospace",
            color: "var(--text)", pointerEvents: "none", lineHeight: 1.6, zIndex: 2,
            whiteSpace: "nowrap",
          }}>
            <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>{when}</div>
            <div><span style={{ color: "var(--accent)" }}>●</span> Portfolio: {fmtMoney(hp.value)}</div>
            {hb && <div><span style={{ color: "var(--text-dim)" }}>●</span> {benchmarkLabel}: {fmtMoney(hb.value)}</div>}
          </div>
        );
      })()}
    </div>
  );
}
