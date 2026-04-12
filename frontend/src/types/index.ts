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
  priceChangePercent: number;
  peRatio: number | null;
  epsSurprisePercent: number | null;      // e.g. +4.1 = beat by 4.1%
  revenueSurprisePercent: number | null;  // e.g. -2.8 = missed by 2.8%
  dividendChangePercent: number | null;   // null = no dividend
  fcfChangeQoQ: number | null;            // free cash flow % change
  // Valuation metrics (Yahoo Finance)
  pegRatio: number | null;
  priceToBook: number | null;
  priceToSalesTtm: number | null;
  enterpriseValue: number | null;
  enterpriseToEbitda: number | null;
}

export interface CulturalSignal {
  date: string;                            // e.g. "Oct 7"
  sentiment: "pos" | "neg" | "neutral";
  text: string;
  source: string;                          // e.g. "Reuters · Bloomberg"
}

export interface ForumChartData {
  points: number[];    // normalized 0–100 values, ~11 data points
  labels: string[];    // [start, mid, end] x-axis labels
  peakIndex: number;   // index into points[] where peak occurred
  peakLabel: string;   // human label, e.g. "Oct 14"
  deltaForum: number;  // % change in Forum attention over period
  deltaPrice: number;  // % change in price over same period
}

export interface Source {
  title: string;
  url: string;
  date: string;
  type: "news" | "filing" | "forum" | "web";
}

export interface ReasoningPoint {
  text: string;
  category: "cultural" | "financial" | "filing";
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
  dataErrors?: {
    scorecard?: string;
    forumChart?: string;
    financial?: string;
    cultural?: string;
    synthesis?: string;
    sources?: string;
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
