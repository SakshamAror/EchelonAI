// READ instructions.txt before editing this file.
// Quarterly stock-price chart (Yahoo Finance) for the selected quarter.

import type { ForumChartData } from "@/types";

interface Props { data: ForumChartData; error?: string }

function fmtUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${value.toFixed(2)}`;
}

function fmtPct(value: number, showSign = true): string {
  const sign = showSign && value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export default function ForumChart({ data, error }: Props) {
  if (error) {
    return (
      <div className="panel-box">
        <div className="panel-label">Stock Price / Quarter</div>
        <div style={{
          padding: 14,
          border: "1px solid var(--red)",
          background: "rgba(255,76,76,0.06)",
          color: "var(--red)",
          fontSize: 12,
          lineHeight: 1.6,
        }}>
          {error}
        </div>
      </div>
    );
  }

  const {
    points, labels, peakIndex, peakLabel,
    deltaPrice, startPrice, endPrice, highPrice, lowPrice,
    benchmarkPoints, benchmarkDelta,
  } = data;

  const W = 600;
  const H = 160;
  const n = points.length;
  const denom = Math.max(n - 1, 1);

  // Direction-aware stock line color
  const isUp = deltaPrice >= 0;
  const stockColor = isUp ? "var(--green)" : "var(--red)";
  const stockColorHex = isUp ? "#3ddc84" : "#ff4c4c";
  const gradStopColor = isUp ? "#3ddc84" : "#ff4c4c";

  const pts = points.map((v, i) => ({
    x: (i / denom) * W,
    y: H - (v / 100) * H,
  }));

  const polyline = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const fillPath =
    `M${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L")}` +
    ` L${W},${H} L0,${H} Z`;

  // Benchmark (S&P 500) polyline
  const hasBenchmark = Array.isArray(benchmarkPoints) && benchmarkPoints.length >= 2;
  const bDenom = hasBenchmark ? Math.max((benchmarkPoints!.length - 1), 1) : 1;
  const bPolyline = hasBenchmark
    ? benchmarkPoints!.map((v, i) => `${((i / bDenom) * W).toFixed(1)},${(H - (v / 100) * H).toFixed(1)}`).join(" ")
    : "";

  const clampedPeakIndex = Math.max(0, Math.min(pts.length - 1, peakIndex));
  const peak = pts[clampedPeakIndex] ?? { x: 0, y: H };
  const peakPct = `${((peak.x / W) * 100).toFixed(2)}%`;
  const peakTopPct = `${((peak.y / H) * 100).toFixed(2)}%`;

  // vs-benchmark verdict
  const hasBDelta = typeof benchmarkDelta === "number" && Number.isFinite(benchmarkDelta);
  const spread = hasBDelta ? deltaPrice - benchmarkDelta! : null;
  let verdict = "";
  let verdictColor = "var(--text-muted)";
  if (spread !== null) {
    if (spread > 2) { verdict = "OUTPERFORMING S&P 500"; verdictColor = "var(--green)"; }
    else if (spread < -2) { verdict = "UNDERPERFORMING S&P 500"; verdictColor = "var(--red)"; }
    else { verdict = "IN LINE WITH S&P 500"; verdictColor = "var(--accent)"; }
  }

  const deltaColor = isUp ? "var(--green)" : "var(--red)";

  return (
    <div className="panel-box">
      <div className="panel-label">Stock Price / Quarter</div>

      {/* ── Price change + vs-benchmark header ─────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        borderLeft: `4px solid ${deltaColor}`,
        paddingLeft: 16,
        marginBottom: 20,
        gap: 12,
      }}>
        <div>
          <p style={{ fontSize: 9, letterSpacing: "0.25em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>
            Quarterly Price Change
          </p>
          <p className="font-bebas" style={{ fontSize: 56, lineHeight: 1, color: deltaColor, letterSpacing: "0px" }}>
            {fmtPct(deltaPrice)}
          </p>
          {/* vs-S&P row */}
          {spread !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: verdictColor }}>
                {verdict}
              </span>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                {spread > 0 ? "+" : ""}{spread.toFixed(1)}pp vs S&P ({fmtPct(benchmarkDelta!)})
              </span>
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.8, flexShrink: 0 }}>
          <div>High <span style={{ color: "var(--green)", marginLeft: 6 }}>{fmtUsd(highPrice)}</span></div>
          <div>Low <span style={{ color: "var(--red)", marginLeft: 6 }}>{fmtUsd(lowPrice)}</span></div>
          <div style={{ fontSize: 10, marginTop: 4 }}>
            {fmtUsd(startPrice)} <span style={{ color: "var(--text-dim)" }}>→</span> {fmtUsd(endPrice)}
          </div>
        </div>
      </div>

      {/* ── Chart ───────────────────────────────────────────────── */}
      <div style={{ position: "relative", marginBottom: 28 }}>
        <div style={{ height: 160 }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: "100%", height: "100%", overflow: "visible" }}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={gradStopColor} stopOpacity="0.24" />
                <stop offset="100%" stopColor={gradStopColor} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {[40, 80, 120].map((y) => (
              <line key={y} x1="0" y1={y} x2={W} y2={y} stroke="#222" strokeWidth="1" />
            ))}

            {/* Midline (performance baseline) */}
            <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="#444" strokeWidth="0.75" strokeDasharray="4,4" />

            {/* Fill under stock line */}
            <path d={fillPath} fill="url(#priceGrad)" />

            {/* S&P 500 benchmark line */}
            {hasBenchmark && (
              <polyline
                points={bPolyline}
                fill="none"
                stroke="#f5a623"
                strokeWidth="1.2"
                strokeDasharray="5,4"
                strokeOpacity="0.65"
                strokeLinejoin="round"
              />
            )}

            {/* Stock price line */}
            <polyline
              points={polyline}
              fill="none"
              stroke={stockColorHex}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />

            {/* Peak dashed vertical + dot */}
            <line
              x1={peak.x} y1={peak.y}
              x2={peak.x} y2="2"
              stroke={stockColorHex} strokeWidth="1" strokeDasharray="3,3"
            />
            <circle cx={peak.x} cy={peak.y} r="3.5" fill={stockColorHex} />
          </svg>
        </div>

        {/* Peak label — HTML overlay */}
        <div style={{
          position: "absolute",
          left: peakPct,
          top: peakTopPct,
          transform: "translate(-50%, -140%)",
          fontSize: 10,
          color: stockColor,
          fontFamily: "'DM Mono', monospace",
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}>
          {peakLabel}
        </div>

        {/* X-axis labels */}
        <div style={{
          position: "absolute",
          bottom: -20,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "space-between",
          pointerEvents: "none",
        }}>
          {labels.slice(0, 3).map((lbl, i) => (
            <span key={`${lbl}-${i}`} style={{
              fontSize: 10,
              color: "var(--text-dim)",
              fontFamily: "'DM Mono', monospace",
            }}>
              {lbl}
            </span>
          ))}
        </div>
      </div>

      {/* ── Legend ──────────────────────────────────────────────── */}
      {hasBenchmark && (
        <div style={{ display: "flex", gap: 20, marginTop: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke={stockColorHex} strokeWidth="2" /></svg>
            <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.06em" }}>Stock</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke="#f5a623" strokeWidth="1.5" strokeDasharray="4,3" /></svg>
            <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.06em" }}>S&P 500</span>
          </div>
        </div>
      )}
    </div>
  );
}
