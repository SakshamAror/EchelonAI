import { useRef, useState } from "react";

export interface EquityPoint {
  t: number;      // epoch ms
  value: number;  // portfolio value in USD
}

export interface SeriesLine {
  id: string;
  label: string;
  color: string;
  points: EquityPoint[];
  dashed?: boolean;
}

interface Props {
  portfolio?: EquityPoint[];
  benchmark?: EquityPoint[];   // e.g. SPY, rebased to portfolio start
  benchmarkLabel?: string;
  height?: number;
  emptyMessage?: string;
  loading?: boolean;           // show animated shimmer skeleton while building
  logScale?: boolean;          // log y-axis (advanced mode only)
  series?: SeriesLine[];       // multi-series overlay mode (e.g. profile comparison) — overrides portfolio/benchmark
  valueFormat?: "money" | "percent"; // axis + tooltip formatting; default "money"
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

function fmtPercent(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function fmtAxisPercent(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
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

// Log-scale gridlines: 1/2/5 × 10^n within [min, max] (min must be > 0)
function logTicks(min: number, max: number): number[] {
  const lo = Math.floor(Math.log10(min));
  const hi = Math.ceil(Math.log10(max));
  const ticks: number[] = [];
  for (let e = lo; e <= hi; e++) {
    for (const m of [1, 2, 5]) {
      const v = m * Math.pow(10, e);
      if (v >= min && v <= max) ticks.push(v);
    }
  }
  return ticks;
}

// Binary search for the point nearest a given time
function nearestIdx(pts: EquityPoint[], tGuess: number): number {
  let lo = 0, hi = pts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].t < tGuess) lo = mid + 1; else hi = mid;
  }
  return lo;
}

function MultiSeriesChart({
  series, height, emptyMessage, logScale, valueFormat,
}: { series: SeriesLine[]; height: number; emptyMessage: string; logScale: boolean; valueFormat: "money" | "percent" }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverT, setHoverT] = useState<number | null>(null);

  const VB_H = height;
  const plotW = VB_W - PAD.left - PAD.right;
  const plotH = VB_H - PAD.top - PAD.bottom;

  const usable = series.filter(s => s.points.length >= 2);
  if (usable.length === 0) {
    return (
      <div style={{
        height, display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--text-dim)", fontSize: 11, letterSpacing: "0.08em",
      }}>
        {emptyMessage}
      </div>
    );
  }

  const fmtVal = valueFormat === "percent" ? fmtPercent : fmtMoney;
  const fmtAxisVal = valueFormat === "percent" ? fmtAxisPercent : fmtAxisMoney;

  const allValues = usable.flatMap(s => s.points.map(p => p.value));
  const minV = Math.min(...allValues);
  const maxV = Math.max(...allValues);
  const logSafeMin = Math.max(minV, maxV * 1e-6, 1e-9);
  const range = maxV - minV || 1;
  const pad = range * 0.08;
  const yMin = logScale ? logSafeMin / 1.08 : minV - pad;
  const yMax = logScale ? maxV * 1.08 : maxV + pad;

  const t0 = Math.min(...usable.map(s => s.points[0].t));
  const t1 = Math.max(...usable.map(s => s.points[s.points.length - 1].t));
  const tSpan = t1 - t0 || 1;

  const x = (t: number) => PAD.left + ((t - t0) / tSpan) * plotW;
  const y = (v: number) => {
    if (logScale) {
      const vv = Math.max(v, yMin);
      const frac = (Math.log10(vv) - Math.log10(yMin)) / (Math.log10(yMax) - Math.log10(yMin));
      return PAD.top + (1 - frac) * plotH;
    }
    return PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;
  };
  const pathFor = (pts: EquityPoint[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");

  const gridVals = logScale
    ? logTicks(yMin, yMax)
    : niceTicks(minV, maxV, 4).filter(v => v >= yMin && v <= yMax);

  const xTickN = 6;
  const xTicks = Array.from({ length: xTickN + 1 }, (_, i) => t0 + (tSpan * i) / xTickN);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * VB_W;
    setHoverT(t0 + ((relX - PAD.left) / plotW) * tSpan);
  }

  const hoverPoints = hoverT != null
    ? usable.map(s => ({ s, p: s.points[Math.min(nearestIdx(s.points, hoverT), s.points.length - 1)] }))
    : null;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {/* legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 8 }}>
        {usable.map(s => {
          const first = s.points[0].value, last = s.points[s.points.length - 1].value;
          const ret = valueFormat === "percent" ? last - first : (last / first - 1) * 100;
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontFamily: "'DM Mono', monospace" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
              <span style={{ color: "var(--text-muted)" }}>{s.label}</span>
              <span style={{ color: ret >= 0 ? "var(--green)" : "var(--red)" }}>{fmtPercent(ret)}</span>
            </div>
          );
        })}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverT(null)}
        style={{ display: "block", overflow: "visible" }}
      >
        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={y(v)} x2={VB_W - PAD.right} y2={y(v)}
              stroke="var(--border-2)" strokeWidth={0.5} opacity={0.45} />
            <text x={VB_W - PAD.right + 8} y={y(v) + 3} textAnchor="start"
              fill="var(--text-dim)" fontSize={11} fontFamily="'DM Mono', monospace">
              {fmtAxisVal(v)}
            </text>
          </g>
        ))}

        {xTicks.map((t, i) => (
          <line key={i} x1={x(t)} y1={PAD.top} x2={x(t)} y2={PAD.top + plotH}
            stroke="var(--border-2)" strokeWidth={0.5} opacity={0.45} />
        ))}

        {usable.map(s => (
          <path key={s.id} d={pathFor(s.points)} fill="none" stroke={s.color}
            strokeWidth={s.dashed ? 1.2 : 1.8} strokeDasharray={s.dashed ? "4 4" : undefined}
            opacity={s.dashed ? 0.7 : 1} />
        ))}

        {xTicks.map((t, i) => (
          <text key={i} x={x(t)} y={VB_H - 8}
            textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
            fill="var(--text-dim)" fontSize={11} fontFamily="'DM Mono', monospace">
            {fmtAxisTime(t, tSpan)}
          </text>
        ))}

        {hoverPoints && (
          <g>
            <line x1={x(hoverT!)} y1={PAD.top} x2={x(hoverT!)} y2={PAD.top + plotH}
              stroke="var(--border-2)" strokeWidth={0.8} />
            {hoverPoints.map(({ s, p }) => (
              <circle key={s.id} cx={x(p.t)} cy={y(p.value)} r={3} fill={s.color} />
            ))}
          </g>
        )}
      </svg>

      {hoverPoints && (() => {
        const frac = x(hoverT!) / VB_W;
        const intraday = (t1 - t0) < 3 * 24 * 3600 * 1000;
        const when = intraday
          ? new Date(hoverT!).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
          : fmtDate(hoverT!);
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
            {hoverPoints.map(({ s, p }) => (
              <div key={s.id}><span style={{ color: s.color }}>●</span> {s.label}: {fmtVal(p.value)}</div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

export default function EquityCurve({
  portfolio,
  benchmark,
  benchmarkLabel = "SPY",
  height = 340,
  emptyMessage = "No data available.",
  loading = false,
  logScale = false,
  series,
  valueFormat = "money",
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const VB_H = height;
  const plotW = VB_W - PAD.left - PAD.right;
  const plotH = VB_H - PAD.top - PAD.bottom;

  // While building, always show the skeleton (never the stale curve)
  if (loading) return <ChartSkeleton height={height} />;

  // Multi-series overlay mode (e.g. profile comparison) — fully separate render path
  if (series) {
    return <MultiSeriesChart series={series} height={height} emptyMessage={emptyMessage} logScale={logScale} valueFormat={valueFormat} />;
  }

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
  const pf = portfolio; // narrowed non-null past the guard above, for use inside closures below

  // Rebase benchmark to portfolio's starting value
  const rebased: EquityPoint[] | undefined = benchmark && benchmark.length >= 2
    ? benchmark.map(b => ({ t: b.t, value: portfolio[0].value * (b.value / benchmark[0].value) }))
    : undefined;

  const allValues = [...portfolio.map(p => p.value), ...(rebased?.map(b => b.value) ?? [])];
  const minV = Math.min(...allValues);
  const maxV = Math.max(...allValues);

  // Log scale needs a strictly positive domain — fall back to a tiny positive floor
  // if the series dips to zero/negative (e.g. margin debt) rather than breaking.
  const logSafeMin = Math.max(minV, maxV * 1e-6, 1e-9);
  const range = maxV - minV || 1;
  const pad = range * 0.08;
  const yMin = logScale ? logSafeMin / 1.08 : minV - pad;
  const yMax = logScale ? maxV * 1.08 : maxV + pad;

  const t0 = portfolio[0].t;
  const t1 = portfolio[portfolio.length - 1].t;
  const tSpan = t1 - t0 || 1;

  const x = (t: number) => PAD.left + ((t - t0) / tSpan) * plotW;
  const y = (v: number) => {
    if (logScale) {
      const vv = Math.max(v, yMin);
      const frac = (Math.log10(vv) - Math.log10(yMin)) / (Math.log10(yMax) - Math.log10(yMin));
      return PAD.top + (1 - frac) * plotH;
    }
    return PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;
  };

  const pathFor = (pts: EquityPoint[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");

  const portfolioPath = pathFor(portfolio);
  const areaPath = `${portfolioPath} L${x(t1).toFixed(1)},${y(yMin).toFixed(1)} L${x(t0).toFixed(1)},${y(yMin).toFixed(1)} Z`;

  // Y gridlines: log-spaced (1/2/5 × 10^n) or round linear values, within the visible range
  const gridVals = logScale
    ? logTicks(yMin, yMax)
    : niceTicks(minV, maxV, 4).filter(v => v >= yMin && v <= yMax);

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
    setHoverIdx(nearestIdx(pf, tGuess));
  }

  const hp = hoverIdx != null ? pf[hoverIdx] : null;
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
              stroke="var(--border-2)" strokeWidth={0.5} opacity={0.45} />
            <text x={VB_W - PAD.right + 8} y={y(v) + 3} textAnchor="start"
              fill="var(--text-dim)" fontSize={11} fontFamily="'DM Mono', monospace">
              {fmtAxisMoney(v)}
            </text>
          </g>
        ))}

        {/* vertical gridlines at the x-axis time ticks */}
        {xTicks.map((t, i) => (
          <line key={i} x1={x(t)} y1={PAD.top} x2={x(t)} y2={PAD.top + plotH}
            stroke="var(--border-2)" strokeWidth={0.5} opacity={0.45} />
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
