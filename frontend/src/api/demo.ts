// READ instructions.txt before editing this file.
// ─────────────────────────────────────────────────────────────────────────────
// Hardcoded demo fixtures for hackathon demo day.
// Use these when the backend is unavailable or for guaranteed clean demos.
// Demo companies: Nike Q3 2024, Nvidia Q2 2024, Tesla Q4 2023
// ─────────────────────────────────────────────────────────────────────────────

import type { AnalysisResult } from "@/types";

export const DEMO_RESULTS: Record<string, AnalysisResult> = {
  "NKE-Q3-2024": {
    ticker: "NKE",
    companyName: "Nike",
    timeframe: { quarter: "Q3", year: 2024 },
    direction: "down",
    alphaScore: 34,
    culturalScore: 28,
    financialScore: 41,
    metrics: {
      priceChangePercent: -19.6,
      peRatio: 20.4,
      revenueGrowthQoQ: -0.015,
      shortInterestPercent: 3.2,
      analystSentimentScore: 42,
      insiderTradingActivity: "light selling",
    },
    summary:
      "Nike declined sharply in Q3 2024 as weakening consumer demand in China and North America collided with margin pressure from elevated inventory levels. The brand's cultural momentum slowed amid rising competition from On Running and HOKA, while its 10-Q cited DTC headwinds and macro uncertainty as structural risks.",
    reasoning: [
      {
        text: "China revenue fell 6% YoY as post-COVID consumer recovery stalled and local brands gained shelf space.",
        category: "financial",
        sources: [
          { title: "Nike FY2024 Q3 10-Q — MD&A", url: "#", date: "2024-04-04", type: "filing" },
        ],
      },
      {
        text: "On Running and HOKA collectively grew market share by ~3 pts in running footwear, directly pressuring Nike's core segment.",
        category: "cultural",
        sources: [
          { title: "Bloomberg: Running Shoe Wars", url: "#", date: "2024-03-18", type: "news" },
        ],
      },
      {
        text: "Elevated inventory levels required heavy promotional activity, compressing gross margins by 150bps.",
        category: "financial",
        sources: [
          { title: "Nike Q3 Earnings Call Transcript", url: "#", date: "2024-04-04", type: "news" },
        ],
      },
      {
        text: "Paris Olympics buzz had not yet materialized into Q3 sales — the cultural tailwind was priced in but deferred.",
        category: "cultural",
        sources: [
          { title: "WSJ: Nike's Olympic Bet", url: "#", date: "2024-02-28", type: "news" },
        ],
      },
    ],
    sources: [
      { title: "Nike FY2024 Q3 10-Q", url: "#", date: "2024-04-04", type: "filing" },
      { title: "Bloomberg: Running Shoe Wars", url: "#", date: "2024-03-18", type: "news" },
      { title: "WSJ: Nike's Olympic Bet", url: "#", date: "2024-02-28", type: "news" },
    ],
  },

  "NVDA-Q2-2024": {
    ticker: "NVDA",
    companyName: "Nvidia",
    timeframe: { quarter: "Q2", year: 2024 },
    direction: "up",
    alphaScore: 91,
    culturalScore: 88,
    financialScore: 95,
    metrics: {
      priceChangePercent: 36.8,
      peRatio: 68.2,
      revenueGrowthQoQ: 0.152,
      shortInterestPercent: 0.9,
      analystSentimentScore: 94,
      insiderTradingActivity: "neutral",
    },
    summary:
      "Nvidia surged in Q2 2024 on the back of insatiable data center AI infrastructure demand. The H100 GPU remained the gold standard for LLM training, while Blackwell architecture announcements amplified cultural momentum across the AI investment narrative. Revenue beat by $2B and guidance was raised materially.",
    reasoning: [
      {
        text: "Data center revenue reached $22.6B, up 154% YoY, driven by hyperscaler AI infrastructure buildout.",
        category: "financial",
        sources: [
          { title: "Nvidia Q2 FY2025 10-Q", url: "#", date: "2024-08-28", type: "filing" },
        ],
      },
      {
        text: "Blackwell GPU architecture announcement generated outsized media coverage and developer community excitement.",
        category: "cultural",
        sources: [
          { title: "The Verge: Blackwell Unveiled", url: "#", date: "2024-03-18", type: "news" },
        ],
      },
      {
        text: "Analyst consensus target price revised upward by 14 of 15 covering analysts post-earnings.",
        category: "financial",
        sources: [
          { title: "Reuters: Nvidia Analyst Upgrades", url: "#", date: "2024-08-29", type: "news" },
        ],
      },
    ],
    sources: [
      { title: "Nvidia Q2 FY2025 10-Q", url: "#", date: "2024-08-28", type: "filing" },
      { title: "The Verge: Blackwell Unveiled", url: "#", date: "2024-03-18", type: "news" },
      { title: "Reuters: Nvidia Analyst Upgrades", url: "#", date: "2024-08-29", type: "news" },
    ],
  },

  "TSLA-Q4-2023": {
    ticker: "TSLA",
    companyName: "Tesla",
    timeframe: { quarter: "Q4", year: 2023 },
    direction: "down",
    alphaScore: 38,
    culturalScore: 45,
    financialScore: 31,
    metrics: {
      priceChangePercent: -13.2,
      peRatio: 47.1,
      revenueGrowthQoQ: 0.032,
      shortInterestPercent: 3.1,
      analystSentimentScore: 52,
      insiderTradingActivity: "light selling",
    },
    summary:
      "Tesla faced margin compression in Q4 2023 as aggressive price cuts sustained volume but eroded profitability. Cultural headwinds from Musk's continued X platform controversy dampened brand sentiment, while BYD officially surpassed Tesla in global EV deliveries — a significant symbolic and competitive milestone.",
    reasoning: [
      {
        text: "Auto gross margin fell to 17.6% from 25.1% a year prior due to price cut strategy and higher Cybertruck ramp costs.",
        category: "financial",
        sources: [
          { title: "Tesla Q4 2023 10-K", url: "#", date: "2024-01-26", type: "filing" },
        ],
      },
      {
        text: "BYD surpassed Tesla in Q4 global EV deliveries for the first time, generating sustained negative press coverage.",
        category: "cultural",
        sources: [
          { title: "FT: BYD Overtakes Tesla", url: "#", date: "2024-01-02", type: "news" },
        ],
      },
      {
        text: "Elon Musk's X platform controversies continued to generate brand association risk and advertiser backlash.",
        category: "cultural",
        sources: [
          { title: "NYT: Musk Brand Risk", url: "#", date: "2023-11-28", type: "news" },
        ],
      },
    ],
    sources: [
      { title: "Tesla Q4 2023 10-K", url: "#", date: "2024-01-26", type: "filing" },
      { title: "FT: BYD Overtakes Tesla", url: "#", date: "2024-01-02", type: "news" },
      { title: "NYT: Musk Brand Risk", url: "#", date: "2023-11-28", type: "news" },
    ],
  },
};
