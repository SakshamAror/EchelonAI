// READ instructions.txt before editing this file.
// NEW component — Forum Attention / Price sparkline chart.
// Receives ForumChartData from AnalysisResult.forumChart.
// Do NOT put chart logic in ResultsPanel — keep it here.

import type { ForumChartData } from "@/types";

interface Props { data: ForumChartData }

export default function ForumChart({ data }: Props) {
  const { points, labels, peakIndex, peakLabel, deltaForum, deltaPrice } = data;
  const W = 400, H = 80;
  const n = points.length;

  const pts = points.map((v, i) => ({
    x: (i / (n - 1)) * W,
    y: H - (v / 100) * H,
  }));

  const polyline = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const fillPath =
    `M${pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L")}` +
    ` L${W},${H} L0,${H} Z`;

  const peak = pts[peakIndex];
  const labelPositions = [4, W / 2 - 20, W - 34];

  return (
    <div className="panel-box">
      <div className="panel-label">Forum Attention / Price</div>

      {/* SVG chart */}
      <div style={{ height: 80, marginBottom: 12 }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", height: "100%", overflow: "visible" }}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="forumGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#f5a623" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#f5a623" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid */}
          {[20, 40, 60].map(y => (
            <line key={y} x1="0" y1={y} x2={W} y2={y} stroke="#222" strokeWidth="1" />
          ))}

          {/* Area fill */}
          <path d={fillPath} fill="url(#forumGrad)" />

          {/* Line */}
          <polyline
            points={polyline}
            fill="none"
            stroke="#f5a623"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />

          {/* Peak dot + dashed line + label */}
          <line
            x1={peak.x} y1={peak.y}
            x2={peak.x} y2="2"
            stroke="#f5a623" strokeWidth="1" strokeDasharray="3,3"
          />
          <circle cx={peak.x} cy={peak.y} r="3.5" fill="#f5a623" />
          <text
            x={peak.x + 5} y="10"
            fill="#f5a623"
            fontFamily="DM Mono, monospace"
            fontSize="8"
          >
            {peakLabel}
          </text>

          {/* X-axis labels */}
          {labels.map((lbl, i) => (
            <text
              key={lbl}
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

      {/* Stats row */}
      <div style={{ display: "flex", gap: 20, fontSize: 10, color: "var(--text-muted)", marginTop: 18 }}>
        <span>
          Peak:{" "}
          <span style={{ color: "var(--accent)" }}>{peakLabel}</span>
        </span>
        <span>
          Δ Forum:{" "}
          <span style={{ color: deltaForum >= 0 ? "var(--green)" : "var(--red)" }}>
            {deltaForum >= 0 ? "+" : ""}{deltaForum}%
          </span>
        </span>
        <span>
          Δ Price:{" "}
          <span style={{ color: deltaPrice >= 0 ? "var(--green)" : "var(--red)" }}>
            {deltaPrice >= 0 ? "+" : ""}{deltaPrice}%
          </span>
        </span>
      </div>
    </div>
  );
}
