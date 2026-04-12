// READ instructions.txt before editing this file.
// ─────────────────────────────────────────────────────────────────────────────
// Shared TypeScript types for AlphaIQ frontend.
// APPEND new types below — do NOT rename or remove existing types as other
// components depend on them. Coordinate with teammates before changing
// existing interfaces.
// ─────────────────────────────────────────────────────────────────────────────

export type Quarter = "Q1" | "Q2" | "Q3" | "Q4";

export interface TimeFrame {
  quarter: Quarter;
  year: number;
}

export interface AnalysisRequest {
  company: string;   // e.g. "Nike"
  ticker?: string;   // e.g. "NKE" — optional, resolved by backend
  timeframe: TimeFrame;
}

export interface FinancialMetrics {
  priceChangePercent: number;    // % move over the period
  peRatio: number | null;
  revenueGrowthQoQ: number | null; // as decimal e.g. 0.12 = +12%
  shortInterestPercent: number | null;
  analystSentimentScore: number | null; // 0–100
  insiderTradingActivity: "heavy buying" | "light buying" | "neutral" | "light selling" | "heavy selling" | null;
}

export interface Source {
  title: string;
  url: string;
  date: string;       // ISO date string
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
  alphaScore: number;           // 0–100 combined score
  culturalScore: number;        // 0–100
  financialScore: number;       // 0–100
  metrics: FinancialMetrics;
  reasoning: ReasoningPoint[];
  summary: string;              // 2–3 sentence narrative
  sources: Source[];
}

// Agent progress — used by AgentProgress component
export type AgentStepStatus = "pending" | "running" | "done" | "error";

export interface AgentStep {
  id: string;
  label: string;
  status: AgentStepStatus;
  detail?: string;
}
