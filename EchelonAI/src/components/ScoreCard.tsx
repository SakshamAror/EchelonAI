// READ instructions.txt before editing this file.
// Alpha Score header — Bebas Neue big number, directional arrow, score bars.
// Do NOT use "prediction" language. We explain movement, not forecast it.

import type { AnalysisResult } from "@/types";

interface Props { result: AnalysisResult; error?: string }

function fmtTF({ quarter, year }: { quarter: number; year: number }) {
  return `Q${quarter} ${year}`;
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
      <span style={{ fontSize: 12, color: "var(--text)", width: 36, textAlign: "right" }}>{value.toFixed(1)}</span>
    </div>
  );
}

const dirConfig = {
  up:   { arrow: "↑", color: "var(--green)" },
  down: { arrow: "↓", color: "var(--red)"   },
  flat: { arrow: "→", color: "var(--accent)" },
};

export default function ScoreCard({ result, error }: Props) {
  if (error) {
    return (
      <div className="panel-box fade-up fade-up-1">
        <div className="panel-label">Echelon Score</div>
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

  const dir = dirConfig[result.direction];

  return (
    <div className="panel-box fade-up fade-up-1">
      <div className="panel-label">Echelon Score</div>

      {/* Watermark */}
      <span style={{
        position: "absolute", top: 14, right: 18,
        fontSize: 9, letterSpacing: "0.3em", color: "var(--text-dim)",
        textTransform: "uppercase",
      }}>
        {result.ticker} / {fmtTF(result.timeframe).toUpperCase()}
      </span>

      {/* Main layout */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "auto auto 1fr",
        alignItems: "center",
        gap: 32,
      }}>
        {/* Big score number */}
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 9, letterSpacing: "0.3em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>
            Echelon Score
          </p>
          <p className="font-bebas" style={{ fontSize: 96, lineHeight: 1, color: "var(--accent)", letterSpacing: "-2px" }}>
            {result.alphaScore.toFixed ? result.alphaScore.toFixed(0) : result.alphaScore}
          </p>
          <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
            {result.alphaScore >= 70 ? "Elevated Signal" : result.alphaScore >= 45 ? "Mixed Signal" : "Weak Signal"}
          </p>
        </div>

        {/* Directional arrow */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <p className="font-bebas" style={{ fontSize: 64, lineHeight: 1, color: dir.color, margin: 0 }}>
            {dir.arrow}
          </p>
          <span style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--text-muted)", textTransform: "uppercase" }}>
            Price Δ
          </span>
        </div>

        {/* Score bars */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <ScoreBarRow label="Cultural Score"   value={result.culturalScore}   color="var(--purple)" />
          <ScoreBarRow label="Financial Score"  value={result.financialScore}  color="var(--green)"  />
        </div>
      </div>

      {/* Score methodology dropdown */}
      <details style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
        <summary style={{
          cursor: "pointer",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--accent)",
          userSelect: "none",
        }}>
          How scores are calculated
        </summary>
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            {
              label: "Financial Score (55% of Echelon)",
              color: "var(--green)",
              desc: "Weighted blend of P/E, PEG, ROE, ROA, profit margins, debt/equity, current ratio, and growth rates. Metrics that indicate strength (high ROE, strong margins, low leverage) push the score above 50; weakness pushes it below.",
            },
            {
              label: "Cultural Score (30% of Echelon)",
              color: "var(--purple)",
              desc: "Sentiment of news articles fetched via Tavily, weighted by outlet traffic (Reuters, Bloomberg, CNBC, etc. rank higher). Positive/negative article sentiment shifts the score from the 50-point baseline. Article count and relevance provide an additional coverage boost.",
            },
            {
              label: "Echelon Score",
              color: "var(--accent)",
              desc: "Composite of financial fundamentals, cultural sentiment, and media momentum. Reflects the overall quality of combined signals for the selected stock and quarter.",
            },
          ].map((row, i) => (
            <div key={i} style={{ borderLeft: `3px solid ${row.color}`, paddingLeft: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: row.color, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
                {row.label}
              </p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
                {row.desc}
              </p>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
