// READ instructions.txt before editing this file.
// ─────────────────────────────────────────────────────────────────────────────
// Shared TypeScript types for AlphaIQ frontend.
// APPEND new types below — do NOT rename or remove existing types as other
// components depend on them. Coordinate with teammates before changing
// existing interfaces.
// ─────────────────────────────────────────────────────────────────────────────

export interface TimeFrame {
  quarter: number; // 1–4
  year: number;
}

export interface AnalysisRequest {
  company: string;   // e.g. "Nike"
  ticker?: string;   // e.g. "NKE" — optional, resolved by backend
  timeframe: TimeFrame;
}

export interface FinancialMetrics {
  // Legacy keys (kept optional for compatibility with old fixtures)
  priceChangePercent?: number | null;
  peRatio?: number | null;
  epsSurprisePercent?: number | null;
  revenueSurprisePercent?: number | null;
  dividendChangePercent?: number | null;
  fcfChangeQoQ?: number | null;
  priceToSalesTtm?: number | null;
  enterpriseValue?: number | null;

  // Agent-derived keys
  trailingPE?: number | null;
  forwardPE?: number | null;
  pegRatio?: number | null;
  enterpriseToEbitda?: number | null;
  returnOnEquity?: number | null;
  debtToEquity?: number | null;
  priceToBook?: number | null;
  currentRatio?: number | null;
  quickRatio?: number | null;
  marketCap?: number | null;
  totalCash?: number | null;
  totalDebt?: number | null;
  profitMargins?: number | null;
  grossMargins?: number | null;
  operatingMargins?: number | null;
  ebitdaMargins?: number | null;
  revenueGrowth?: number | null;
  earningsGrowth?: number | null;
  returnOnAssets?: number | null;
  payoutRatio?: number | null;
  beta?: number | null;
  freeCashflow?: number | null;
  operatingCashflow?: number | null;
  capitalExpenditures?: number | null;
  fcf_change?: number | null;
  totalRevenue?: number | null;
  dividendRate?: number | null;
  dividendYield?: number | null;
  dividend_change?: number | null;
}

export interface CulturalSignal {
  date: string;                            // e.g. "Oct 7"
  sentiment: "pos" | "neg" | "neutral";
  text: string;
  source: string;                          // e.g. "Reuters · Bloomberg"
}

export interface ForumChartData {
  points: number[];              // normalized 0–100 values, ~11 data points
  labels: string[];              // [start, mid, end] x-axis labels
  peakIndex: number;             // index into points[] where peak occurred
  peakLabel: string;             // human label, e.g. "Oct 14"
  deltaPrice: number;            // % change in price over same period
  startPrice?: number | null;
  endPrice?: number | null;
  highPrice?: number | null;
  lowPrice?: number | null;
  benchmarkPoints?: number[];    // S&P 500 performance-rebased to same 0–100 scale
  benchmarkDelta?: number;       // S&P 500 % change over same period
}

export interface Source {
  title: string;
  url: string;
  date: string;
  type: "news" | "filing" | "forum" | "web";
}

export interface SecFiling {
  filingUrl: string;
  documentUrl: string;
  filingDate: string;          // YYYY-MM-DD
  periodOfReport: string;      // YYYY-MM-DD (fiscal period end)
  companyName: string;
  highlights: string[];        // up to 3 MD&A sentences
}

export interface ReasoningPoint {
  text: string;
  category: "cultural" | "financial" | "filing";
  direction?: "pos" | "neg";
  sources: Source[];
}

export interface AnalysisResult {
  ticker: string;
  companyName: string;
  timeframe: TimeFrame;
  direction: "up" | "down" | "flat";
  alphaScore: number;           // 0–100
  culturalScore: number;        // 0–100
  financialScore: number;       // 0–100
  forumMomentumScore: number;   // 0–100
  metrics: FinancialMetrics;
  culturalSignals: CulturalSignal[];
  forumChart: ForumChartData;
  reasoning: ReasoningPoint[];
  summary: string;
  sources: Source[];
  secFiling?: SecFiling | null;
  dataErrors?: {
    scorecard?: string;
    forumChart?: string;
    financial?: string;
    cultural?: string;
    synthesis?: string;
    sources?: string;
    secFiling?: string;
  };
}

// Agent progress
export type AgentStepStatus = "pending" | "running" | "done" | "error";

export interface AgentStep {
  id: string;
  label: string;
  status: AgentStepStatus;
  detail?: string;
}
