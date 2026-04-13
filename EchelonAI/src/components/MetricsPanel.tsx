// READ instructions.txt before editing this file.
// Financial Metrics panel driven by financial_agent.py outputs.

import type { FinancialMetrics } from "@/types";

interface Props { metrics: FinancialMetrics; periodLabel: string; error?: string }

type MetricKey = keyof FinancialMetrics;
type MetricCategory = "valuation" | "profitability" | "growth" | "cashflow" | "balance" | "dividend" | "risk";

type MetricDefinition = {
  key: MetricKey;
  label: string;
  definition: string;
  category: MetricCategory;
  format: "percent" | "multiple" | "currency" | "number" | "ratio";
};

const METRIC_DEFINITIONS: MetricDefinition[] = [
  {
    key: "trailingPE", label: "Trailing P/E", category: "valuation", format: "multiple",
    definition: "Price paid per $1 of the last 12 months of earnings. Highly sector-dependent — tech typically trades 25–40×, consumer staples 18–25×, utilities 15–20×. Under 12× may signal value or declining growth expectations. Over 50× embeds very high growth assumptions; a guidance miss hits hard. Always compare to sector peers, not an absolute number.",
  },
  {
    key: "enterpriseToEbitda", label: "EV / EBITDA", category: "valuation", format: "multiple",
    definition: "Total company value (equity + debt − cash) divided by cash operating earnings. Removes capital structure differences, making it useful for comparing companies across leverage levels. 8–12× is typical for mature businesses; >20× implies a significant growth or quality premium. Widely used in M&A and PE analysis to assess deal pricing.",
  },
  {
    key: "priceToBook", label: "Price / Book", category: "valuation", format: "multiple",
    definition: "Market price vs. the accounting book value of equity. Under 1.0 can mean the market thinks assets are worth less than stated — potential distress or deep value. Tech and pharma often trade 5–15× book due to intangible assets. High P/B is normal for asset-light, high-ROIC businesses. More meaningful for banks, insurers, and asset-heavy industrials.",
  },

  {
    key: "returnOnEquity", label: "Return on Equity", category: "profitability", format: "percent",
    definition: "Net profit generated per dollar of shareholder equity. Above 15% is generally solid; above 20% is strong. Software and consumer brands often exceed 30%. Banks typically target ~10–12%. Negative ROE means the company is destroying shareholder value. Caveat: very high ROE driven by heavy debt rather than profitability can be misleading — check D/E alongside.",
  },
  {
    key: "returnOnAssets", label: "Return on Assets", category: "profitability", format: "percent",
    definition: "How efficiently the company converts its asset base into profit. Above 5% is solid; above 10% is excellent. Capital-intensive sectors (airlines, manufacturing, utilities) structurally score lower — 1–3% can be acceptable there. Software and services businesses, which hold few assets, should clear 10%+ comfortably. Negative ROA signals unprofitability.",
  },
  {
    key: "profitMargins", label: "Net Profit Margin", category: "profitability", format: "percent",
    definition: "Percentage of revenue kept as net income after all costs, interest, and taxes. Above 20% is strong for most sectors. Retail and grocery run thin (1–5%); software and pharma can reach 25–40%. Negative margin means the business is unprofitable. Watch for one-time items inflating or depressing the margin — look at the trend, not a single quarter.",
  },
  {
    key: "grossMargins", label: "Gross Margin", category: "profitability", format: "percent",
    definition: "Revenue minus cost of goods sold, as a percentage of revenue. Reflects pricing power and production efficiency. Above 60% is typical for software and high-end consumer brands. Manufacturing runs 20–40%. Below 15% usually indicates a commoditized or highly competitive product. Gross margin compression is one of the earliest warning signs in earnings reports.",
  },
  {
    key: "operatingMargins", label: "Operating Margin", category: "profitability", format: "percent",
    definition: "Profitability from core operations before interest and taxes. Above 15% is healthy for most sectors; mature SaaS often targets 20–30%. A negative operating margin means the business burns cash from its core operations — acceptable for early-stage growth but a red flag for mature companies. Improving operating margin over time indicates scaling and cost efficiency.",
  },
  {
    key: "ebitdaMargins", label: "EBITDA Margin", category: "profitability", format: "percent",
    definition: "Cash operating profitability before debt costs and non-cash charges (depreciation, amortization). Above 25% is strong and widely used in debt analysis and M&A to assess debt serviceability. Common benchmark in PE and leveraged buyout pricing. Be cautious comparing companies with very different capex profiles — high D&A can hide low real cash generation.",
  },

  {
    key: "revenueGrowth", label: "Revenue Growth", category: "growth", format: "percent",
    definition: "Year-over-year change in total revenue. Above 10% is solid for large-cap companies; above 25% is high-growth territory. Negative revenue growth is a red flag unless the business is undergoing a deliberate restructuring or is cyclical. Compare against the sector's growth rate — beating the industry is more meaningful than an absolute number.",
  },
  {
    key: "earningsGrowth", label: "Earnings Growth", category: "growth", format: "percent",
    definition: "Year-over-year change in EPS or net income. Above 10% is needed to sustain most valuation multiples; above 20% justifies premium pricing. If earnings grow much slower than revenue, margins are compressing — a key warning sign. Earnings growing faster than revenue means the business is becoming more efficient. Negative growth puts valuation multiples under pressure.",
  },

  {
    key: "freeCashflow", label: "Free Cash Flow", category: "cashflow", format: "currency",
    definition: "Cash left after capital expenditures — the clearest measure of financial health. Positive FCF funds dividends, buybacks, debt paydown, and acquisitions. Negative FCF can be appropriate for high-growth companies investing heavily, but must be funded by debt or equity raises. Sustained positive FCF is one of the strongest indicators of long-term business quality.",
  },
  {
    key: "operatingCashflow", label: "Operating Cash Flow", category: "cashflow", format: "currency",
    definition: "Cash generated by core business operations before investing and financing. Should ideally exceed net income — if it's persistently lower, watch for aggressive revenue recognition or working capital deterioration. A large gap between reported earnings and operating cash flow is a common early flag for earnings quality problems.",
  },
  {
    key: "capitalExpenditures", label: "Capital Expenditures", category: "cashflow", format: "currency",
    definition: "Cash invested in physical assets, technology, or infrastructure. High capex relative to revenue (>15%) is expected in telecom, energy, and manufacturing — these are asset-heavy industries. Software and services companies run lean (<5%). Rising capex can signal growth investment or deteriorating asset base. Capex deducted from operating cash flow gives free cash flow.",
  },
  {
    key: "fcf_change", label: "FCF Proxy", category: "cashflow", format: "currency",
    definition: "Agent-computed proxy for free cash flow: operating cash flow minus capital expenditures. Used when direct FCF line items are unavailable from the data source. Positive values indicate a cash-generative business. Treat as an approximation — the actual FCF figure may differ slightly depending on how the company reports working capital adjustments.",
  },
  {
    key: "totalRevenue", label: "Total Revenue", category: "cashflow", format: "currency",
    definition: "Total top-line revenue for the period. Provides scale context for all other metrics — a 20% profit margin means very different things at $500M vs. $50B in revenue. Use to benchmark size within a sector and assess absolute earning power. On its own, revenue says nothing about profitability; always pair with margin metrics.",
  },

  {
    key: "marketCap", label: "Market Cap", category: "balance", format: "currency",
    definition: "Total equity market value: share price × shares outstanding. Scale context: mega-cap >$200B, large-cap $10B–$200B, mid-cap $2B–$10B, small-cap <$2B. Larger companies typically have higher institutional ownership, more analyst coverage, and lower volatility. Smaller caps can have higher upside and higher risk. Affects index inclusion and liquidity.",
  },
  {
    key: "totalCash", label: "Total Cash", category: "balance", format: "currency",
    definition: "Cash and equivalents on the balance sheet. For unprofitable companies, compare against quarterly burn rate to estimate runway. For profitable companies, high cash relative to market cap ('net cash') can signal undervaluation or poor capital allocation. Compare against total debt to assess net leverage — net cash position is a strong balance sheet signal.",
  },
  {
    key: "totalDebt", label: "Total Debt", category: "balance", format: "currency",
    definition: "Combined short-term and long-term debt. Never analyze in isolation — $10B of debt means very different things for a $200B company vs. a $5B company. Pair with EBITDA (debt/EBITDA) or equity (D/E ratio) to assess sustainability. Utilities and REITs tolerate 4–6× EBITDA debt; tech and services should stay under 2×. Rising debt during revenue declines is a red flag.",
  },
  {
    key: "debtToEquity", label: "Debt / Equity", category: "balance", format: "ratio",
    definition: "Total debt divided by shareholders' equity. Below 0.5 indicates conservative, low-leverage financing. Above 2.0 is highly leveraged and raises refinancing risk. Sector context is critical — utilities, REITs, and banks structurally run higher D/E (2–5×) due to their business models. For tech and consumer companies, D/E above 1.5 is a concern worth investigating.",
  },
  {
    key: "currentRatio", label: "Current Ratio", category: "balance", format: "ratio",
    definition: "Current assets divided by current liabilities — a snapshot of short-term liquidity. Above 2.0 is comfortable and means the company can cover near-term obligations twice over. Below 1.0 means current liabilities exceed current assets, flagging potential liquidity stress. A very high ratio (>5) can indicate idle cash or inefficient working capital management.",
  },
  {
    key: "quickRatio", label: "Quick Ratio", category: "balance", format: "ratio",
    definition: "Current assets minus inventory, divided by current liabilities. A more conservative liquidity test than current ratio — removes inventory, which may be hard to liquidate quickly. Above 1.5 is healthy; below 0.8 is a warning sign. Preferred for evaluating companies with slow-moving or illiquid inventory, such as retailers, manufacturers, or auto companies.",
  },

  {
    key: "dividendRate", label: "Dividend Rate", category: "dividend", format: "currency",
    definition: "Annualized cash dividend paid per share. The raw amount is less meaningful than yield (rate ÷ price) and payout ratio (rate ÷ EPS). A rising dividend rate over time is a strong signal of management confidence in sustained earnings. A cut to the dividend rate is one of the most negative events for income-oriented investors and often triggers sharp share price declines.",
  },
  {
    key: "dividendYield", label: "Dividend Yield", category: "dividend", format: "percent",
    definition: "Annual dividend as a percentage of the current share price. 2–4% is typical for mature dividend payers (consumer staples, utilities). Above 6% can be attractive but may signal payout risk if not backed by strong free cash flow — a 'yield trap'. Growth companies typically yield 0–1% as they retain capital for reinvestment. Yield rises mechanically when the stock falls.",
  },
  {
    key: "dividend_change", label: "Dividend Change", category: "dividend", format: "currency",
    definition: "Difference between the most recent and prior dividend payment. Increases signal management confidence in future earnings — companies rarely raise dividends unless they expect to sustain them. A cut or suspension is typically a severe negative signal that implies deteriorating cash flow or balance sheet stress. Even a missed expected raise can disappoint income investors.",
  },
  {
    key: "payoutRatio", label: "Payout Ratio", category: "dividend", format: "percent",
    definition: "Fraction of earnings distributed as dividends. Below 50% is conservative and sustainable for most businesses. Above 80–90% is a warning — even modest earnings pressure could force a cut. Utilities and REITs structurally run 60–80% due to regulation and pass-through structures. If payout ratio exceeds 100%, the dividend is being funded by debt or reserves — unsustainable.",
  },

  {
    key: "beta", label: "Beta", category: "risk", format: "number",
    definition: "Measures how much the stock moves relative to the broader market (S&P 500 = 1.0). Beta of 0.8 means ~20% less volatile than the index; beta of 1.5 means ~50% more volatile. Negative beta (gold, some utilities) moves inversely to the market. High-beta stocks amplify both gains and losses — good in bull markets, painful in drawdowns. Defensive investors typically target beta < 1.",
  },
];

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function compactCurrency(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(2)}K`;
  return `$${v.toFixed(2)}`;
}

function formatValue(metric: MetricDefinition, value: number): string {
  if (metric.format === "multiple") return `${value.toFixed(2)}x`;
  if (metric.format === "percent") return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
  if (metric.format === "currency") return compactCurrency(value);
  if (metric.format === "ratio") return value.toFixed(2);
  return value.toFixed(2);
}

const NEUTRAL_TONE = { border: "var(--border)", bg: "rgba(255,255,255,0.02)", label: "var(--text-muted)" };

function directionalHighlight(metric: MetricDefinition, value: number): "green" | "red" | undefined {
  switch (metric.key) {
    // Profitability — green only if strong, red only if negative
    case "returnOnEquity":    return value > 0.15 ? "green" : value < 0 ? "red" : undefined;
    case "returnOnAssets":    return value > 0.05 ? "green" : value < 0 ? "red" : undefined;
    case "profitMargins":     return value > 0.20 ? "green" : value < 0 ? "red" : undefined;
    case "grossMargins":      return value > 0.40 ? "green" : value < 0.10 ? "red" : undefined;
    case "operatingMargins":  return value > 0.15 ? "green" : value < 0 ? "red" : undefined;
    case "ebitdaMargins":     return value > 0.20 ? "green" : value < 0 ? "red" : undefined;
    // Growth — green only if strong, red only if clearly declining
    case "revenueGrowth":     return value > 0.10 ? "green" : value < -0.05 ? "red" : undefined;
    case "earningsGrowth":    return value > 0.10 ? "green" : value < -0.05 ? "red" : undefined;
    // Balance — clear thresholds only
    case "debtToEquity":      return value < 0.5 ? "green" : value > 2.0 ? "red" : undefined;
    case "currentRatio":      return value >= 2.0 ? "green" : value < 1.0 ? "red" : undefined;
    case "quickRatio":        return value >= 1.5 ? "green" : value < 0.8 ? "red" : undefined;
    // Cash flow — positive good, negative bad (material threshold)
    case "freeCashflow":      return value > 5e8 ? "green" : value < 0 ? "red" : undefined;
    case "operatingCashflow": return value > 0 ? "green" : "red";
    // Risk
    case "beta":              return value < 1.0 ? "green" : value > 2.0 ? "red" : undefined;
    case "payoutRatio":       return value < 0.6 ? "green" : value > 0.9 ? "red" : undefined;
    // No directional color — valuation multiples, dividends, and currency totals are context-dependent
    default:                  return undefined;
  }
}

function MetricCell({ metric, value }: { metric: MetricDefinition; value: number }) {
  const highlight = directionalHighlight(metric, value);

  const borderColor = highlight === "green" ? "rgba(61,220,132,0.4)" : highlight === "red" ? "rgba(255,76,76,0.4)" : NEUTRAL_TONE.border;
  const bgColor = highlight === "green" ? "rgba(61,220,132,0.07)" : highlight === "red" ? "rgba(255,76,76,0.07)" : NEUTRAL_TONE.bg;
  const valueColor = highlight === "green" ? "var(--green)" : highlight === "red" ? "var(--red)" : "var(--text)";
  const labelColor = highlight === "green" ? "#7ecfa8" : highlight === "red" ? "#d88080" : NEUTRAL_TONE.label;

  return (
    <div style={{ padding: 14, border: `1px solid ${borderColor}`, background: bgColor, position: "relative" }}>
      <p style={{ fontSize: 9, letterSpacing: "0.2em", color: labelColor, textTransform: "uppercase", marginBottom: 8 }}>
        {metric.label}
      </p>

      <p className="font-bebas" style={{ fontSize: 22, letterSpacing: "0.04em", color: valueColor }}>
        {formatValue(metric, value)}
      </p>

      <details style={{ marginTop: 8 }}>
        <summary
          style={{
            fontSize: 9,
            color: "var(--accent)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          Definition
        </summary>
        <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6 }}>{metric.definition}</p>
      </details>
    </div>
  );
}

export default function MetricsPanel({ metrics, periodLabel, error }: Props) {
  if (error) {
    return (
      <div className="panel-box fade-up fade-up-3">
        <div className="panel-label">Financial Metrics (Agent) - {periodLabel}</div>
        <div
          style={{
            padding: 14,
            border: "1px solid var(--red)",
            background: "rgba(255,76,76,0.06)",
            color: "var(--red)",
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          {error}
        </div>
      </div>
    );
  }

  const availableMetrics = METRIC_DEFINITIONS
    .map((def) => ({ def, value: metrics[def.key] }))
    .filter((row): row is { def: MetricDefinition; value: number } => isFiniteNumber(row.value));

  if (availableMetrics.length === 0) {
    return (
      <div className="panel-box fade-up fade-up-3">
        <div className="panel-label">Financial Metrics (Agent) - {periodLabel}</div>
        <div
          style={{
            padding: 14,
            border: "1px solid var(--border)",
            background: "var(--bg)",
            color: "var(--text-muted)",
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          No financial metrics were returned by the financial agent for this ticker and period.
        </div>
      </div>
    );
  }

  return (
    <div className="panel-box fade-up fade-up-3">
      <div className="panel-label">Financial Metrics (Agent) - {periodLabel}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {availableMetrics.map((row) => (
          <MetricCell key={row.def.key} metric={row.def} value={row.value} />
        ))}
      </div>
    </div>
  );
}
