// READ instructions.txt before editing this file.
// Financial Metrics panel — yfinance data.
// Includes EPS/Revenue surprise cards, rule-of-thumb callout, and metric grid.
// To add a metric: update FinancialMetrics in types/index.ts first.

import type { FinancialMetrics } from "@/types";

interface Props { metrics: FinancialMetrics; periodLabel: string }

function fmt(val: number | null, f: (v: number) => string, fallback = "—") {
  return val == null ? fallback : f(val);
}
function pct(v: number) { return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`; }

const insiderColor: Record<string, string> = {
  "heavy buying":  "var(--green)",
  "light buying":  "var(--green)",
  "neutral":       "var(--text-muted)",
  "light selling": "var(--accent)",
  "heavy selling": "var(--red)",
};

function MetricCell({ label, value, delta, color, highlight }: {
  label: string; value: string; delta?: string;
  color?: string; highlight?: "green" | "red";
}) {
  const bc = highlight === "green" ? "#3ddc8433" : highlight === "red" ? "#ff4c4c33" : "var(--border)";
  const bg = highlight === "green" ? "rgba(61,220,132,0.04)" : highlight === "red" ? "rgba(255,76,76,0.04)" : "var(--bg)";
  return (
    <div style={{ padding: 14, border: `1px solid ${bc}`, background: bg, position: "relative" }}>
      {highlight && (
        <span style={{ position: "absolute", top: 8, right: 10, fontSize: 8, letterSpacing: "0.08em",
          color: highlight === "green" ? "#3ddc8466" : "#ff4c4c66", textTransform: "uppercase" }}>
          Earnings Signal
        </span>
      )}
      <p style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>
        {label}
      </p>
      <p className="font-bebas" style={{ fontSize: 22, letterSpacing: "0.04em", color: color ?? "var(--text)" }}>
        {value}
      </p>
      {delta && <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{delta}</p>}
    </div>
  );
}

export default function MetricsPanel({ metrics, periodLabel }: Props) {
  const epsC = metrics.epsSurprisePercent == null ? "var(--text)"
    : metrics.epsSurprisePercent > 0 ? "var(--green)" : "var(--red)";
  const revC = metrics.revenueSurprisePercent == null ? "var(--text)"
    : metrics.revenueSurprisePercent > 0 ? "var(--green)" : "var(--red)";
  const epsH = metrics.epsSurprisePercent  != null
    ? (metrics.epsSurprisePercent  > 0 ? "green" : "red") as "green" | "red" : undefined;
  const revH = metrics.revenueSurprisePercent != null
    ? (metrics.revenueSurprisePercent > 0 ? "green" : "red") as "green" | "red" : undefined;

  const analystStr = metrics.analystBreakdown
    ? `${metrics.analystBreakdown.buy}B / ${metrics.analystBreakdown.hold}H / ${metrics.analystBreakdown.sell}S`
    : "—";

  return (
    <div className="panel-box fade-up fade-up-3">
      <div className="panel-label">Financial Metrics — {periodLabel}</div>

      {/* Earnings surprise row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <MetricCell label="EPS Surprise"
          value={fmt(metrics.epsSurprisePercent, v => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`)}
          delta={metrics.epsSurprisePercent != null
            ? metrics.epsSurprisePercent > 0 ? "Beat analyst estimate" : "Missed analyst estimate"
            : undefined}
          color={epsC} highlight={epsH} />
        <MetricCell label="Revenue Surprise"
          value={fmt(metrics.revenueSurprisePercent, v => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`)}
          delta={metrics.revenueSurprisePercent != null
            ? metrics.revenueSurprisePercent > 0 ? "Beat analyst estimate" : "Missed analyst estimate"
            : undefined}
          color={revC} highlight={revH} />
      </div>

      {/* Rule of thumb */}
      <div style={{ padding: "10px 14px", border: "1px dashed #333", marginBottom: 12,
        fontSize: 11, color: "var(--text-muted)", lineHeight: 1.65 }}>
        <span style={{ color: "var(--accent)" }}>Rule of thumb:</span>{" "}
        EPS/Revenue above <span style={{ color: "var(--green)" }}>+3%</span> is bullish.
        Below <span style={{ color: "var(--red)" }}>−3%</span> is bearish.
        Market reacts to the <em>gap</em>, not the absolute number.
      </div>

      {/* Metric grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <MetricCell label="P/E Ratio"
          value={fmt(metrics.peRatio, v => `${v.toFixed(1)}×`)}
          delta="vs. sector avg" color="var(--text)" />
        <MetricCell label="Revenue Growth QoQ"
          value={fmt(metrics.revenueGrowthQoQ, v => pct(v * 100))}
          color={metrics.revenueGrowthQoQ == null ? "var(--text)"
            : metrics.revenueGrowthQoQ >= 0 ? "var(--green)" : "var(--red)"} />
        <MetricCell label="Dividend Change"
          value={metrics.dividendChangePercent == null ? "N/A" : pct(metrics.dividendChangePercent)}
          delta={metrics.dividendChangePercent == null ? "No dividend" : "vs. prior period"}
          color={metrics.dividendChangePercent == null ? "var(--text-muted)"
            : metrics.dividendChangePercent > 0 ? "var(--green)" : "var(--text)"} />
        <MetricCell label="FCF Change QoQ"
          value={fmt(metrics.fcfChangeQoQ, pct)}
          delta="Real cash health signal"
          color={metrics.fcfChangeQoQ == null ? "var(--text)"
            : metrics.fcfChangeQoQ >= 0 ? "var(--green)" : "var(--red)"} />
        <MetricCell label="Short Interest"
          value={fmt(metrics.shortInterestPercent, v => `${v.toFixed(1)}%`)}
          color={metrics.shortInterestPercent != null && metrics.shortInterestPercent > 4
            ? "var(--red)" : "var(--text)"} />
        <MetricCell label="Analyst Breakdown" value={analystStr} color="var(--text-muted)" />
        <div style={{ gridColumn: "1/-1" }}>
          <MetricCell label="Insider Activity"
            value={metrics.insiderTradingActivity ?? "—"}
            color={metrics.insiderTradingActivity
              ? insiderColor[metrics.insiderTradingActivity] : "var(--text)"} />
        </div>
      </div>
    </div>
  );
}
