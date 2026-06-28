# EchelonAI — Trust Foundation Plan (Anti-Hallucination + EDGAR/XBRL Grounding)

## Context

EchelonAI's wedge against generic LLM stock tools (ChatGPT/Perplexity) is **explainable, cited, honest analysis** — show the receipts and abstain when unsure. That is also the thing that makes analyses *shareable*, which is the main user-acquisition lever for a portfolio→real-users project in a crowded, partly-free market. This plan builds that trust layer. Everything later (voice chatbot, explainable screener, graph-RAG) sits on top of it and reuses its data substrate.

### What the code actually does today (verified)
- **Financial numbers:** `scripts/agents/financial_agent.py` pulls from **yfinance `.info`** — a *current, trailing-twelve-month, unversioned* dict. **Critical bug:** an analysis labeled "Q3 2024" is narrated with *today's* numbers, not the quarter's. This is a worse hallucination source than the LLM itself.
- **SEC filings:** `scripts/agents/sec_agent.py` finds the 10-Q via CIK→submissions JSON, then **regex-scrapes the HTML** for MD&A "highlights." It explicitly strips the `/ix?doc=` XBRL viewer wrapper — i.e. it ignores the structured XBRL data sitting right there.
- **Synthesis:** `vite.config.ts` → `buildSynthesisPrompt` + `callGroqSynthesis` (single Groq call). The prompt is *already* strict about grounding (rule 11: "no invented numbers, use only DATA"; citation segregation enforced). **But nothing verifies the output** — the model is asked not to hallucinate and trusted to comply.

### The reframed problem
"Fix hallucination" here is **three** distinct fixes, in priority order:
1. **Source-truth** — replace stale yfinance `.info` numbers with period-accurate XBRL `companyfacts` for the analyzed quarter. (Biggest correctness win; eliminates a whole error class regardless of the LLM.)
2. **Output verification** — a deterministic reconciliation pass that checks every number/claim the LLM emitted actually exists in DATA; flag or strip what doesn't. (Closes the trust gap the strict prompt leaves open.)
3. **Honest uncertainty** — confidence + explicit abstention ("insufficient data") instead of confident filler. (The shareable-trust feature.)

Graph RAG is **deliberately deferred** — it's the heavy tool for multi-hop questions across a filings corpus, and it only earns its keep once 1–3 exist and a real corpus is indexed. We build the corpus here; we add graph traversal later if multi-hop need is proven.

---

## RAG stack recommendation (you asked me to advise)

**Recommendation: lightweight, local, file/SQLite-based — no managed vector DB yet.**

- **Embeddings:** call an embeddings API rather than running a model in-process. Two viable options: (a) a hosted embeddings endpoint (keeps the container slim, no model download), or (b) local `sentence-transformers` if you want zero external calls. Given the deploy target is a container that *already* must carry Node+Python+venv, I lean **hosted embeddings API** to avoid a multi-hundred-MB model in the image and slow cold starts. Make the embedder a single swappable module so this choice is reversible.
- **Vector store:** **SQLite with the `sqlite-vec` extension** (or a flat numpy/JSON index for the very first cut). One file, ships in the container, zero new services, trivially backs up. A 10-Q is a handful of sections → tens of chunks; you do **not** need Pinecone/pgvector at portfolio scale, and adding a hosted DB now is cost + ops you don't need.
- **Migration path:** if real-user volume + cross-document/graph queries arrive, swap the store module for Supabase `pgvector` (you'll likely add Postgres anyway for the future follow/notify features). Designing the store behind one interface (`embed()` / `upsert()` / `query()`) makes that a contained change.

**Net new deps:** an embeddings client (Python) + `sqlite-vec` (or none, for the flat-index first cut). No new hosted service.

---

## Build plan

### Phase 1 — Source-truth: XBRL `companyfacts` as the primary number source

**Goal:** period-accurate, as-filed financial values for the specific quarter, with provenance (which filing, which period, filed-when).

New file **`scripts/agents/xbrl_agent.py`**:
- Reuse the existing CIK lookup from `sec_agent.py` (export `_get_cik` / refactor it into a shared `edgar_common.py` so both agents share it — avoid duplicating the EDGAR client + headers + rate-limit etiquette).
- Fetch `https://data.sec.gov/api/xbrl/companyfacts/CIK{cik10}.json` (full facts) or the leaner per-concept `companyconcept/CIK.../us-gaap/{Tag}.json`.
- Map the metrics EchelonAI displays to **US-GAAP tags** (e.g. `Revenues`/`RevenueFromContractWithCustomerExcludingAssessedTax`, `NetIncomeLoss`, `OperatingIncomeLoss`, `Assets`, `Liabilities`, `StockholdersEquity`, `EarningsPerShareDiluted`, etc.). Each fact carries `fy`/`fp`/`start`/`end`/`form`/`filed` — **select the value whose period matches the analyzed quarter**, not the latest.
- Compute ratios (ROE, margins, debt/equity, growth vs prior-year quarter) from these period-accurate primitives instead of reading yfinance's precomputed TTM ratios.
- Return each value tagged with **provenance**: `{ value, unit, periodEnd, form, accessionNumber, filed }`.

**Integration** (`scripts/fetch-agent-data.py`, `normalize_metrics` ~line 102, `compute_financial_score` ~line 305):
- Make XBRL the **primary** source; keep yfinance as a **labeled fallback** only for fields XBRL lacks (e.g. live price, market cap, P/E using current price — which legitimately *is* "current"). Tag every metric in the payload with a `source` field (`"xbrl" | "yfinance" | "computed"`) and `asOf` date.
- Keep prices on yfinance (price history is correctly time-ranged already in `build_price_chart`, ~line 148 — that part is fine).

**Payload/types:** extend the metric shape so each metric optionally carries `{ source, asOf, provenance }`. Touch `src/types/index.ts` and the `MetricsPanel.tsx` rendering to show a small source/as-of indicator (this *is* the trust UI — see Phase 4).

### Phase 2 — Filings corpus + grounded MD&A (replaces regex scraping)

**Goal:** the filing narrative the model sees (and a future chatbot answers from) is real, chunked, retrievable filing text — not regex fragments.

New file **`scripts/agents/filings_index.py`**:
- From the resolved primary 10-Q/10-K document (URL logic already in `sec_agent.py`), extract clean section text (MD&A, Risk Factors, financial statement notes). Prefer parsing the filing's structured documents over byte-capped regex; strip HTML to text per section.
- **Chunk** by section + token window, attach metadata `{ ticker, cik, accession, form, periodEnd, section, url }`.
- **Embed + upsert** into the local store (see RAG stack above) behind a small interface module **`scripts/rag/store.py`** (`embed`, `upsert`, `query`) and **`scripts/rag/embedder.py`**.
- For the current synthesis, **retrieve** the top-k MD&A chunks relevant to "quarterly results / drivers" and pass *those* (with their source URLs) as `displayedFilingHighlights` — replacing the regex highlights. Now every filing claim is quote-backed and linkable.

This index is the reusable substrate for the voice chatbot (answers grounded in it) and later graph-RAG (edges over the same chunks).

### Phase 3 — Output verification pass (the enforcement the prompt lacks)

**Goal:** deterministically catch any number/claim the LLM emitted that isn't in DATA.

In **`server/core.ts`** (after the backend extraction from the deployment plan — `callGroqSynthesis` lives there), add **`verifySynthesis(result, input)`**:
- **Numeric reconciliation:** extract every number/percentage from `summary` + `reasoning[].point`; for each, require a matching value in `input` (the displayed metrics / price delta / filing chunks) within a tolerance. Unmatched numbers → flag.
- **Citation integrity (tighten existing rules):** every `metricCitations` key ∈ `displayedMetricKeys`; every cultural/filing index valid; segregation holds. (The prompt asks for this; now we *enforce* it post-hoc.)
- **Action on failure:** start conservative — **strip** offending reasoning bullets and mark the summary with a verification note; optionally **one re-ask** ("these claims weren't supported by DATA: …; regenerate without them"). Log a `verification: { checked, flagged, dropped }` block.
- Return verification metadata to the frontend so the UI can show a "✓ verified against sources" / "N claims removed" badge.

Keep it cheap and mostly deterministic (regex + numeric match); use a second LLM call only for fuzzy semantic checks if needed, behind a flag.

### Phase 4 — Honest uncertainty + trust UI

- **Confidence/coverage score:** compute from data completeness (how many metrics had XBRL provenance vs missing, whether a filing was found, signal count). Surface as a small "data coverage" indicator on the `ScoreCard`/results header.
- **Abstention:** when coverage is below a threshold (no filing found, key metrics null), the synthesis should say so plainly rather than fill — wire this through the prompt *and* the verification pass (don't render confident bullets on thin data; rule 9/`NEVER write bullets about null metrics` already gestures at this — make it a hard gate).
- **Provenance UI** (the shareable trust signal): metrics show `source` + `asOf`; filing bullets link to the SEC document; the synthesis shows the verification badge. This is what makes an EchelonAI analysis visibly more trustworthy than a generic LLM answer — and worth sharing.

---

## Sequencing & dependency notes
- **Phases 1 → 2 → 3 → 4** is the natural order, but **Phase 1 (XBRL) is the single highest-value piece** and can ship alone for an immediate correctness jump.
- Phase 3 (`verifySynthesis`) assumes the backend has been extracted into `server/core.ts` per `DEPLOYMENT_PLAN.md`. If deploy hasn't happened yet, add `verifySynthesis` in `vite.config.ts` next to `callGroqSynthesis` and move it during extraction. **Recommend doing the deploy extraction first** so this code lands in its permanent home.
- Refactor the shared EDGAR client (`_get_cik`, headers, timeouts) into `scripts/agents/edgar_common.py` before Phases 1–2 to avoid duplicated SEC-etiquette code across `sec_agent`, `xbrl_agent`, `filings_index`.
- **SEC rate limits:** EDGAR asks for a descriptive User-Agent (present) and ≤10 req/s. XBRL + filing fetch + per-peer calls can add up — add simple throttling/caching in `edgar_common.py`; the existing `agentCache`/`peerCache` (15-min TTL) helps.

## New / changed files
**New:** `scripts/agents/xbrl_agent.py`, `scripts/agents/filings_index.py`, `scripts/agents/edgar_common.py`, `scripts/rag/store.py`, `scripts/rag/embedder.py`; `verifySynthesis` in `server/core.ts` (or `vite.config.ts` pre-deploy).
**Changed:** `scripts/fetch-agent-data.py` (XBRL primary, source tagging, coverage score), `scripts/agents/financial_agent.py` (demote to fallback), `scripts/agents/sec_agent.py` (share EDGAR client; hand off MD&A to filings_index), `src/types/index.ts` (metric provenance, verification meta, coverage), `src/components/MetricsPanel.tsx` + `ScoreCard.tsx` + `ResultsPanel.tsx` (provenance/verification/coverage UI), `requirements.txt` (embeddings client, `sqlite-vec` if used).

## Verification (end-to-end)
1. **Source-truth:** analyze a past quarter (e.g. AAPL Q3 2023) and confirm displayed revenue/EPS/margins match the **as-filed 10-Q** values (cross-check on SEC.gov), not current TTM. Each metric shows `source: xbrl` + correct `asOf`.
2. **Filings grounding:** confirm MD&A bullets are real sentences from the filing and link to the SEC document URL; no regex fragments.
3. **Verification pass:** inject a deliberately wrong number into a mocked Groq response → `verifySynthesis` flags/strips it and the badge reflects it. Confirm a clean response passes untouched.
4. **Abstention:** analyze a thinly-covered ticker (no 10-Q found / many null metrics) → app shows low coverage + says "insufficient data" instead of confident bullets.
5. **RAG store:** re-running the same filing doesn't re-embed (idempotent upsert); top-k retrieval returns on-topic chunks.

## Honest market note (recorded for context)
Realistic ceiling: a credible niche product with a devoted educational/prosumer following — not a Perplexity-killer. The trust foundation + shareable, cited, honest analyses is the wedge that *can* acquire those users; breadth features (follow/notify, ETFs/bonds) mainly *retain* them. Data-licensing cost and yfinance/scraping fragility are the real scaling constraints to watch.
