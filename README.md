# AIStockScreener

## SDxUCSD Agent Hackathon — Project Brief

**Concept**

We're building an educational stock intelligence platform where users input a company name and a time frame, and the system explains why that stock moved the way it did. It combines web-scraped cultural and news signals with financial and valuation metrics from yfinance, Forum attention data, and document-level analysis from SEC quarterly and annual filings into a unified explanation. Key framing: we are not predicting — we are educating users on what drove a stock's movement through cultural, social, and financial factors. This keeps the product defensible and genuinely educational.

---

**Sponsor Integration**

Forum (YC W26) is our cultural signal source. We query their API for the stock's attention data over the selected time frame, which feeds into the Cultural Score alongside web-scraped news and cultural context pulled by the web scraper tool.

Nozomio's Nia (YC S25) is our document intelligence layer. Once a stock is queried, the EDGAR agent fetches the most recent 10-Q and 10-K filings for that company and indexes them into Nia. The agent then semantically queries relevant sections — risk factors, MD&A, revenue discussion — to pull document-level reasoning that explains the stock's movement beyond what raw metrics alone can show.

Omnara (YC S25) was used as the development environment for scaffolding this application.

---

**User Flow**

The user inputs a company name and a time frame (e.g. "Nike", Q3 2024). The orchestrator agent reasons about what data it needs and calls the appropriate tools. yfinance pulls the stock's price movement and valuation metrics over that period. The web scraper pulls relevant news articles and cultural events from that period with cited sources. The EDGAR tool fetches the 10-Q and 10-K, indexes them into Nia, and the document agent queries sections relevant to the selected time frame. The LLM then synthesizes everything into a Cultural Score (0–100) and a Financial Score (0–100), combined into a single Alpha Score with a directional arrow, bullet-point reasoning, and cited sources that explain why the stock moved the way it did.

---

**Agentic Architecture**

The system is a reasoning loop, not a fixed pipeline. The orchestrator agent receives the user's input and decides which tools to invoke and in what order. It evaluates after each tool call whether it has enough signal to proceed or whether it needs to query further.

Available tools:
- **Metrics tool** — pulls stock price movement and valuation metrics (P/E ratio, revenue growth QoQ, short interest %, analyst sentiment, insider trading activity) for the given ticker and time frame via yfinance.
- **EDGAR tool** — fetches the most recent 10-Q and 10-K filings for the company from the SEC EDGAR API.
- **Nia document tool** — indexes the retrieved filing into Nia and runs semantic search queries against specific sections relevant to the time frame.
- **Web scraper tool** — pulls important news articles and cultural movements from the web relevant to the stock over the selected time period. Returns results with cited sources and publication dates so the LLM reasons only over grounded, attributable content rather than hallucinating cultural context. Details TBD.

The LLM is accessed via the Gemini API (Gemini 2.0 Flash) with function calling enabled. Tools are passed as function definitions and the agent loop runs until the LLM stops returning tool calls and produces the final scored output.

---

**Scoring Output**

Cultural Score (0–100) reflects web-scraped news, cultural events, and social momentum over the time frame, with all contributing sources cited so the LLM reasoning is fully grounded and attributable. Financial Score (0–100) reflects valuation metrics and document-level signals from the 10-K. These combine into a single Alpha Score with a directional arrow and bullet-point reasoning that cites specific cultural events, financial metrics, and filing language as contributing factors. The output educates the user on what actually drove the movement rather than just showing them a chart.

---

**Pitfalls and Mitigations**

If the financial and cultural outputs feel like two separate reports bolted together, the fix is combining them into a single Alpha Score with one directional signal. The output must be unified, not side by side.

If scope feels too wide, hardcode 2–3 demo examples that work perfectly. Judges care about a clean demo over broad coverage.

Never use the word "prediction" anywhere in the product or pitch. We are an educational platform doing signal intelligence. The moment you say prediction, judges will ask about backtesting and there is no answer for that.

---

**Financial Metrics (locked in)**

P/E ratio, revenue growth QoQ, short interest %, analyst sentiment score, and insider trading activity. All sourced via yfinance. These are displayed alongside the narrative explanation as concrete data points that support the agent's reasoning.

---

**Demo Scope**

User inputs a stock and time frame → orchestrator agent fires → yfinance pulls price movement and valuation metrics → web scraper pulls relevant news and cultural events from that period with cited sources → EDGAR fetches 10-Q and 10-K → Nia indexes and queries relevant sections → LLM synthesizes everything into a Cultural Score, Financial Score, and unified Alpha Score with bullet reasoning and cited sources. That's the full loop and it's clean enough to demo confidently.

---

**Tonight's checklist before the hackathon:** Get API keys for Nia, Gemini, Forum, and EDGAR (free, no key required) ready before you show up. Test each tool function in isolation before wiring them into the agent loop. Agree on 2–3 hardcoded demo examples with clear narratives so you're not scrambling for test cases during the event.
