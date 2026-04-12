// READ instructions.txt before editing this file.
// Alpha Score + Cultural + Financial score display.
// Do NOT use "prediction" language anywhere — we explain movement, not forecast.

import type { AnalysisResult } from "@/types";

interface Props { result: AnalysisResult; }

const dirConfig = {
  up:   { symbol: "↑", label: "MOVED UP",   color: "var(--green)" },
  down: { symbol: "↓", label: "MOVED DOWN", color: "var(--red)"   },
  flat: { symbol: "→", label: "FLAT",        color: "var(--accent)" },
};

function scoreColor(n: number) {
  if (n >= 65) return "var(--green)";
  if (n >= 40) return "var(--accent)";
  return "var(--red)";
}

function Bar({ value }: { value: number }) {
  return (
    <div style={{ height: 3, background: "var(--border)", marginTop: 6 }}>
      <div
        style={{
          height: "100%",
          width: `${value}%`,
          background: scoreColor(value),
          transition: "width 0.8s ease",
        }}
      />
    </div>
  );
}

export default function ScoreCard({ result }: Props) {
  const dir = dirConfig[result.direction];

  return (
    <div
      className="mt-8 border"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      {/* Top bar: ticker + direction */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <span className="font-display font-bold text-xl tracking-wider" style={{ color: "var(--text)" }}>
            {result.ticker}
          </span>
          <span className="font-mono text-[10px] tracking-widest" style={{ color: "var(--text-muted)" }}>
            {result.companyName.toUpperCase()} / {result.timeframe.quarter} {result.timeframe.year}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-lg" style={{ color: dir.color }}>
            {dir.symbol}
          </span>
          <span className="font-mono text-[10px] tracking-widest" style={{ color: dir.color }}>
            {dir.label}
          </span>
          <span className="font-mono font-bold text-sm" style={{ color: dir.color }}>
            {result.metrics.priceChangePercent > 0 ? "+" : ""}
            {result.metrics.priceChangePercent.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Score section */}
      <div className="p-4">
        <p className="font-mono text-[9px] tracking-[0.25em] mb-4" style={{ color: "var(--text-muted)" }}>
          FORUM ALPHA SCORE
        </p>

        {/* Big Alpha Score */}
        <div className="flex items-end gap-4 mb-6">
          <span
            className="font-display font-bold leading-none"
            style={{ fontSize: "clamp(3.5rem, 12vw, 5rem)", color: scoreColor(result.alphaScore) }}
          >
            {result.alphaScore}
          </span>
          <div className="pb-2">
            <p className="font-mono text-[10px] tracking-widest" style={{ color: "var(--text-muted)" }}>
              / 100
            </p>
            <p className="font-mono text-[10px]" style={{ color: "var(--text-dim)" }}>
              COMBINED SIGNAL
            </p>
          </div>
        </div>

        {/* Cultural + Financial sub-scores */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          {[
            { label: "CULTURAL SCORE",  value: result.culturalScore,  sub: "News · Social · Forum" },
            { label: "FINANCIAL SCORE", value: result.financialScore, sub: "Metrics · Filings" },
          ].map(({ label, value, sub }) => (
            <div key={label}>
              <div className="flex justify-between items-baseline">
                <span className="font-mono text-[9px] tracking-widest" style={{ color: "var(--text-muted)" }}>
                  {label}
                </span>
                <span className="font-mono font-bold text-sm" style={{ color: scoreColor(value) }}>
                  {value}
                </span>
              </div>
              <Bar value={value} />
              <p className="font-mono text-[9px] mt-1" style={{ color: "var(--text-dim)" }}>{sub}</p>
            </div>
          ))}
        </div>

        {/* Summary narrative */}
        <div
          className="border-t pt-4"
          style={{ borderColor: "var(--border)" }}
        >
          <p className="font-mono text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {result.summary}
          </p>
        </div>
      </div>
    </div>
  );
}
