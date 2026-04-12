# AIStockScreener

## SDxUCSD Agent Hackathon — Project Brief

**Concept**

We're building an AI-powered stock intelligence platform where users interact through natural language. The system interprets open-ended financial queries, reasons about which data to fetch and when, and surfaces either a shortlist of relevant stocks or a deep single-stock analysis depending on what the user asked. Key framing: we are not predicting — we are surfacing signal intelligence and narrative explanation. This keeps the product defensible and genuinely educational.

---

**Sponsor Integration**

Forum (YC W26) provides cultural attention scores for each stock. Every stock surface in the product, whether in a shortlist or a detailed view, displays a Forum Attention Score pulled from their API. This is a lightweight but persistent integration that runs alongside every other output.

Nozomio's Nia (YC S25) is the document intelligence layer. Once a stock reaches the detailed analysis stage, Nia indexes the company's 10-K filing retrieved from EDGAR and serves as the semantic search layer that the agent queries for specific sections like risk factors, revenue discussion, and MD&A. This is what allows the analysis to go beyond surface metrics and into the actual language of the financial report.

Omnara (YC S25) was used as the development environment for scaffolding this application.

---

**Two User Flows**

**Flow A — Discovery Query**

The user submits a natural language query like "Give me a stock that is undervalued, stable, and has positive growth over the last 6 months." The reasoning agent interprets this, maps it to concrete financial metrics, and uses yfinance to screen for 5-10 stocks that match. Each result is displayed as a card showing key valuation metrics and a Forum Attention Score. If the user clicks into a stock, the system transitions to Flow B.

**Flow B — Deep Analysis**

Triggered either by a direct query like "Give me a detailed analysis on the Nike stock" or by a user clicking into a stock from Flow A. The EDGAR agent fetches the most recent 10-K for the company, indexes it into Nia, and the document agent queries relevant sections semantically. In parallel, yfinance pulls the full set of valuation and financial metrics. The output combines a structured metrics view with a narrative analysis drawn from the actual financial documents, plus the Forum Attention Score.

---

**Agentic Architecture**

The system is a reasoning loop, not a fixed pipeline. The orchestrator agent receives the user's query and decides which tools to invoke and in what order based on what the query requires.

Available tools the agent can call:
- **Screener tool** — queries yfinance across a filtered universe of stocks based on metrics the agent derives from the user's natural language input. Used in Flow A.
- **Metrics tool** — pulls valuation and financial metrics for a specific ticker via yfinance. Used in both flows.
- **EDGAR tool** — fetches the most recent 10-K filing for a given company from the SEC EDGAR API.
- **Nia document tool** — indexes the retrieved 10-K into Nia and runs semantic search queries against specific sections. Used in Flow B.
- **Forum tool** — pulls the cultural attention score for any given ticker. Runs in both flows.

The agent evaluates after each tool call whether it has sufficient signal to proceed or whether it needs to query another tool. For example, if the metrics for a screened stock look anomalous, the agent can choose to pull and query the 10-K before surfacing it to the user. This conditional, iterative behavior is what makes the system agentic rather than a scripted sequence of API calls.

---

**Financial Metrics**

P/E ratio, revenue growth QoQ, short interest %, analyst sentiment score, and insider trading activity. All sourced via yfinance. For Flow A screening, the agent selects the subset of metrics most relevant to the user's query rather than always pulling all five.

---

**Demo Scope**

Two demo examples should be hardcoded and tested before the event. One should be a discovery query that surfaces a clean shortlist with visible metric reasoning. The other should be a direct deep-analysis query on a well-known stock where the 10-K narrative adds something the metrics alone don't show. Judges care about a clean demo over broad coverage.

Never use the word "prediction" anywhere in the product or pitch. The platform does signal intelligence and narrative explanation. The moment you say prediction, judges will ask about backtesting and there is no answer for that.

---

**Tonight's checklist before the hackathon:** Get API keys for Forum, Nia, and EDGAR ready before you show up. Pre-select 2-3 demo tickers and verify yfinance returns clean data for them. Confirm Nia can index a document source and return semantic search results before building around it.
