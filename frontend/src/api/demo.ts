// READ instructions.txt before editing this file.
// Hardcoded demo fixtures. Demo companies: Nike Sep 2024, Nvidia Aug 2024, Tesla Dec 2023

import type { AnalysisResult, FinancialMetrics, TimeFrame } from "@/types";

export const DEMO_RESULTS: Record<string, AnalysisResult> = {

  // ─── NIKE Sep 2024 ────────────────────────────────────────────────────────
  "NKE-9-2024": {
    ticker: "NKE",
    companyName: "Nike",
    timeframe: { month: 9, year: 2024 },
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
      { date: "Sep 7",  sentiment: "neg",     text: "Nike lowers FY25 revenue guidance; CEO Elliott Hill takes over amid DTC strategy pivot.", source: "Reuters · Bloomberg" },
      { date: "Sep 14", sentiment: "neutral",  text: "Viral TikTok campaign resurfaces \"Just Do It\" nostalgia; Jordan brand moment spikes organic search.", source: "Hypebeast · Nia Index" },
      { date: "Sep 22", sentiment: "neg",     text: "Short interest reaches 18-month high as institutional sell-off accelerates into quarter-end.", source: "WSJ · Forum Data" },
    ],
    forumChart: {
      points: [38, 42, 45, 52, 48, 55, 75, 88, 72, 58, 50],
      labels: ["Sep 1", "Sep 15", "Sep 30"],
      peakIndex: 7,
      peakLabel: "Sep 14",
      deltaForum: 34,
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

  // ─── NVIDIA Aug 2024 ──────────────────────────────────────────────────────
  "NVDA-8-2024": {
    ticker: "NVDA",
    companyName: "Nvidia",
    timeframe: { month: 8, year: 2024 },
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
      { date: "Aug 6",  sentiment: "pos", text: "Blackwell GPU shipment acceleration confirmed — hyperscaler orders surge beyond capacity.", source: "The Verge · Ars Technica" },
      { date: "Aug 22", sentiment: "pos", text: "Q2 FY2025 earnings: revenue $30B vs $28.6B est. Jensen Huang calls demand for AI compute \"insane\".", source: "Nvidia IR · Bloomberg" },
      { date: "Aug 28", sentiment: "pos", text: "14 of 15 sell-side analysts raise price targets post-earnings; retail forum volume hits all-time high.", source: "Reuters · Forum Data" },
    ],
    forumChart: {
      points: [55, 60, 65, 72, 78, 82, 88, 92, 98, 95, 94],
      labels: ["Aug 1", "Aug 15", "Aug 31"],
      peakIndex: 8,
      peakLabel: "Aug 22",
      deltaForum: 58,
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

  // ─── TESLA Dec 2023 ───────────────────────────────────────────────────────
  "TSLA-12-2023": {
    ticker: "TSLA",
    companyName: "Tesla",
    timeframe: { month: 12, year: 2023 },
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
      { date: "Dec 2",  sentiment: "neg",     text: "BYD officially surpasses Tesla in Q4 global EV deliveries for the first time — sustained negative press cycle begins.", source: "FT · Reuters" },
      { date: "Dec 11", sentiment: "neg",     text: "Elon Musk's X platform advertiser exodus intensifies; brand association risk elevated in brand safety surveys.", source: "NYT · Forum Data" },
      { date: "Dec 20", sentiment: "neutral",  text: "Cybertruck deliveries begin but ramp disappointingly slow; early reviews cite build quality concerns.", source: "Ars Technica · Nia Index" },
    ],
    forumChart: {
      points: [68, 62, 58, 52, 48, 45, 42, 38, 36, 33, 30],
      labels: ["Dec 1", "Dec 15", "Dec 31"],
      peakIndex: 0,
      peakLabel: "Dec 1",
      deltaForum: -22,
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

interface YahooMetricsResponse {
  ticker: string;
  timeframe: { month: number; year: number };
  metrics: FinancialMetrics;
}

interface GeminiReasoningItem {
  text: string;
  category: "financial" | "cultural" | "filing";
  sourceIndices: number[];
}

interface GeminiSynthesisResponse {
  summary: string;
  summarySourceIndices: number[];
  reasoning: GeminiReasoningItem[];
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

function makeErrorResult(base: AnalysisResult, timeframe: TimeFrame, message: string): AnalysisResult {
  return {
    ...base,
    timeframe,
    metrics: emptyMetrics(),
    culturalSignals: [],
    summary: "",
    reasoning: [],
    forumChart: {
      ...base.forumChart,
      deltaPrice: 0,
    },
    dataErrors: {
      financial: message,
      cultural: message,
      synthesis: message,
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

async function getGeminiSynthesis(
  result: AnalysisResult
): Promise<{ payload: GeminiSynthesisResponse | null; error: string | null }> {
  try {
    const res = await fetch("/alpha-synthesis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker: result.ticker,
        companyName: result.companyName,
        timeframe: result.timeframe,
        direction: result.direction,
        alphaScore: result.alphaScore,
        culturalScore: result.culturalScore,
        financialScore: result.financialScore,
        forumMomentumScore: result.forumMomentumScore,
        metrics: result.metrics,
        culturalSignals: result.culturalSignals,
        forumChart: result.forumChart,
        sources: result.sources,
      }),
    });
    if (!res.ok) {
      const detail = await extractErrorDetail(res, `Gemini synthesis request failed (${res.status})`);
      return { payload: null, error: detail };
    }
    const payload = (await res.json()) as GeminiSynthesisResponse;
    if (!payload?.summary || !Array.isArray(payload.reasoning) || !Array.isArray(payload.summarySourceIndices)) {
      return { payload: null, error: "Gemini returned invalid synthesis response" };
    }
    const sourceCount = result.sources.length;
    const isValidIdx = (idx: number) => Number.isInteger(idx) && idx >= 1 && idx <= sourceCount;
    const summaryHasCitations =
      payload.summarySourceIndices.length > 0 &&
      payload.summarySourceIndices.every(isValidIdx);
    if (!summaryHasCitations) {
      return { payload: null, error: "Gemini summary is missing valid source citations" };
    }

    for (const item of payload.reasoning) {
      if (!item?.text || !item?.category || !Array.isArray(item.sourceIndices)) {
        return { payload: null, error: "Gemini returned malformed reasoning item" };
      }
      if (item.sourceIndices.length === 0 || !item.sourceIndices.every(isValidIdx)) {
        return { payload: null, error: "Gemini reasoning contains invalid or missing source citations" };
      }
    }
    return { payload, error: null };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Gemini synthesis request failed";
    return { payload: null, error: detail };
  }
}

export async function getDemoResultWithLiveMetrics(
  key: string,
  timeframe: TimeFrame
): Promise<AnalysisResult | null> {
  const base = DEMO_RESULTS[key];
  if (!base) return null;

  try {
    const params = new URLSearchParams({
      ticker: base.ticker,
      month: String(timeframe.month),
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

    const resultWithLiveMetrics: AnalysisResult = {
      ...base,
      timeframe,
      metrics: payload.metrics,
      forumChart: {
        ...base.forumChart,
        deltaPrice: payload.metrics.priceChangePercent,
      },
      dataErrors: {
        cultural: "Cultural signals are still static demo data until live cultural pipeline is connected.",
      },
    };

    const { payload: synthesis, error: synthesisError } = await getGeminiSynthesis(resultWithLiveMetrics);
    if (!synthesis) {
      return {
        ...resultWithLiveMetrics,
        summary: "",
        reasoning: [],
        dataErrors: {
          ...resultWithLiveMetrics.dataErrors,
          synthesis: `Synthesis error: ${synthesisError ?? "unknown Gemini failure"}`,
        },
      };
    }

    const mappedReasoning = synthesis.reasoning
      .filter((item) => item?.text && item?.category)
      .map((item) => {
        const pickedSources = (item.sourceIndices ?? [])
          .map((idx) => resultWithLiveMetrics.sources[idx - 1])
          .filter(Boolean);
        return {
          text: item.text,
          category: item.category,
          sources: pickedSources.length > 0 ? pickedSources : resultWithLiveMetrics.sources.slice(0, 1),
        };
      });

    const summaryCitationTags = Array.from(new Set(synthesis.summarySourceIndices))
      .map((idx) => `[${idx}]`)
      .join("");

    return {
      ...resultWithLiveMetrics,
      summary: `${synthesis.summary} ${summaryCitationTags}`.trim(),
      reasoning: mappedReasoning.length > 0 ? mappedReasoning : resultWithLiveMetrics.reasoning,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unexpected data fetch failure";
    return makeErrorResult(base, timeframe, detail);
  }
}
