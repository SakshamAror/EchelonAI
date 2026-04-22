// READ instructions.txt before editing this file.
// Alpha Score header — price delta hero, vs-S&P verdict, signal bars.
// Do NOT use "prediction" language. We explain movement, not forecast it.

import type { AnalysisResult } from "@/types";

interface Props { result: AnalysisResult; error?: string }

function fmtTF({ quarter, year }: { quarter: number; year: number }) {
  return `Q${quarter} ${year}`;
}

function fmtPct(value: number, showSign = true): string {
  const sign = showSign && value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function ScoreBarRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 9, letterSpacing: "0.05em", color: "var(--text-muted)", width: 110, flexShrink: 0, textTransform: "uppercase" }}>
        {label}
      </span>
      <div className="score-bar-track">
        <div className="score-bar-fill" style={{ width: `${value}%`, background: color }} />
      </div>
      <span style={{ fontSize: 11, color: "var(--text)", width: 34, textAlign: "right" }}>{value.toFixed(0)}</span>
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
        <div className="panel-label">Signal Overview</div>
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
  const deltaPrice = result.forumChart?.deltaPrice ?? 0;
  const benchmarkDelta = result.forumChart?.benchmarkDelta;
  const hasBDelta = typeof benchmarkDelta === "number" && Number.isFinite(benchmarkDelta);
  const spread = hasBDelta ? deltaPrice - benchmarkDelta! : null;

  let verdict = "";
  let verdictColor = "var(--text-muted)";
  if (spread !== null) {
    if (spread > 2)  { verdict = "OUTPERFORMING S&P 500"; verdictColor = "var(--green)"; }
    else if (spread < -2) { verdict = "UNDERPERFORMING S&P 500"; verdictColor = "var(--red)"; }
    else { verdict = "IN LINE WITH S&P 500"; verdictColor = "var(--accent)"; }
  }

  const priceColor = deltaPrice >= 0 ? "var(--green)" : "var(--red)";

  return (
    <div className="panel-box fade-up fade-up-1">
      <div className="panel-label">Signal Overview</div>

      {/* Ticker / period watermark */}
      <span style={{
        position: "absolute", top: 14, right: 18,
        fontSize: 9, letterSpacing: "0.3em", color: "var(--text-dim)",
        textTransform: "uppercase",
      }}>
        {result.ticker} / {fmtTF(result.timeframe).toUpperCase()}
      </span>

      {/* ── Top row: hero delta + direction + scores ─────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "auto auto 1fr",
        alignItems: "center",
        gap: 32,
      }}>

        {/* Hero: actual quarterly price change */}
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 9, letterSpacing: "0.25em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>
            Quarterly Return
          </p>
          <p className="font-bebas" style={{ fontSize: 88, lineHeight: 1, color: priceColor, letterSpacing: "-2px" }}>
            {fmtPct(deltaPrice)}
          </p>
          {/* vs-S&P verdict */}
          {spread !== null && (
            <div style={{ marginTop: 6 }}>
              <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", color: verdictColor, textTransform: "none" }}>
                {verdict}
              </p>
              <p style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>
                {spread > 0 ? "+" : ""}{spread.toFixed(1)}pp vs S&P&nbsp;({fmtPct(benchmarkDelta!)})
              </p>
            </div>
          )}
        </div>

        {/* Directional arrow */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <p className="font-bebas" style={{ fontSize: 56, lineHeight: 1, color: dir.color, margin: 0 }}>
            {dir.arrow}
          </p>
          <span style={{ fontSize: 9, letterSpacing: "0.15em", color: "var(--text-muted)", textTransform: "uppercase" }}>
            {result.direction === "up" ? "Gained" : result.direction === "down" ? "Declined" : "Flat"}
          </span>
        </div>

        {/* Score bars */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <ScoreBarRow label="Echelon Score"  value={result.alphaScore}      color="var(--accent)"  />
          <ScoreBarRow label="Cultural"       value={result.culturalScore}   color="var(--purple)"  />
          <ScoreBarRow label="Financial"      value={result.financialScore}  color="var(--green)"   />
        </div>
      </div>

      {/* ── Score methodology ────────────────────────────────────── */}
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
              label: "Financial Score (65% of Echelon)",
              color: "var(--green)",
              desc: "Weighted blend of revenue growth, earnings growth, ROE, ROA, profit margins, debt/equity, trailing P/E, and current ratio. Each metric adjusts the base score of 50 — strong fundamentals push it above, weakness pushes it below. Capped per-metric to prevent any single reading from dominating.",
            },
            {
              label: "Cultural Score (35% of Echelon)",
              color: "var(--purple)",
              desc: "Sentiment of news articles fetched via Tavily, weighted by outlet traffic (Reuters, Bloomberg, CNBC, WSJ, FT, etc. rank higher). Positive/negative article sentiment shifts the score from the 78-point baseline. A single outlet's weight is capped at 35% of total to prevent outsized influence.",
            },
            {
              label: "Echelon Score",
              color: "var(--accent)",
              desc: "Composite of financial fundamentals (65%) and cultural sentiment (35%). Reflects the overall signal quality for the selected stock and quarter — not a buy/sell recommendation.",
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
