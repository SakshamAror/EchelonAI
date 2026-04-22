# EchelonAI — Cultural Signal Intelligence Platform

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white">
  <img alt="TailwindCSS" src="https://img.shields.io/badge/Tailwind-3-38B2AC?logo=tailwind-css&logoColor=white">
  <img alt="Python" src="https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white">
  <img alt="Groq" src="https://img.shields.io/badge/Groq-Llama_3.3_70B-F55036">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue">
</p>

> **Not prediction. Not noise. Cultural + financial signal, unified.**

---

## The Problem

When a stock moves sharply in a quarter, the answer is rarely just in the numbers. Revenue beat, but the stock dropped. EPS missed, but it held. Understanding *why* requires combining financial metrics, news sentiment, competitor context, and macro narrative — data that lives across earnings reports, news feeds, and analyst commentary.

Most tools give you either raw financial data or a news feed. Neither explains the full picture. EchelonAI unifies both into a single retrospective view: *why did this stock move the way it did?*

---

## What It Does

Enter any publicly listed stock and a calendar quarter. EchelonAI runs a multi-agent pipeline that:

1. Fetches real financial metrics (P/E, ROE, margins, FCF, debt ratios, growth rates) via yfinance
2. Pulls news articles from reputable outlets via Tavily, scores sentiment, and filters for company relevance
3. Charts the stock's quarterly price performance against the S&P 500 benchmark
4. Synthesizes everything into a past-tense retrospective via Groq LLM (Llama 3.3 70B), grounded only in the fetched data

No speculation. No predictions. Signal intelligence, after the fact.

---

## Features

**Equity Search**
Live Yahoo Finance autocomplete for any publicly listed stock globally.

**Quarterly Price Chart with S&P 500 Benchmark**
Direction-aware stock price line (green if the quarter was positive, red if negative) overlaid with a dashed S&P 500 comparison line. Shows OUTPERFORMING / UNDERPERFORMING / IN LINE verdict with exact basis-point spread.

**Financial Metrics — Categorized**
30+ financial metrics grouped into sections: Valuation, Profitability, Growth, Cash Flow, Balance Sheet, Dividend, Risk. Each metric includes an expandable definition explaining what it means and what thresholds matter. Significant readings are color-coded; neutral values stay uncolored.

**Cultural Signals**
News articles from Reuters, Bloomberg, CNBC, WSJ, FT, BBC, The Guardian, AP News — fetched via Tavily, filtered for company relevance, sentiment-scored, and ranked by outlet traffic weight.

**Echelon Synthesis**
Groq LLM retrospective analysis grounded in the fetched data, with cited metric and signal bullets. Top signals visible by default; expand to see the full list. One-click copy to clipboard.

**Signal Overview**
Quarterly return % as the hero number, vs-S&P verdict and spread, directional indicator, and score bars (Echelon / Cultural / Financial).

**SEC Filing Highlights**
Links to the relevant 10-Q/10-K with extracted MD&A highlights for the selected quarter.

**Demo Mode**
Three pre-built examples — Nike Q3 2024, Nvidia Q3 2024, Tesla Q4 2023 — with live metric overlays fetched on demand. No API keys needed.

**Light / Dark Mode**
Full theme toggle with high-contrast signal colors in both modes.

---

## Tech Stack

### Frontend

| Technology | Version | Role |
|---|---|---|
| React | 18.3.1 | UI framework |
| TypeScript | 5.6.3 | Type safety |
| Vite | 8.0.8 | Dev server, build tool, API middleware |
| TailwindCSS | 3.4.15 | Utility-first styling |
| Lucide React | 0.460.0 | Icons |
| DM Mono | — | Primary monospace font |
| Bebas Neue | — | Display / numeric typography |
| Instrument Serif | — | Synthesis body copy |

### Data Pipeline

| Technology | Role |
|---|---|
| Python 3.12+ (`.venv`) | Agent pipeline runtime |
| yfinance | Financial metrics + quarterly OHLC price history + S&P 500 benchmark |
| Tavily Python SDK | Cultural signal web search |
| python-dotenv | Environment variable management |
| yahoo-finance2 (Node.js) | Equity ticker autocomplete + resolution |

### LLM

| Technology | Role |
|---|---|
| Groq API | LLM inference for Echelon Synthesis |
| `llama-3.3-70b-versatile` | Default synthesis model (configurable via `GROQ_MODEL`) |

---

## Architecture

```
User Input (company + quarter)
        │
        ▼
Yahoo Finance Autocomplete  ──►  Ticker Resolution
        │
        ▼
┌──────────────────────────────────────────────────┐
│             Python Agent Pipeline                │
│                                                  │
│  financial_agent.py                              │
│    └─ yfinance → P/E, ROE, margins,              │
│       FCF, debt/equity, growth rates,            │
│       quarterly income/cashflow/balance          │
│                                                  │
│  search_agent.py                                 │
│    └─ Tavily API → news articles                 │
│       (reputable domains, company-relevant only) │
│       → sentiment lexicon scoring                │
│       → outlet traffic weighting                 │
│                                                  │
│  fetch-agent-data.py  (bridge)                   │
│    └─ price chart + S&P 500 benchmark (yfinance) │
│    └─ deduplicates articles by URL               │
│    └─ computes Financial + Cultural scores       │
│    └─ 15-min in-memory cache (ticker:quarter)    │
│    └─ returns unified JSON payload               │
└──────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────┐
│              Groq LLM Synthesis                  │
│  Llama 3.3 70B  ·  JSON mode                     │
│  Past-tense retrospective for selected quarter   │
│  Grounded only in fetched data + citations       │
└──────────────────────────────────────────────────┘
        │
        ▼
Results UI
  ScoreCard → Synthesis → Chart + Signals → Metrics → SEC Filing → Sources
```

The Vite dev server exposes five middleware routes bridging the frontend to the data layer:

| Route | Handler | Purpose |
|---|---|---|
| `/agent-data` | `fetch-agent-data.py` | Full agent pipeline: metrics + signals + chart + scores |
| `/yahoo-metrics` | `fetch-yfinance-metrics.mjs` | Live yfinance metrics |
| `/yahoo-search` | `search-yahoo-equities.mjs` | Equity autocomplete |
| `/yahoo-resolve` | `resolve-yahoo-ticker.mjs` | Company name → ticker |
| `/alpha-synthesis` | Groq API (vite.config.ts) | LLM past-tense synthesis |

---

## Echelon Score

The Echelon Score (0–100) is a composite of two independently computed signals:

```
Echelon Score = 0.65 × Financial Score
              + 0.35 × Cultural Score
```

### Financial Score

Base score of 50, adjusted by clamped weighted contributions from each available metric:

| Metric | Weight | Direction |
|---|---|---|
| Revenue Growth | 60× | Higher → better |
| Earnings Growth | 60× | Higher → better |
| Return on Equity | 45× | Higher → better |
| Return on Assets | 80× | Higher → better |
| Profit Margins | 45× | Higher → better |
| Debt / Equity | 6× inverted | Lower → better |
| Trailing P/E | 0.7× inverted | Lower → better |
| Current Ratio | 6× (from 1.0) | Higher → better |

Each metric contribution is individually clamped to prevent any single reading from dominating the score. If a metric is unavailable for the period, it is skipped.

### Cultural Score

Sentiment-weighted score derived from reputable news articles, using outlet traffic as signal weight:

```
score = 78 + 40 × sentiment_index
           + 10 × polarity_ratio
           +  5 × impact_index
```

- **sentiment_index** — traffic-weighted average article sentiment (−1 to +1)
- **polarity_ratio** — (positive_weight − negative_weight) / total_weight
- **impact_index** — avg(relevance_scores) / 12, capped at 1.0
- A single outlet's weight is capped at 35% of total to prevent outsized influence

Reputable outlets: Reuters, Bloomberg, CNBC, Financial Times, WSJ, AP News, BBC, The Guardian

---

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.12+
- API keys: `GROQ_API_KEY`, `TAVILY_API_KEY` — or use Demo Mode without them

### Install

```bash
# Clone
git clone https://github.com/your-org/AIStockScreener.git
cd AIStockScreener/EchelonAI

# Install frontend dependencies
npm install

# Create Python virtual environment
python3 -m venv .venv
.venv/bin/pip install yfinance python-dotenv tavily-python
```

### Environment Variables

Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

```env
# Set to "false" to enable live analysis (default: true = demo mode)
VITE_USE_DEMO=true

# Required for live mode
GROQ_API_KEY=gsk_...
TAVILY_API_KEY=tvly-...

# Optional overrides
GROQ_MODEL=llama-3.3-70b-versatile
AGENT_PYTHON_BIN=.venv/bin/python
```

API keys are most easily added at runtime via the ⚙ Settings panel in the app — no `.env` file required for normal use.

### Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Project Structure

```
AIStockScreener/
├── EchelonAI/
│   ├── src/
│   │   ├── App.tsx                    # Root layout, state, loading orchestration
│   │   ├── index.css                  # Global styles, CSS variables, bar animation
│   │   ├── api/
│   │   │   ├── demo.ts                # Live data fetching + demo fixtures
│   │   │   └── index.ts               # API wrappers (analyzeStock)
│   │   ├── components/
│   │   │   ├── ScoreCard.tsx          # Quarterly return hero + vs-S&P verdict + score bars
│   │   │   ├── ForumChart.tsx         # Price chart w/ S&P benchmark (SVG + HTML labels)
│   │   │   ├── CulturalSignals.tsx    # Sentiment-colored signal cards (expandable)
│   │   │   ├── MetricsPanel.tsx       # Financial metrics grouped by category
│   │   │   ├── ResultsPanel.tsx       # Composes all result sections
│   │   │   ├── AgentProgress.tsx      # Animated loading overlay with step states
│   │   │   ├── SearchForm.tsx         # Equity search + quarter picker + ⌘Enter
│   │   │   ├── SecFilingPanel.tsx     # SEC 10-Q/10-K filing highlights
│   │   │   ├── SourcesList.tsx        # Cited sources list
│   │   │   ├── SettingsOverlay.tsx    # API key management (localStorage)
│   │   │   └── ErrorBoundary.tsx      # React error boundary for result sections
│   │   └── types/
│   │       └── index.ts               # TypeScript interfaces
│   ├── scripts/
│   │   ├── fetch-agent-data.py        # Main Python bridge (orchestrates agents + cache)
│   │   ├── fetch-yfinance-metrics.mjs # Live ticker metrics (Node)
│   │   ├── resolve-yahoo-ticker.mjs   # Company → ticker resolution (Node)
│   │   ├── search-yahoo-equities.mjs  # Equity autocomplete (Node)
│   │   └── agents/
│   │       ├── financial_agent.py     # yfinance: metrics, cashflow, balance sheet
│   │       └── search_agent.py        # Tavily search + relevance filter + sentiment scoring
│   ├── vite.config.ts                 # Dev middleware + Groq synthesis endpoint + cache
│   ├── .env.example                   # Environment variable reference
│   ├── .venv/                         # Python virtual environment
│   └── package.json
└── README.md
```

---

## Roadmap

EchelonAI is actively expanding. Planned directions include:

- **AI-driven stock screener** — surface stocks with unusual signal combinations across a universe of equities, rather than analyzing one at a time
- **Enhanced benchmarking** — deeper comparison against sector indices, peer groups, and factor benchmarks beyond the S&P 500
- **Sentiment-driven multi-factor simulation** — a forward-looking layer that models how current cultural and financial signal combinations have historically resolved, enabling hypothesis-driven scenario analysis

---

## Disclaimer

EchelonAI is an **educational signal intelligence tool**. It does not provide financial advice, investment recommendations, or predictions. All analysis is retrospective and based solely on publicly available data. Past signal patterns do not imply future outcomes.
