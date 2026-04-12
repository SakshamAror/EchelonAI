// READ instructions.txt before editing this file.
// Hardcoded demo fixtures. Demo companies: Nike Q3 2024, Nvidia Q3 2024, Tesla Q4 2023

import type { AnalysisRequest, AnalysisResult, FinancialMetrics, ReasoningPoint, TimeFrame } from "@/types";

export const DEMO_RESULTS: Record<string, AnalysisResult> = {
  // ─── NIKE Q3 2024 ─────────────────────────────────────────────────────────
  "NKE-Q3-2024": {
    ticker: "NKE",
    companyName: "Nike",
    timeframe: { quarter: 3, year: 2024 },
    direction: "down",
    alphaScore: 34,
    culturalScore: 28,
    financialScore: 41,
    forumMomentumScore: 52,
    metrics: {
      priceChangePercent: -19.6,
      peRatio: 20.4,
      epsSurprisePercent: 4.1,
      revenueSurprisePercent: -2.8,
      dividendChangePercent: 0,
      fcfChangeQoQ: -18.4,
      pegRatio: 2.1,
      priceToBook: 8.7,
      priceToSalesTtm: 2.3,
      enterpriseValue: 145_000_000_000,
      enterpriseToEbitda: 19.8,
    },
    culturalSignals: [
      { date: "Sep 7", sentiment: "neg", text: "Nike lowers FY25 revenue guidance; CEO Elliott Hill takes over amid DTC strategy pivot.", source: "Reuters · Bloomberg" },
      { date: "Sep 14", sentiment: "neutral", text: "Viral TikTok campaign resurfaces \"Just Do It\" nostalgia; Jordan brand moment spikes organic search.", source: "Hypebeast · Nia Index" },
      { date: "Sep 22", sentiment: "neg", text: "Short interest reaches 18-month high as institutional sell-off accelerates into quarter-end.", source: "WSJ · Forum Data" },
    ],
    forumChart: {
      points: [38, 42, 45, 52, 48, 55, 75, 88, 72, 58, 50],
      labels: ["Sep 1", "Sep 15", "Sep 30"],
      peakIndex: 7,
      peakLabel: "Sep 14",
      deltaPrice: -8.2,
    },
    summary:
      "Nike declined sharply in September 2024 as weakening consumer demand in China and North America collided with margin pressure from elevated inventory levels. The brand's cultural momentum slowed amid rising competition from On Running and HOKA, while its 10-Q cited DTC headwinds and macro uncertainty as structural risks.",
    reasoning: [
      { text: "China revenue fell 6% YoY as post-COVID consumer recovery stalled and local brands gained shelf space.", category: "financial", sources: [{ title: "Nike FY2024 Q3 10-Q — MD&A", url: "#", date: "2024-09-04", type: "filing" }] },
      { text: "On Running and HOKA collectively grew market share by ~3 pts in running footwear, directly pressuring Nike's core segment.", category: "cultural", sources: [{ title: "Bloomberg: Running Shoe Wars", url: "#", date: "2024-09-18", type: "news" }] },
      { text: "Elevated inventory levels required heavy promotional activity, compressing gross margins by 150bps.", category: "financial", sources: [{ title: "Nike Q3 Earnings Call Transcript", url: "#", date: "2024-09-04", type: "news" }] },
      { text: "Forum attention spike on Sep 14 was driven by CEO transition uncertainty — cultural volume surged as a reaction to fear, not enthusiasm.", category: "cultural", sources: [{ title: "Forum API · NKE", url: "#", date: "2024-09-14", type: "forum" }] },
    ],
    sources: [
      { title: "Nike FY2024 Q3 10-Q", url: "#", date: "2024-09-04", type: "filing" },
      { title: "Forum API · NKE Attention Data", url: "#", date: "2024-09-14", type: "forum" },
      { title: "Bloomberg: Running Shoe Wars", url: "#", date: "2024-09-18", type: "news" },
      { title: "WSJ: Short Interest Report", url: "#", date: "2024-09-22", type: "news" },
      { title: "Nia · Hypebeast Index", url: "#", date: "2024-09-14", type: "web" },
    ],
  },

  // ─── NVIDIA Q3 2024 ───────────────────────────────────────────────────────
  "NVDA-Q3-2024": {
    ticker: "NVDA",
    companyName: "Nvidia",
    timeframe: { quarter: 3, year: 2024 },
    direction: "up",
    alphaScore: 91,
    culturalScore: 88,
    financialScore: 95,
    forumMomentumScore: 92,
    metrics: {
      priceChangePercent: 36.8,
      peRatio: 68.2,
      epsSurprisePercent: 8.2,
      revenueSurprisePercent: 5.1,
      dividendChangePercent: 150,
      fcfChangeQoQ: 22.4,
      pegRatio: 1.9,
      priceToBook: 41.3,
      priceToSalesTtm: 24.7,
      enterpriseValue: 2_900_000_000_000,
      enterpriseToEbitda: 57.2,
    },
    culturalSignals: [
      { date: "Aug 6", sentiment: "pos", text: "Blackwell GPU shipment acceleration confirmed — hyperscaler orders surge beyond capacity.", source: "The Verge · Ars Technica" },
      { date: "Aug 22", sentiment: "pos", text: "Q2 FY2025 earnings: revenue $30B vs $28.6B est. Jensen Huang calls demand for AI compute \"insane\".", source: "Nvidia IR · Bloomberg" },
      { date: "Aug 28", sentiment: "pos", text: "14 of 15 sell-side analysts raise price targets post-earnings; retail forum volume hits all-time high.", source: "Reuters · Forum Data" },
    ],
    forumChart: {
      points: [55, 60, 65, 72, 78, 82, 88, 92, 98, 95, 94],
      labels: ["Aug 1", "Aug 15", "Aug 31"],
      peakIndex: 8,
      peakLabel: "Aug 22",
      deltaPrice: 28.4,
    },
    summary:
      "Nvidia surged in August 2024 on the back of insatiable data center AI infrastructure demand. The H100 GPU remained the gold standard for LLM training, while Blackwell architecture announcements amplified cultural momentum across the AI investment narrative. Revenue beat by $1.4B and guidance was raised materially for Q3.",
    reasoning: [
      { text: "Data center revenue reached $26.3B, up 154% YoY, driven by hyperscaler AI infrastructure buildout.", category: "financial", sources: [{ title: "Nvidia Q2 FY2025 10-Q", url: "#", date: "2024-08-28", type: "filing" }] },
      { text: "Blackwell GPU architecture generated outsized developer and media coverage — Forum attention reached an all-time high on earnings day.", category: "cultural", sources: [{ title: "Forum API · NVDA", url: "#", date: "2024-08-22", type: "forum" }] },
      { text: "EPS of $0.68 beat estimates by 8.2%; special dividend declared, signaling management confidence in sustained cash generation.", category: "financial", sources: [{ title: "Reuters: Nvidia Analyst Upgrades", url: "#", date: "2024-08-29", type: "news" }] },
    ],
    sources: [
      { title: "Nvidia Q2 FY2025 10-Q", url: "#", date: "2024-08-28", type: "filing" },
      { title: "Forum API · NVDA Attention Data", url: "#", date: "2024-08-22", type: "forum" },
      { title: "The Verge: Blackwell Unveiled", url: "#", date: "2024-08-06", type: "news" },
      { title: "Reuters: Nvidia Analyst Upgrades", url: "#", date: "2024-08-29", type: "news" },
    ],
  },

  // ─── TESLA Q4 2023 ────────────────────────────────────────────────────────
  "TSLA-Q4-2023": {
    ticker: "TSLA",
    companyName: "Tesla",
    timeframe: { quarter: 4, year: 2023 },
    direction: "down",
    alphaScore: 38,
    culturalScore: 45,
    financialScore: 31,
    forumMomentumScore: 48,
    metrics: {
      priceChangePercent: -13.2,
      peRatio: 47.1,
      epsSurprisePercent: -3.2,
      revenueSurprisePercent: -1.1,
      dividendChangePercent: null,
      fcfChangeQoQ: -12.8,
      pegRatio: 2.8,
      priceToBook: 9.1,
      priceToSalesTtm: 6.2,
      enterpriseValue: 760_000_000_000,
      enterpriseToEbitda: 38.5,
    },
    culturalSignals: [
      { date: "Dec 2", sentiment: "neg", text: "BYD officially surpasses Tesla in Q4 global EV deliveries for the first time — sustained negative press cycle begins.", source: "FT · Reuters" },
      { date: "Dec 11", sentiment: "neg", text: "Elon Musk's X platform advertiser exodus intensifies; brand association risk elevated in brand safety surveys.", source: "NYT · Forum Data" },
      { date: "Dec 20", sentiment: "neutral", text: "Cybertruck deliveries begin but ramp disappointingly slow; early reviews cite build quality concerns.", source: "Ars Technica · Nia Index" },
    ],
    forumChart: {
      points: [68, 62, 58, 52, 48, 45, 42, 38, 36, 33, 30],
      labels: ["Dec 1", "Dec 15", "Dec 31"],
      peakIndex: 0,
      peakLabel: "Dec 1",
      deltaPrice: -13.2,
    },
    summary:
      "Tesla faced margin compression in December 2023 as aggressive price cuts sustained volume but eroded profitability. Cultural headwinds from Musk's X platform controversy dampened brand sentiment, while BYD officially surpassed Tesla in global EV deliveries — a significant symbolic and competitive milestone that drove sustained negative press.",
    reasoning: [
      { text: "Auto gross margin fell to 17.6% from 25.1% a year prior due to price cut strategy and higher Cybertruck ramp costs.", category: "financial", sources: [{ title: "Tesla Q4 2023 10-K", url: "#", date: "2024-01-26", type: "filing" }] },
      { text: "BYD surpassing Tesla in deliveries triggered a two-week negative press cycle — Forum attention declined in tandem with price.", category: "cultural", sources: [{ title: "Forum API · TSLA", url: "#", date: "2023-12-02", type: "forum" }] },
      { text: "EPS missed by 3.2% as margin pressure from pricing strategy hit harder than analysts modeled.", category: "financial", sources: [{ title: "Tesla Q4 2023 Earnings", url: "#", date: "2024-01-24", type: "news" }] },
    ],
    sources: [
      { title: "Tesla Q4 2023 10-K", url: "#", date: "2024-01-26", type: "filing" },
      { title: "Forum API · TSLA Attention Data", url: "#", date: "2023-12-02", type: "forum" },
      { title: "FT: BYD Overtakes Tesla", url: "#", date: "2024-01-02", type: "news" },
      { title: "NYT: Musk Brand Risk", url: "#", date: "2023-11-28", type: "news" },
    ],
  },
};

const KNOWN_COMPANY_TICKERS: Record<string, string> = {
  nike: "NKE",
  nvidia: "NVDA",
  tesla: "TSLA",
};

const DEMO_KEY_MAP: Record<string, string> = {
  nike: "NKE-Q3-2024",
  nvidia: "NVDA-Q3-2024",
  tesla: "TSLA-Q4-2023",
};

interface YahooResolveResponse {
  ticker: string;
  companyName?: string;
}

interface YahooMetricsResponse {
  ticker: string;
  timeframe: { quarter: number; year: number };
  metrics: FinancialMetrics;
  priceChart?: AnalysisResult["forumChart"] | null;
}

type DisplayedMetricKey = keyof FinancialMetrics;

const DISPLAYED_METRIC_KEYS: DisplayedMetricKey[] = [
  "priceChangePercent",
  "peRatio",
  "epsSurprisePercent",
  "revenueSurprisePercent",
  "dividendChangePercent",
  "fcfChangeQoQ",
  "pegRatio",
  "priceToBook",
  "priceToSalesTtm",
  "enterpriseValue",
  "enterpriseToEbitda",
];

const METRIC_LABEL: Record<DisplayedMetricKey, string> = {
  priceChangePercent: "Price Change %",
  peRatio: "P/E Ratio",
  epsSurprisePercent: "EPS Surprise %",
  revenueSurprisePercent: "Revenue Surprise %",
  dividendChangePercent: "Dividend Change %",
  fcfChangeQoQ: "FCF Change QoQ %",
  pegRatio: "PEG Ratio",
  priceToBook: "Price/Book",
  priceToSalesTtm: "Price/Sales TTM",
  enterpriseValue: "Enterprise Value",
  enterpriseToEbitda: "EV/EBITDA",
};

interface LlmReasoningItem {
  insight: string;
  whyItMatters: string;
  metricCitations: DisplayedMetricKey[];
  culturalSignalCitations?: number[];
}

interface LlmSynthesisResponse {
  summary: string;
  reasoning: LlmReasoningItem[];
}

function quarterLabel(timeframe: TimeFrame): string {
  return `Q${timeframe.quarter} ${timeframe.year}`;
}

function emptyMetrics(): FinancialMetrics {
  return {
    priceChangePercent: 0,
    peRatio: null,
    epsSurprisePercent: null,
    revenueSurprisePercent: null,
    dividendChangePercent: null,
    fcfChangeQoQ: null,
    pegRatio: null,
    priceToBook: null,
    priceToSalesTtm: null,
    enterpriseValue: null,
    enterpriseToEbitda: null,
  };
}

function buildUnavailableForumChart(timeframe: TimeFrame, deltaPrice: number): AnalysisResult["forumChart"] {
  const q = `Q${timeframe.quarter}`;
  return {
    points: [0, 0, 0],
    labels: [`${q} start`, `${q} mid`, `${q} end`],
    peakIndex: 0,
    peakLabel: "N/A",
    deltaPrice,
    startPrice: null,
    endPrice: null,
    highPrice: null,
    lowPrice: null,
  };
}

function sanitizePriceChart(
  chart: AnalysisResult["forumChart"] | null | undefined,
  timeframe: TimeFrame,
  deltaPriceFallback: number
): AnalysisResult["forumChart"] | null {
  if (!chart || !Array.isArray(chart.points) || chart.points.length < 2) return null;
  const points = chart.points
    .map((v) => (typeof v === "number" && Number.isFinite(v) ? v : null))
    .filter((v): v is number => v != null);
  if (points.length < 2) return null;

  const labels = Array.isArray(chart.labels) && chart.labels.length > 0
    ? chart.labels.slice(0, 3)
    : [`Q${timeframe.quarter} start`, `Q${timeframe.quarter} mid`, `Q${timeframe.quarter} end`];
  while (labels.length < 3) labels.push(labels[labels.length - 1] ?? "");

  const peakIndexRaw = typeof chart.peakIndex === "number" ? chart.peakIndex : 0;
  const peakIndex = Math.max(0, Math.min(points.length - 1, Math.round(peakIndexRaw)));
  const peakLabel = typeof chart.peakLabel === "string" && chart.peakLabel.trim()
    ? chart.peakLabel
    : labels[1];

  return {
    points,
    labels,
    peakIndex,
    peakLabel,
    deltaPrice:
      typeof chart.deltaPrice === "number" && Number.isFinite(chart.deltaPrice)
        ? chart.deltaPrice
        : deltaPriceFallback,
    startPrice:
      typeof chart.startPrice === "number" && Number.isFinite(chart.startPrice)
        ? chart.startPrice
        : null,
    endPrice:
      typeof chart.endPrice === "number" && Number.isFinite(chart.endPrice)
        ? chart.endPrice
        : null,
    highPrice:
      typeof chart.highPrice === "number" && Number.isFinite(chart.highPrice)
        ? chart.highPrice
        : null,
    lowPrice:
      typeof chart.lowPrice === "number" && Number.isFinite(chart.lowPrice)
        ? chart.lowPrice
        : null,
  };
}

function normalizeTicker(raw: string): string {
  return raw.trim().toUpperCase();
}

function isLikelyTickerSymbol(raw: string): boolean {
  return /^[A-Za-z][A-Za-z0-9.\-]{0,9}$/.test(raw.trim());
}

function inferTickerFromCompanyInput(companyInput: string): string | null {
  const trimmed = companyInput.trim();
  if (!trimmed) return null;

  const inParens = trimmed.match(/\(([A-Za-z][A-Za-z0-9.\-]{0,9})\)\s*$/);
  if (inParens?.[1]) return normalizeTicker(inParens[1]);

  if (isLikelyTickerSymbol(trimmed)) return normalizeTicker(trimmed);

  const tokens = trimmed.split(/\s+/);
  const uppercaseToken = [...tokens]
    .reverse()
    .find((token) => /^[A-Z][A-Z0-9.\-]{0,9}$/.test(token));
  if (uppercaseToken) return normalizeTicker(uppercaseToken);

  return null;
}

async function resolveTickerFromYahooQuery(query: string): Promise<YahooResolveResponse | null> {
  const q = query.trim();
  if (!q) return null;

  try {
    const params = new URLSearchParams({ query: q });
    const res = await fetch(`/yahoo-resolve?${params.toString()}`);
    if (!res.ok) return null;

    const payload = (await res.json()) as Partial<YahooResolveResponse>;
    if (!payload?.ticker || typeof payload.ticker !== "string") return null;

    return {
      ticker: normalizeTicker(payload.ticker),
      companyName:
        typeof payload.companyName === "string" && payload.companyName.trim()
          ? payload.companyName.trim()
          : undefined,
    };
  } catch {
    return null;
  }
}

async function resolveTickerAndCompany(
  companyInput: string,
  tickerHint?: string
): Promise<{ ticker: string; companyName: string } | null> {
  const trimmedCompany = companyInput.trim();

  if (tickerHint && isLikelyTickerSymbol(tickerHint)) {
    return {
      ticker: normalizeTicker(tickerHint),
      companyName: trimmedCompany || normalizeTicker(tickerHint),
    };
  }

  const knownTicker = KNOWN_COMPANY_TICKERS[trimmedCompany.toLowerCase()];
  if (knownTicker) {
    return {
      ticker: knownTicker,
      companyName: trimmedCompany || knownTicker,
    };
  }

  const inferred = inferTickerFromCompanyInput(trimmedCompany);
  if (inferred) {
    return {
      ticker: inferred,
      companyName: trimmedCompany || inferred,
    };
  }

  const resolved = await resolveTickerFromYahooQuery(trimmedCompany);
  if (!resolved) return null;

  return {
    ticker: resolved.ticker,
    companyName: resolved.companyName ?? (trimmedCompany || resolved.ticker),
  };
}

function buildGenericBaseResult(ticker: string, companyName: string, timeframe: TimeFrame): AnalysisResult {
  return {
    ticker,
    companyName,
    timeframe,
    direction: "flat",
    alphaScore: 0,
    culturalScore: 0,
    financialScore: 0,
    forumMomentumScore: 0,
    metrics: emptyMetrics(),
    culturalSignals: [],
    forumChart: buildUnavailableForumChart(timeframe, 0),
    reasoning: [],
    summary: "",
    sources: [],
  };
}

function fmtPct(v: number): string {
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function fmtCompact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  return v.toFixed(0);
}

function buildFinancialOnlySynthesis(
  companyName: string,
  timeframe: TimeFrame,
  metrics: FinancialMetrics
): { summary: string; reasoning: ReasoningPoint[] } {
  const tfLabel = quarterLabel(timeframe);
  const directionWord =
    metrics.priceChangePercent > 1 ? "positive" : metrics.priceChangePercent < -1 ? "negative" : "mixed";

  const summaryParts: string[] = [
    `${companyName} showed a ${directionWord} setup in ${tfLabel} based on available Yahoo Finance metrics.`,
    `Price moved ${fmtPct(metrics.priceChangePercent)} for the selected period.`,
    "Interpretation is limited to metrics available in the current data pipeline for this period.",
  ];

  if (metrics.epsSurprisePercent != null) {
    summaryParts.push(
      `EPS surprise was ${fmtPct(metrics.epsSurprisePercent)} (${metrics.epsSurprisePercent >= 0 ? "beat" : "miss"}).`
    );
  }
  if (metrics.revenueSurprisePercent != null) {
    summaryParts.push(
      `Revenue surprise was ${fmtPct(metrics.revenueSurprisePercent)} (${metrics.revenueSurprisePercent >= 0 ? "beat" : "miss"}).`
    );
  }

  const reasoning: ReasoningPoint[] = [];
  reasoning.push({
    category: "financial",
    text: `Price change for the selected quarter/year is ${fmtPct(metrics.priceChangePercent)}. Why it matters: this anchors direction and indicates whether other signals are being confirmed or contradicted by market movement.`,
    sources: [],
  });

  if (metrics.epsSurprisePercent != null) {
    reasoning.push({
      category: "financial",
      text: `EPS surprise is ${fmtPct(metrics.epsSurprisePercent)} (${metrics.epsSurprisePercent >= 0 ? "earnings beat estimates" : "earnings missed estimates"}). Why it matters: surprise magnitude helps explain whether expectations were reset upward or downward.`,
      sources: [],
    });
  }

  if (metrics.revenueSurprisePercent != null) {
    reasoning.push({
      category: "financial",
      text: `Revenue surprise is ${fmtPct(metrics.revenueSurprisePercent)} (${metrics.revenueSurprisePercent >= 0 ? "revenue beat estimates" : "revenue missed estimates"}). Why it matters: revenue surprise informs whether demand strength supports the current narrative.`,
      sources: [],
    });
  }

  if (metrics.fcfChangeQoQ != null) {
    reasoning.push({
      category: "financial",
      text: `Free cash flow changed ${fmtPct(metrics.fcfChangeQoQ)} quarter-over-quarter. Why it matters: cash-flow direction helps validate earnings quality and balance-sheet flexibility.`,
      sources: [],
    });
  }

  const valuationBits: string[] = [];
  if (metrics.peRatio != null) valuationBits.push(`P/E ${metrics.peRatio.toFixed(2)}x`);
  if (metrics.pegRatio != null) valuationBits.push(`PEG ${metrics.pegRatio.toFixed(2)}`);
  if (metrics.priceToBook != null) valuationBits.push(`P/B ${metrics.priceToBook.toFixed(2)}x`);
  if (metrics.priceToSalesTtm != null) valuationBits.push(`P/S ${metrics.priceToSalesTtm.toFixed(2)}x`);
  if (metrics.enterpriseToEbitda != null) valuationBits.push(`EV/EBITDA ${metrics.enterpriseToEbitda.toFixed(2)}x`);

  if (valuationBits.length > 0) {
    reasoning.push({
      category: "financial",
      text: `Valuation snapshot: ${valuationBits.join(" · ")}. Why it matters: valuation multiples frame how much optimism or pessimism is already reflected in price.`,
      sources: [],
    });
  }

  return {
    summary: summaryParts.join(" "),
    reasoning: reasoning.slice(0, 4),
  };
}

function isMetricKey(value: string): value is DisplayedMetricKey {
  return DISPLAYED_METRIC_KEYS.includes(value as DisplayedMetricKey);
}

function metricValueText(key: DisplayedMetricKey, metrics: FinancialMetrics): string {
  const value = metrics[key];
  if (value == null) return "unavailable in current pipeline";
  if (key === "enterpriseValue") return fmtCompact(value);
  if (key === "priceChangePercent" || key === "epsSurprisePercent" || key === "revenueSurprisePercent" || key === "dividendChangePercent" || key === "fcfChangeQoQ") {
    return fmtPct(value);
  }
  if (key === "peRatio" || key === "priceToBook" || key === "priceToSalesTtm" || key === "enterpriseToEbitda") return `${value.toFixed(2)}x`;
  return value.toFixed(2);
}

function fallbackWhyItMatters(key: DisplayedMetricKey): string {
  if (key === "priceChangePercent") return "This anchors short-horizon direction and helps confirm whether the rest of the evidence aligns with observed market behavior.";
  if (key === "epsSurprisePercent") return "Earnings surprise changes near-term expectations and can influence how investors reprice future profitability.";
  if (key === "revenueSurprisePercent") return "Revenue surprise is a direct signal of demand strength versus consensus assumptions.";
  if (key === "dividendChangePercent") return "Dividend adjustments can indicate management confidence in recurring cash generation and capital allocation priorities.";
  if (key === "fcfChangeQoQ") return "Free cash flow trend supports or weakens the quality of the earnings story by showing realized cash generation.";
  if (key === "peRatio") return "P/E contextualizes how expensive or cheap earnings are being priced relative to current profitability.";
  if (key === "pegRatio") return "PEG links valuation to expected growth, helping distinguish justified premium from pure multiple expansion.";
  if (key === "priceToBook") return "Price/Book helps assess whether valuation is stretched relative to the accounting asset base.";
  if (key === "priceToSalesTtm") return "Price/Sales indicates how aggressively top-line revenue is currently being valued by the market.";
  if (key === "enterpriseValue") return "Enterprise value captures total firm value and improves comparability beyond equity market cap alone.";
  return "EV/EBITDA frames valuation versus operating cash earnings and helps benchmark capital-structure-adjusted expensiveness.";
}

function isUnavailableNarrative(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("unavailable in the current pipeline") ||
    lower.includes("cannot use it as explanatory evidence") ||
    lower.includes("does not imply the company did not report") ||
    lower.includes("did not report")
  );
}

function normalizeUnavailableWording(text: string): string {
  if (!text) return text;
  let out = text;
  out = out.replace(
    /\b(company|issuer)\s+(has\s+)?(not|n't)\s+reported\b[^.]*\.?/gi,
    "This value is unavailable in the current pipeline for this period, so we cannot use it as explanatory evidence; this does not imply the company did not report it."
  );
  out = out.replace(
    /\b(did\s+not\s+report|not\s+reported)\b[^.]*\.?/gi,
    "Unavailable in the current pipeline for this period; this does not imply company non-reporting."
  );
  return out;
}

function enrichSummary(summary: string, result: AnalysisResult): string {
  const cleaned = normalizeUnavailableWording(summary).trim();
  if (cleaned.length >= 360) return cleaned;
  const unavailable = DISPLAYED_METRIC_KEYS.filter((k) => result.metrics[k] == null).map((k) => METRIC_LABEL[k]);
  const caveat =
    unavailable.length === 0
      ? "All currently displayed metrics were usable in this interpretation, but the synthesis remains bounded to the provided dataset only."
      : `Some displayed metrics were unavailable in the current pipeline (${unavailable.join(", ")}), so they could not be used as explanatory evidence; this does not imply the company did not report them.`;
  return `${cleaned} ${caveat}`.trim();
}

async function getGroqSynthesis(result: AnalysisResult): Promise<{ payload: LlmSynthesisResponse | null; error: string | null }> {
  try {
    const displayedMetrics = DISPLAYED_METRIC_KEYS.reduce<Record<string, number | null>>((acc, key) => {
      acc[key] = result.metrics[key];
      return acc;
    }, {});

    const displayedCulturalSignals = result.culturalSignals.map((signal, idx) => ({
      index: idx + 1,
      date: signal.date,
      sentiment: signal.sentiment,
      text: signal.text,
      source: signal.source,
    }));

    const res = await fetch("/alpha-synthesis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker: result.ticker,
        companyName: result.companyName,
        timeframe: result.timeframe,
        displayedMetricKeys: DISPLAYED_METRIC_KEYS,
        displayedMetrics,
        displayedCulturalSignals,
      }),
    });

    if (!res.ok) {
      const detail = await extractErrorDetail(res, `LLM synthesis request failed (${res.status})`);
      return { payload: null, error: detail };
    }

    const payload = (await res.json()) as LlmSynthesisResponse;
    if (!payload || typeof payload.summary !== "string" || !Array.isArray(payload.reasoning)) {
      return { payload: null, error: "LLM returned invalid synthesis payload" };
    }

    const seenMetricKeys = new Set<DisplayedMetricKey>();
    const seenSignalIdx = new Set<number>();
    const validReasoning: LlmReasoningItem[] = [];

    for (const raw of payload.reasoning) {
      if (!raw || typeof raw.insight !== "string" || typeof raw.whyItMatters !== "string") continue;
      const metricCitations = Array.isArray(raw.metricCitations)
        ? raw.metricCitations.filter(
            (k): k is DisplayedMetricKey =>
              typeof k === "string" && isMetricKey(k) && result.metrics[k] != null
          )
        : [];
      const culturalSignalCitations = Array.isArray(raw.culturalSignalCitations)
        ? raw.culturalSignalCitations.filter((idx): idx is number => Number.isInteger(idx) && idx >= 1 && idx <= result.culturalSignals.length)
        : [];
      if (metricCitations.length === 0 && culturalSignalCitations.length === 0) continue;
      let insight = normalizeUnavailableWording(raw.insight.trim());
      let whyItMatters = normalizeUnavailableWording(raw.whyItMatters.trim());
      if (isUnavailableNarrative(insight) || isUnavailableNarrative(whyItMatters)) continue;
      metricCitations.forEach((k) => seenMetricKeys.add(k));
      culturalSignalCitations.forEach((idx) => seenSignalIdx.add(idx));
      validReasoning.push({
        insight,
        whyItMatters,
        metricCitations,
        culturalSignalCitations,
      });
    }

    if (validReasoning.length === 0) {
      return { payload: null, error: "LLM returned no valid cited reasoning items" };
    }

    const availableMetricKeys = DISPLAYED_METRIC_KEYS.filter((k) => result.metrics[k] != null);
    const missingMetricKeys = availableMetricKeys.filter((k) => !seenMetricKeys.has(k));
    for (const key of missingMetricKeys) {
      validReasoning.push({
        insight: `${METRIC_LABEL[key]} is ${metricValueText(key, result.metrics)}.`,
        whyItMatters: fallbackWhyItMatters(key),
        metricCitations: [key],
        culturalSignalCitations: [],
      });
    }

    const missingSignalIdx: number[] = [];
    for (let idx = 1; idx <= result.culturalSignals.length; idx++) {
      if (!seenSignalIdx.has(idx)) missingSignalIdx.push(idx);
    }
    for (const idx of missingSignalIdx) {
      const sig = result.culturalSignals[idx - 1];
      validReasoning.push({
        insight: `Cultural signal ${idx}: ${sig.text}`,
        whyItMatters: "It captures external narrative pressure that can affect sentiment and positioning.",
        metricCitations: [],
        culturalSignalCitations: [idx],
      });
    }

    return {
      payload: {
        summary: enrichSummary(payload.summary, result),
        reasoning: validReasoning.slice(0, 10),
      },
      error: null,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "LLM synthesis request failed";
    return { payload: null, error: detail };
  }
}

function makeErrorResult(base: AnalysisResult, timeframe: TimeFrame, message: string): AnalysisResult {
  const unavailable = `Unavailable: ${message}`;
  return {
    ...base,
    timeframe,
    alphaScore: 0,
    culturalScore: 0,
    financialScore: 0,
    forumMomentumScore: 0,
    direction: "flat",
    metrics: emptyMetrics(),
    culturalSignals: [],
    summary: "",
    reasoning: [],
    sources: [],
    forumChart: buildUnavailableForumChart(timeframe, 0),
    dataErrors: {
      scorecard: unavailable,
      forumChart: unavailable,
      financial: unavailable,
      cultural: unavailable,
      synthesis: unavailable,
      sources: unavailable,
    },
  };
}

async function extractErrorDetail(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string" && data.detail.trim()) return data.detail;
    return fallback;
  } catch {
    return fallback;
  }
}

async function buildLiveResultFromBase(
  base: AnalysisResult,
  timeframe: TimeFrame
): Promise<AnalysisResult> {
  try {
    const params = new URLSearchParams({
      ticker: base.ticker,
      quarter: String(timeframe.quarter),
      year: String(timeframe.year),
    });
    const res = await fetch(`/yahoo-metrics?${params.toString()}`);
    if (!res.ok) {
      const detail = await extractErrorDetail(res, `Yahoo metrics request failed (${res.status})`);
      return makeErrorResult(base, timeframe, `Financial fetch error: ${detail}`);
    }
    const payload = (await res.json()) as YahooMetricsResponse;
    if (!payload?.metrics) {
      return makeErrorResult(base, timeframe, "Financial fetch error: invalid Yahoo metrics payload");
    }

    const liveDirection: AnalysisResult["direction"] =
      payload.metrics.priceChangePercent > 1
        ? "up"
        : payload.metrics.priceChangePercent < -1
          ? "down"
          : "flat";
    const livePriceChart = sanitizePriceChart(payload.priceChart, timeframe, payload.metrics.priceChangePercent);

    const resultWithLiveMetrics: AnalysisResult = {
      ...base,
      timeframe,
      direction: liveDirection,
      alphaScore: 0,
      culturalScore: 0,
      financialScore: 0,
      forumMomentumScore: 0,
      metrics: payload.metrics,
      culturalSignals: [],
      forumChart: livePriceChart ?? buildUnavailableForumChart(timeframe, payload.metrics.priceChangePercent),
      ...buildFinancialOnlySynthesis(base.companyName, timeframe, payload.metrics),
      sources: [],
      dataErrors: {
        scorecard: "Score block is hidden because alpha/cultural/forum scoring is not yet computed from live feeds.",
        forumChart: livePriceChart ? undefined : "Stock price chart is unavailable for this ticker/quarter from Yahoo Finance.",
        cultural: "Cultural signals hidden: live cultural feed is not connected.",
        sources: "Sources panel hidden: no live source ingestion is connected.",
      },
    };

    const { payload: llm, error: llmError } = await getGroqSynthesis(resultWithLiveMetrics);
    if (!llm) {
      return {
        ...resultWithLiveMetrics,
        dataErrors: {
          ...resultWithLiveMetrics.dataErrors,
          synthesis: `Synthesis error: ${llmError ?? "unknown LLM failure"}`,
        },
      };
    }

    const mappedReasoning: ReasoningPoint[] = llm.reasoning
      .filter((item) => !isUnavailableNarrative(`${item.insight} ${item.whyItMatters}`))
      .map((item) => {
        const combined = `${item.insight} Why it matters: ${item.whyItMatters}`.trim();

        return {
          text: combined,
          category: (item.culturalSignalCitations?.length ?? 0) > 0 ? "cultural" : "financial",
          sources: [],
        };
      });

    return {
      ...resultWithLiveMetrics,
      summary: llm.summary,
      reasoning: mappedReasoning.length > 0 ? mappedReasoning : resultWithLiveMetrics.reasoning,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unexpected data fetch failure";
    return makeErrorResult(base, timeframe, detail);
  }
}

export async function getDemoResultWithLiveMetrics(
  key: string,
  timeframe: TimeFrame
): Promise<AnalysisResult | null> {
  const base = DEMO_RESULTS[key];
  if (!base) return null;
  return buildLiveResultFromBase(base, timeframe);
}

export async function getAnyStockResultWithLiveMetrics(
  request: AnalysisRequest
): Promise<AnalysisResult> {
  const companyKey = request.company.trim().toLowerCase();
  const demoKey = DEMO_KEY_MAP[companyKey];
  if (demoKey) {
    const demoResult = await getDemoResultWithLiveMetrics(demoKey, request.timeframe);
    if (demoResult) return demoResult;
  }

  const resolved = await resolveTickerAndCompany(request.company, request.ticker);
  if (!resolved) {
    const fallbackTicker = inferTickerFromCompanyInput(request.company) ?? "UNKNOWN";
    const base = buildGenericBaseResult(
      fallbackTicker,
      request.company.trim() || fallbackTicker,
      request.timeframe
    );
    return makeErrorResult(
      base,
      request.timeframe,
      `Could not resolve a valid ticker for "${request.company}". Enter a ticker symbol (example: AAPL).`
    );
  }

  const base = buildGenericBaseResult(resolved.ticker, resolved.companyName, request.timeframe);
  return buildLiveResultFromBase(base, request.timeframe);
}
