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
  const W = 400;
  const H = 80;
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
  const labelPositions = [4, W / 2 - 24, W - 42];

  return (
    <div className="panel-box">
      <div className="panel-label">Stock Price / Quarter</div>

      <div style={{ height: 80, marginBottom: 12 }}>
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

          {[20, 40, 60].map((y) => (
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

          <line
            x1={peak.x}
            y1={peak.y}
            x2={peak.x}
            y2="2"
            stroke="#3ddc84"
            strokeWidth="1"
            strokeDasharray="3,3"
          />
          <circle cx={peak.x} cy={peak.y} r="3.5" fill="#3ddc84" />
          <text
            x={peak.x + 5}
            y="10"
            fill="#3ddc84"
            fontFamily="DM Mono, monospace"
            fontSize="8"
          >
            {peakLabel}
          </text>

          {labels.slice(0, 3).map((lbl, i) => (
            <text
              key={`${lbl}-${i}`}
              x={labelPositions[i]}
              y={H + 12}
              fill="#555550"
              fontFamily="DM Mono, monospace"
              fontSize="7"
            >
              {lbl}
            </text>
          ))}
        </svg>
      </div>

      <div style={{ display: "flex", gap: 20, fontSize: 10, color: "var(--text-muted)", marginTop: 18, flexWrap: "wrap" }}>
        <span>
          Start: <span style={{ color: "var(--text)" }}>{fmtUsd(startPrice)}</span>
        </span>
        <span>
          End: <span style={{ color: "var(--text)" }}>{fmtUsd(endPrice)}</span>
        </span>
        <span>
          High/Low: <span style={{ color: "var(--green)" }}>{fmtUsd(highPrice)}</span> / <span style={{ color: "var(--red)" }}>{fmtUsd(lowPrice)}</span>
        </span>
        <span>
          Δ Price: <span style={{ color: deltaPrice >= 0 ? "var(--green)" : "var(--red)" }}>
            {deltaPrice >= 0 ? "+" : ""}{deltaPrice.toFixed(2)}%
          </span>
        </span>
      </div>
    </div>
  );
}
