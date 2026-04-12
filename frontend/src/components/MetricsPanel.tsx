// READ instructions.txt before editing this file.
// Five locked-in yfinance metrics. Add new metrics in types/index.ts first.

import type { FinancialMetrics } from "@/types";

interface Props { metrics: FinancialMetrics; }

function fmt(val: number | null, f: (v: number) => string) {
  return val == null ? "—" : f(val);
}

const insiderColor: Record<NonNullable<FinancialMetrics["insiderTradingActivity"]>, string> = {
  "heavy buying":  "var(--green)",
  "light buying":  "var(--green)",
  "neutral":       "var(--text-muted)",
  "light selling": "var(--accent)",
  "heavy selling": "var(--red)",
};

export default function MetricsPanel({ metrics }: Props) {
  const rows: { label: string; value: string; color?: string }[] = [
    {
      label: "PRICE CHANGE",
      value: fmt(metrics.priceChangePercent, v => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`),
      color: metrics.priceChangePercent == null ? undefined
        : metrics.priceChangePercent >= 0 ? "var(--green)" : "var(--red)",
    },
    {
      label: "P/E RATIO",
      value: fmt(metrics.peRatio, v => v.toFixed(1)),
    },
    {
      label: "REVENUE GROWTH QoQ",
      value: fmt(metrics.revenueGrowthQoQ, v => `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`),
      color: metrics.revenueGrowthQoQ == null ? undefined
        : metrics.revenueGrowthQoQ >= 0 ? "var(--green)" : "var(--red)",
    },
    {
      label: "SHORT INTEREST",
      value: fmt(metrics.shortInterestPercent, v => `${v.toFixed(1)}%`),
    },
    {
      label: "ANALYST SENTIMENT",
      value: fmt(metrics.analystSentimentScore, v => `${v} / 100`),
      color: metrics.analystSentimentScore == null ? undefined
        : metrics.analystSentimentScore >= 60 ? "var(--green)"
        : metrics.analystSentimentScore >= 40 ? "var(--accent)" : "var(--red)",
    },
    {
      label: "INSIDER ACTIVITY",
      value: metrics.insiderTradingActivity ?? "—",
      color: metrics.insiderTradingActivity
        ? insiderColor[metrics.insiderTradingActivity]
        : undefined,
    },
  ];

  return (
    <div
      className="mt-4 border"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div
        className="px-4 py-3 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <p className="font-mono text-[9px] tracking-[0.25em]" style={{ color: "var(--text-muted)" }}>
          FINANCIAL METRICS — YFINANCE
        </p>
      </div>
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {rows.map(row => (
          <div
            key={row.label}
            className="flex items-center justify-between px-4 py-3"
            style={{ borderColor: "var(--border)" }}
          >
            <span className="font-mono text-[10px] tracking-widest" style={{ color: "var(--text-muted)" }}>
              {row.label}
            </span>
            <span
              className="font-mono font-bold text-sm"
              style={{ color: row.color ?? "var(--text)" }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
