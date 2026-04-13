// READ instructions.txt before editing this file.
// Quarterly stock-price chart (Yahoo Finance) for the selected quarter.

import type { ForumChartData } from "@/types";

interface Props { data: ForumChartData; error?: string }

function fmtUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${value.toFixed(2)}`;
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

  const { points, labels, peakIndex, peakLabel, deltaPrice, startPrice, endPrice, highPrice, lowPrice } = data;
  const W = 600;
  const H = 160;
  const n = points.length;
  const denom = Math.max(n - 1, 1);

  const pts = points.map((v, i) => ({
    x: (i / denom) * W,
    y: H - (v / 100) * H,
  }));

  const polyline = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const fillPath =
    `M${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L")}` +
    ` L${W},${H} L0,${H} Z`;

  const clampedPeakIndex = Math.max(0, Math.min(pts.length - 1, peakIndex));
  const peak = pts[clampedPeakIndex] ?? { x: 0, y: H };

  // Express peak position as % of SVG width for HTML overlay
  const peakPct = `${((peak.x / W) * 100).toFixed(2)}%`;
  const peakTopPct = `${((peak.y / H) * 100).toFixed(2)}%`;

  const isUp = deltaPrice >= 0;
  const deltaColor = isUp ? "var(--green)" : "var(--red)";

  return (
    <div className="panel-box">
      <div className="panel-label">Stock Price / Quarter</div>

      {/* ── Big full-width price change metric ─────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        borderLeft: `4px solid ${deltaColor}`,
        paddingLeft: 16,
        marginBottom: 20,
      }}>
        <div>
          <p style={{ fontSize: 9, letterSpacing: "0.25em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>
            Quarterly Price Change
          </p>
          <p className="font-bebas" style={{ fontSize: 56, lineHeight: 1, color: deltaColor, letterSpacing: "0px" }}>
            {isUp ? "+" : ""}{deltaPrice.toFixed(2)}%
          </p>
        </div>
        <div style={{ textAlign: "right", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.8 }}>
          <div>High <span style={{ color: "var(--green)", marginLeft: 6 }}>{fmtUsd(highPrice)}</span></div>
          <div>Low <span style={{ color: "var(--red)", marginLeft: 6 }}>{fmtUsd(lowPrice)}</span></div>
          <div style={{ fontSize: 10, marginTop: 4 }}>
            {fmtUsd(startPrice)} <span style={{ color: "var(--text-dim)" }}>→</span> {fmtUsd(endPrice)}
          </div>
        </div>
      </div>

      {/* ── Chart: SVG lines + HTML text overlay ───────────────── */}
      <div style={{ position: "relative", marginBottom: 28 }}>

        {/* SVG — no text nodes to avoid stretching */}
        <div style={{ height: 160 }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: "100%", height: "100%", overflow: "visible" }}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3ddc84" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#3ddc84" stopOpacity="0" />
              </linearGradient>
            </defs>

            {[40, 80, 120].map((y) => (
              <line key={y} x1="0" y1={y} x2={W} y2={y} stroke="#222" strokeWidth="1" />
            ))}

            <path d={fillPath} fill="url(#priceGrad)" />

            <polyline
              points={polyline}
              fill="none"
              stroke="#3ddc84"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />

            {/* Peak dashed vertical + dot (no text) */}
            <line
              x1={peak.x} y1={peak.y}
              x2={peak.x} y2="2"
              stroke="#3ddc84" strokeWidth="1" strokeDasharray="3,3"
            />
            <circle cx={peak.x} cy={peak.y} r="3.5" fill="#3ddc84" />
          </svg>
        </div>

        {/* Peak label — HTML overlay, not stretched by SVG transform */}
        <div style={{
          position: "absolute",
          left: peakPct,
          top: peakTopPct,
          transform: "translate(-50%, -140%)",
          fontSize: 10,
          color: "#3ddc84",
          fontFamily: "'DM Mono', monospace",
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}>
          {peakLabel}
        </div>

        {/* X-axis labels — HTML row below chart, not inside SVG */}
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
              color: "#555550",
              fontFamily: "'DM Mono', monospace",
            }}>
              {lbl}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
