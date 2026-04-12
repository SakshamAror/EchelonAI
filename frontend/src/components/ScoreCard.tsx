// READ instructions.txt before editing this file.
// Alpha Score header — Bebas Neue big number, directional arrow, score bars.
// Do NOT use "prediction" language. We explain movement, not forecast it.

import type { AnalysisResult } from "@/types";

interface Props { result: AnalysisResult }

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtTF({ month, year }: { month: number; year: number }) {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function ScoreBarRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <span style={{ fontSize: 10, letterSpacing: "0.05em", color: "var(--text-muted)", width: 120, flexShrink: 0, textTransform: "uppercase" }}>
        {label}
      </span>
      <div className="score-bar-track">
        <div className="score-bar-fill" style={{ width: `${value}%`, background: color }} />
      </div>
      <span style={{ fontSize: 12, color: "var(--text)", width: 28, textAlign: "right" }}>{value}</span>
    </div>
  );
}

const dirConfig = {
  up:   { arrow: "↑", color: "var(--green)" },
  down: { arrow: "↓", color: "var(--red)"   },
  flat: { arrow: "→", color: "var(--accent)" },
};

export default function ScoreCard({ result }: Props) {
  const dir = dirConfig[result.direction];

  return (
    <div
      className="panel-box fade-up fade-up-1"
      style={{
        display: "grid",
        gridTemplateColumns: "auto auto 1fr",
        alignItems: "center",
        gap: 32,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Watermark label */}
      <span style={{
        position: "absolute", top: 14, right: 18,
        fontSize: 9, letterSpacing: "0.3em", color: "var(--text-dim)",
        textTransform: "uppercase",
      }}>
        {result.ticker} / {fmtTF(result.timeframe).toUpperCase()}
      </span>

      {/* Big score number */}
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 9, letterSpacing: "0.3em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>
          Forum Alpha Score
        </p>
        <p className="font-bebas" style={{ fontSize: 96, lineHeight: 1, color: "var(--accent)", letterSpacing: "-2px" }}>
          {result.alphaScore}
        </p>
        <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
          {result.alphaScore >= 70 ? "Elevated Signal" : result.alphaScore >= 45 ? "Mixed Signal" : "Weak Signal"}
        </p>
      </div>

      {/* Directional arrow */}
      <p className="font-bebas" style={{ fontSize: 64, lineHeight: 1, color: dir.color }}>
        {dir.arrow}
      </p>

      {/* Score bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <ScoreBarRow label="Cultural Score"   value={result.culturalScore}       color="var(--purple)" />
        <ScoreBarRow label="Financial Score"  value={result.financialScore}      color="var(--green)"  />
        <ScoreBarRow label="Forum Momentum"   value={result.forumMomentumScore}  color="var(--accent)" />
      </div>
    </div>
  );
}
