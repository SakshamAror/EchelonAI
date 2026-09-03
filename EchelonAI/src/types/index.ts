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
  title?: string;
  url?: string;
}

export interface ChartArticleRef {
  title: string;
  url: string;
  source: string;
  sentiment: "pos" | "neg" | "neutral";
  date: string;
}

export interface ChartEventPoint {
  index: number;         // index into points[]
  date: string;          // ISO date e.g. "2024-01-15"
  isPeak: boolean;
  isValley: boolean;
  articles: ChartArticleRef[];
}

export interface ForumChartData {
  points: number[];              // normalized 0–100 values, ~11 data points
  dates?: string[];              // ISO date for each chart point
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
  eventPoints?: ChartEventPoint[];  // chart points with linked news articles
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
  /** If set, jump-to-detail scrolls to this element id (e.g. metric-returnOnEquity). */
  detailAnchor?: string;
}

export interface PeerCompany {
  ticker: string;
  companyName: string;
  quarterlyReturn: number | null;
  financialScore: number;
  culturalScore: number;
  culturalSentiment: "pos" | "neg" | "neutral";
  topHeadline?: string;
}

export interface PeerCohort {
  peers: PeerCompany[];
  narrative: string;
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
  peerCohort?: PeerCohort | null;
  culturalBreakdown?: CulturalBreakdown | null;
  dataErrors?: {
    scorecard?: string;
    forumChart?: string;
    financial?: string;
    cultural?: string;
    social?: string;
    synthesis?: string;
    sources?: string;
    secFiling?: string;
  };
}

// ── Cultural breakdown (split-source scoring) ─────────────────────────────────

export interface RedditPost {
  id: string;
  title: string;
  score: number;
  numComments: number;
  createdUtc: number;
  subreddit: string;
  url: string;
  sentiment: "pos" | "neg" | "neutral";
  date: string;
}

export interface SocialLane {
  score: number;
  posts: RedditPost[];
  mentionVelocity: number;
  firstMentionDate?: string | null;
}

export interface MainstreamLane {
  score: number;
  articles: CulturalSignal[];
}

export interface AnalystLane {
  score: number | null;
  articles: CulturalSignal[];
}

export interface SecLane {
  score: number;
  highlights: string[];
  tone: "cautious" | "confident" | "neutral";
}

export interface DivergenceMetrics {
  mainstreamVsSocial: number | null;
  leadLagDays: number | null;
  signalType: "early_signal" | "fade" | "aligned" | "split" | "unknown";
}

export interface CulturalBreakdown {
  mainstream: MainstreamLane;
  analyst?: AnalystLane | null;
  social: SocialLane;
  sec: SecLane;
  divergence: DivergenceMetrics;
  score: number;
}

// Agent progress
export type AgentStepStatus = "pending" | "running" | "done" | "error";

export interface AgentStep {
  id: string;
  label: string;
  status: AgentStepStatus;
  detail?: string;
}
