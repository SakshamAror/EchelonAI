// READ instructions.txt before editing this file.
// Financial Metrics panel — Yahoo Finance only.

import type { FinancialMetrics } from "@/types";

interface Props { metrics: FinancialMetrics; periodLabel: string; error?: string }

function fmt(val: number | null, f: (v: number) => string, fallback = "—") {
  return val == null ? fallback : f(val);
}
function pct(v: number) { return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`; }
function compact(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  return `${v.toFixed(0)}`;
}

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
          Surprise Signal
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

export default function MetricsPanel({ metrics, periodLabel, error }: Props) {
  if (error) {
    return (
      <div className="panel-box fade-up fade-up-3">
        <div className="panel-label">Financial Metrics (Yahoo) — {periodLabel}</div>
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
  const epsC = metrics.epsSurprisePercent == null ? "var(--text)"
    : metrics.epsSurprisePercent > 0 ? "var(--green)" : "var(--red)";
  const revC = metrics.revenueSurprisePercent == null ? "var(--text)"
    : metrics.revenueSurprisePercent > 0 ? "var(--green)" : "var(--red)";
  const epsH = metrics.epsSurprisePercent  != null
    ? (metrics.epsSurprisePercent  > 0 ? "green" : "red") as "green" | "red" : undefined;
  const revH = metrics.revenueSurprisePercent != null
    ? (metrics.revenueSurprisePercent > 0 ? "green" : "red") as "green" | "red" : undefined;

  return (
    <div className="panel-box fade-up fade-up-3">
      <div className="panel-label">Financial Metrics (Yahoo) — {periodLabel}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <MetricCell label="EPS Surprise"
          value={fmt(metrics.epsSurprisePercent, pct)}
          delta={metrics.epsSurprisePercent != null
            ? metrics.epsSurprisePercent > 0 ? "Beat estimate" : "Missed estimate"
            : "Not available"}
          color={epsC} highlight={epsH} />
        <MetricCell label="Revenue Surprise"
          value={fmt(metrics.revenueSurprisePercent, pct)}
          delta={metrics.revenueSurprisePercent != null
            ? metrics.revenueSurprisePercent > 0 ? "Beat estimate" : "Missed estimate"
            : "Not available"}
          color={revC} highlight={revH} />
        <MetricCell label="Dividend Change QoQ"
          value={fmt(metrics.dividendChangePercent, pct, "N/A")}
          delta="Current quarter vs prior quarter"
          color={metrics.dividendChangePercent == null ? "var(--text-muted)"
            : metrics.dividendChangePercent > 0 ? "var(--green)" : "var(--text)"} />
        <MetricCell label="FCF Change QoQ"
          value={fmt(metrics.fcfChangeQoQ, pct)}
          delta="Free cash flow trend"
          color={metrics.fcfChangeQoQ == null ? "var(--text)"
            : metrics.fcfChangeQoQ >= 0 ? "var(--green)" : "var(--red)"} />
        <MetricCell label="P/E Ratio"
          value={fmt(metrics.peRatio, v => `${v.toFixed(2)}×`)}
          delta="Trailing or forward (Yahoo)" />
        <MetricCell label="PEG Ratio"
          value={fmt(metrics.pegRatio, v => v.toFixed(2))}
          delta="Price/Earnings-to-Growth" />
        <MetricCell label="Price / Book"
          value={fmt(metrics.priceToBook, v => `${v.toFixed(2)}×`)}
          delta="Valuation multiple" />
        <MetricCell label="Price / Sales (TTM)"
          value={fmt(metrics.priceToSalesTtm, v => `${v.toFixed(2)}×`)}
          delta="Trailing 12-month sales" />
        <MetricCell label="Enterprise Value"
          value={fmt(metrics.enterpriseValue, compact)}
          delta="Total firm value" />
        <MetricCell label="EV / EBITDA"
          value={fmt(metrics.enterpriseToEbitda, v => `${v.toFixed(2)}×`)}
          delta="Enterprise multiple" />
      </div>
    </div>
  );
}
