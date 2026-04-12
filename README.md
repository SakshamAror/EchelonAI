# AIStockScreener

## SDxUCSD Agent Hackathon — Project Brief

**Concept**

We're building an educational platform where users input a cultural term or company name alongside a time frame (per month), and the system explains why that term's value on Forum moved the way it did. It combines cultural news signals with financial metrics into a unified analysis. Key framing: we are not predicting — we are surfacing signal intelligence and narrative explanation. This keeps the product defensible and genuinely educational.

---

**Sponsor Integration**

Forum (YC W26) is our primary data source. We query their database for the cultural term's attention/price history over the selected month. This is the core input — what moved and when.

Nozomio's Nia (YC S25) is our search and retrieval layer. We use Nia to index and retrieve articles and content from the selected time window that explain why the term moved. This is the cultural signal layer. We need to test date-range support on day 1 before building around it.

Omnara (YC S25) was used as the development environment for scaffolding this application.

---

**User Flow**

The user inputs a term and a month (e.g. "Nike", October 2024). We pull Forum's attention and price movement for that term over the selected month. Nia then retrieves news articles and cultural events from that same window. In parallel, we pull five financial metrics for company terms. Finally an LLM synthesizes everything into a Cultural Score (0–100) and Financial Score (0–100), combined into a single Forum Alpha Score with a directional arrow, bullet-point reasoning, and cited sources.

---

**Search Layer — Web Retrieval**

Primary is Nia. Test it immediately day 1 with a real historical query. If it returns clean dated article content, use it. If not, fall back immediately — don't build around a broken integration.

Fallback A is Tavily. Generous free tier, search_depth="advanced" pulls full article content, plug-and-play for LLM pipelines. The issue is that its days parameter counts back from today rather than supporting true date ranges, so it's fine if approximate but problematic if you need clean per-month isolation.

Fallback B is Exa. Supports exact start_published_date and end_published_date parameters. Best choice if clean month isolation matters. This is the deciding factor — if per-month precision is important, use Exa over Tavily.

Do not use Browser Use for this project. It's too slow, too fragile for a live demo, and we don't need to navigate pages interactively. Wrong tool for this job.

---

**Draft Search Prompt**

"Search for news articles, financial coverage, and significant events related to [TERM] between [START_DATE] and [END_DATE]. Focus on major news events that impacted public perception, controversies, launches, or announcements, cultural moments or viral events involving the term, and analyst or media sentiment shifts. Return the most relevant sources with publication dates."

This prompt goes to Nia/Exa/Tavily for retrieval. The results then get passed to the LLM which does the actual reasoning and scoring. The search tool is purely the retrieval layer.

---

**Pitfalls and Mitigations**

If Nia doesn't support live web fetch, swap to Exa or Tavily immediately. Still mention Nia in the architecture for judging criteria — frame it as the context and embedding layer.

If Tavily's date filtering is too approximate, switch to Exa. Make this decision early and don't mix the two.

If the financial and cultural outputs feel like two separate reports bolted together, the fix is combining them into a single Forum Alpha Score with one directional signal. The output must be unified, not side by side.

If scope feels too wide, hardcode 2–3 demo examples that work perfectly. Judges care about a clean demo over broad coverage.

Never use the word "prediction" anywhere — not in the product, not in the pitch. We are an educational platform doing signal intelligence. The moment you say prediction, judges will ask about backtesting and you have no answer.

---

**Financial Metrics (locked in)**

P/E ratio, revenue growth QoQ, short interest %, analyst sentiment score, and insider trading activity. All publicly available via yfinance or Polygon.io. For cultural terms that aren't companies, skip the financial layer entirely and go deeper on cultural momentum instead.

---

**Demo Scope**

User types a term → Forum price history pulled → Nia or Exa retrieves articles from that month → five financial metrics pulled if it's a company → unified Alpha Score generated with bullet reasoning and cited sources → directional signal output on cultural attention. That's the full loop and it's clean enough to demo confidently.

---

**Tonight's checklist before the hackathon:** Get API keys for Forum, Nia, and Exa or Tavily ready before you show up. Decide on Exa vs Tavily based on whether you need true date range filtering. Agree on which 2–3 hardcoded demo examples you'll use so you're not scrambling for test cases during the event.
