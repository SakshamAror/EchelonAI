// READ instructions.txt before editing this file.
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { IncomingMessage } from "node:http";

const execFileAsync = promisify(execFile);

// Mutable runtime key state — populated by /settings endpoint, injected into subprocesses as env vars
const runtimeKeys = { groqApiKey: "", tavilyApiKey: "" };

// In-memory cache for /agent-data responses — avoids re-running Python on repeated queries
const agentCache = new Map<string, { data: string; ts: number }>();
const peerCache  = new Map<string, { data: string; ts: number }>();
const AGENT_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length < 12) return "***";
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

async function validateGroqKey(apiKey: string, model: string): Promise<{ valid: boolean; error?: string }> {
  if (!apiKey) return { valid: false, error: "No API key provided" };
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
    });
    if (res.ok) return { valid: true };
    const detail = await res.json().catch(() => ({})) as { error?: { message?: string } };
    return { valid: false, error: detail?.error?.message || `HTTP ${res.status}` };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

function validateTavilyFormat(key: string): { valid: boolean; error?: string } {
  if (!key) return { valid: false, error: "No API key provided" };
  if (!key.startsWith("tvly-")) return { valid: false, error: "Tavily keys must start with 'tvly-'" };
  if (key.length < 20) return { valid: false, error: "Key appears too short" };
  return { valid: true };
}

const yahooScriptPath = path.resolve(__dirname, "./scripts/fetch-yfinance-metrics.mjs");
const yahooResolveScriptPath = path.resolve(__dirname, "./scripts/resolve-yahoo-ticker.mjs");
const yahooSearchScriptPath = path.resolve(__dirname, "./scripts/search-yahoo-equities.mjs");
const agentDataScriptPath = path.resolve(__dirname, "./scripts/fetch-agent-data.py");
const peerDataScriptPath  = path.resolve(__dirname, "./scripts/fetch-peer-data.py");
const defaultAgentPythonPath = path.resolve(__dirname, "./.venv/bin/python");

interface AlphaSynthesisInput {
  ticker: string;
  companyName: string;
  timeframe: { quarter: number; year: number };
  displayedMetricKeys: string[];
  displayedMetrics: Record<string, number | null>;
  displayedCulturalSignals: Array<{
    index: number;
    date: string;
    sentiment: string;
    text: string;
    source: string;
  }>;
  /** 1-based indices; MD&A excerpts from 10-Q (empty when no filing text). */
  displayedFilingHighlights: Array<{ index: number; text: string }>;
  secFiling: {
    documentUrl: string;
    filingUrl: string;
    filingDate: string;
    periodOfReport: string;
    companyName: string;
  } | null;
  scores?: {
    financialScore: number;
    culturalScore: number;
    echelonScore: number;
  };
  priceDeltaPercent?: number;
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function buildSynthesisPrompt(input: AlphaSynthesisInput) {
  const hasFiling = input.displayedFilingHighlights.length > 0;
  const schema = {
    summary: "string",
    reasoning: [
      {
        point: "tied to financial metrics only",
        metricCitations: ["returnOnEquity"],
        culturalSignalCitations: [] as number[],
        filingHighlightCitations: [] as number[],
      },
      {
        point: "tied to news/cultural signals only",
        metricCitations: [] as string[],
        culturalSignalCitations: [1],
        filingHighlightCitations: [] as number[],
      },
      ...(hasFiling
        ? [
            {
              point: "tied to SEC MD&A excerpt only — paraphrase DATA.displayedFilingHighlights only",
              metricCitations: [] as string[],
              culturalSignalCitations: [] as number[],
              filingHighlightCitations: [1],
            },
          ]
        : []),
    ],
  };

  const priceContext = typeof input.priceDeltaPercent === "number"
    ? `Stock ${input.priceDeltaPercent >= 0 ? "rose" : "fell"} ${Math.abs(input.priceDeltaPercent).toFixed(2)}% over the quarter.`
    : "";

  const scoreContext = input.scores
    ? `Echelon scores — Financial: ${input.scores.financialScore.toFixed(1)}/100, Cultural: ${input.scores.culturalScore.toFixed(1)}/100, Overall: ${input.scores.echelonScore.toFixed(1)}/100.`
    : "";

  const sentimentCounts = input.displayedCulturalSignals.reduce(
    (acc, s) => { acc[s.sentiment] = (acc[s.sentiment] || 0) + 1; return acc; },
    {} as Record<string, number>
  );
  const sentimentSummary = Object.entries(sentimentCounts)
    .map(([k, v]) => `${v} ${k === "pos" ? "positive" : k === "neg" ? "negative" : "neutral"}`)
    .join(", ");

  const summaryStructure = hasFiling
    ? `1) summary: 7-10 sentences split into 3-4 paragraphs, each separated by a literal "\\n\\n". Structure:
   - Paragraph 1 (2-3 sentences): What happened to the stock overall — price direction, magnitude, and the single most dominant driver.
   - Paragraph 2 (2-3 sentences): The most impactful cultural signals. Name each signal by what it was about, quote or paraphrase its core claim, and explain concretely why and how it moved investor sentiment or the stock price.
   - Paragraph 3 (2 sentences): Management discussion in the 10-Q excerpts (DATA.displayedFilingHighlights only). Paraphrase the most material themes; tie each to how investors likely read results, risks, or outlook. Do not invent claims not supported by those excerpts.
   - Paragraph 4 (2-3 sentences): The most revealing financial metrics. State their actual values, compare to typical benchmarks, and explain what each revealed about the business and how it shaped price action or valuation.`
    : `1) summary: 6-9 sentences split into 2-3 paragraphs, each separated by a literal "\\n\\n". Structure:
   - Paragraph 1 (2-3 sentences): What happened to the stock overall — price direction, magnitude, and the single most dominant driver.
   - Paragraph 2 (2-3 sentences): The most impactful cultural signals. Name each signal by what it was about, quote or paraphrase its core claim, and explain concretely why and how it moved investor sentiment or the stock price.
   - Paragraph 3 (2-3 sentences): The most revealing financial metrics. State their actual values, compare to typical benchmarks, and explain what each revealed about the business and how it shaped price action or valuation.`;

  const filingReasoningRule = hasFiling
    ? `   - When DATA.displayedFilingHighlights is non-empty: include 1-2 reasoning items that cite ONLY filingHighlightCitations (metricCitations and culturalSignalCitations must be []). Each must paraphrase substantive content from the cited excerpt index.`
    : `   - When DATA.displayedFilingHighlights is empty: every filingHighlightCitations array must be []. Do not write filing/SEC bullets.`;

  return `
You are a financial analyst writing a retrospective for ${input.companyName} (${input.ticker}), Q${input.timeframe.quarter} ${input.timeframe.year}.
${priceContext} ${scoreContext}
Cultural signal mix: ${sentimentSummary || "none"}.

Return strict JSON. Every reasoning object must include all three citation arrays metricCitations, culturalSignalCitations, filingHighlightCitations (use [] for unused types). Example shape:
${JSON.stringify(schema, null, 2)}

RULES — no exceptions:
${summaryStructure}
   Past tense only. No hedging ("may", "could", "might"), no filler, no investment advice, no meta-commentary.
2) reasoning: 5-8 items, ordered most → least impactful. Each point is 1-2 sentences: state the fact from DATA and its direct market implication. Terse and factual.
   - CRITICAL: every bullet must have a definitive positive OR negative market impact. If the direction is ambiguous or neutral, omit the bullet entirely.
   - NEVER use hedging words: "may", "might", "could", "perhaps", "possibly", "not enough", "may not have". State only definitive facts.
   - NEVER write bullets about metrics that are null, unavailable, or N/A.
${filingReasoningRule}
3) Citation segregation — CRITICAL: each reasoning item must use EXACTLY ONE citation type — either non-empty metricCitations, OR non-empty culturalSignalCitations, OR non-empty filingHighlightCitations. The other two arrays must be []. NEVER mix types in one bullet.
4) Cultural signal sentiment key: "pos" = bullish coverage, "neg" = bearish coverage, "neutral" = ambiguous.
5) metricCitations: only keys present in DATA.displayedMetricKeys.
6) culturalSignalCitations: only indices from DATA.displayedCulturalSignals[].index.
7) filingHighlightCitations: only indices from DATA.displayedFilingHighlights[].index.
8) Every reasoning item must cite ≥1 metric, OR ≥1 cultural signal, OR ≥1 filing highlight (when highlights exist in DATA).
9) Prioritise the 3-5 metrics with the most unusual or market-moving values (e.g., extreme growth, margin collapse, valuation outlier). Skip metrics with unremarkable readings unless they directly explain price action. Do not manufacture bullets for routine or mid-range values.
10) Past tense only: "reported", "fell", "posted", "showed", "stated". Never "is", "has", "remains".
11) Use only DATA below — no outside knowledge, no invented numbers, no filing facts beyond DATA.displayedFilingHighlights.

DATA:
${JSON.stringify(input, null, 2)}
  `.trim();
}

function parseJsonContent(raw: string) {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(cleaned);
}

async function callGroqSynthesis(input: AlphaSynthesisInput, apiKey: string, model: string) {
  if (!apiKey) throw new Error("Missing GROQ_API_KEY");

  const prompt = buildSynthesisPrompt(input);
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a data-grounded financial and cultural synthesis assistant. Use only provided data and return strict JSON only.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Groq error ${res.status}: ${detail}`);
  }

  const json = await res.json();
  const text: string | undefined = json?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned empty content");

  return parseJsonContent(text);
}

interface PeerSynthesisInput {
  mainTicker: string;
  mainCompany: string;
  timeframe: { quarter: number; year: number };
  mainFinancialScore: number;
  mainCulturalScore: number;
  mainQuarterlyReturn: number | null;
  peers: Array<{
    ticker: string;
    companyName: string;
    quarterlyReturn: number | null;
    financialScore: number;
    culturalScore: number;
    topHeadline?: string;
  }>;
}

function buildPeerSynthesisPrompt(input: PeerSynthesisInput): string {
  const { mainTicker, mainCompany, timeframe, mainFinancialScore, mainCulturalScore, mainQuarterlyReturn, peers } = input;
  const fmt = (v: number | null) => v != null ? `${v > 0 ? "+" : ""}${v.toFixed(1)}%` : "N/A";

  const peerLines = peers.map(p =>
    `- ${p.companyName} (${p.ticker}): return ${fmt(p.quarterlyReturn)}, financial score ${p.financialScore}/100, cultural score ${p.culturalScore}/100${p.topHeadline ? `, top headline: "${p.topHeadline}"` : ""}`
  ).join("\n");

  return `You are a financial analyst. Write exactly 2–3 sentences comparing ${mainCompany} (${mainTicker}) to its sector peers during Q${timeframe.quarter} ${timeframe.year}. Past tense only. No hedging. No investment advice.

${mainCompany} (${mainTicker}): quarterly return ${fmt(mainQuarterlyReturn)}, financial score ${mainFinancialScore}/100, cultural score ${mainCulturalScore}/100

Peers:
${peerLines}

Focus on what differentiated ${mainCompany}: whether it outperformed or underperformed, and why, grounded in the numbers above. Mention at least one peer by name.

Return JSON only: {"narrative": "..."}`.trim();
}

function yahooMetricsDevPlugin(groqModel: string, agentPythonBin: string) {
  return {
    name: "yahoo-metrics-dev-endpoint",
    configureServer(server: import("vite").ViteDevServer) {

      // ── Settings: save API keys to .env + validate ───────────────
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (url.pathname !== "/settings") return next();

        res.setHeader("Content-Type", "application/json");

        if (req.method === "GET") {
          res.statusCode = 200;
          res.end(JSON.stringify({
            hasGroqKey: !!runtimeKeys.groqApiKey,
            hasTavilyKey: !!runtimeKeys.tavilyApiKey,
            groqKeyMasked: maskKey(runtimeKeys.groqApiKey),
            tavilyKeyMasked: maskKey(runtimeKeys.tavilyApiKey),
          }));
          return;
        }

        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ detail: "Method not allowed" }));
          return;
        }

        try {
          const body = (await readJsonBody(req)) as { groqApiKey?: string; tavilyApiKey?: string };
          const newGroq = (body.groqApiKey ?? "").trim();
          const newTavily = (body.tavilyApiKey ?? "").trim();

          if (newGroq) runtimeKeys.groqApiKey = newGroq;
          if (newTavily) runtimeKeys.tavilyApiKey = newTavily;

          const [groqResult, tavilyResult] = await Promise.all([
            validateGroqKey(newGroq || runtimeKeys.groqApiKey, groqModel),
            Promise.resolve(validateTavilyFormat(newTavily || runtimeKeys.tavilyApiKey)),
          ]);

          res.statusCode = 200;
          res.end(JSON.stringify({ saved: true, groq: groqResult, tavily: tavilyResult }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ detail: err instanceof Error ? err.message : "Settings save failed" }));
        }
        return;
      });

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/agent-data")) return next();
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ detail: "Method not allowed" }));
          return;
        }

        const url = new URL(req.url, "http://localhost");
        const ticker = (url.searchParams.get("ticker") ?? "").toUpperCase();
        const company = (url.searchParams.get("company") ?? "").trim();
        const quarter = Number(url.searchParams.get("quarter"));
        const year = Number(url.searchParams.get("year"));

        if (!ticker || !company || !Number.isInteger(quarter) || !Number.isInteger(year)) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ detail: "Missing or invalid ticker/company/quarter/year query params" }));
          return;
        }

        const cacheKey = `${ticker}:${quarter}:${year}`;
        const cached = agentCache.get(cacheKey);
        if (cached && Date.now() - cached.ts < AGENT_CACHE_TTL_MS) {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("X-Cache", "HIT");
          res.end(cached.data);
          return;
        }

        try {
          const { stdout } = await execFileAsync(
            agentPythonBin,
            [
              agentDataScriptPath,
              "--ticker", ticker,
              "--company", company,
              "--quarter", String(quarter),
              "--year", String(year),
            ],
            {
              cwd: __dirname,
              maxBuffer: 4 * 1024 * 1024,
              env: {
                ...process.env,
                TAVILY_API_KEY: runtimeKeys.tavilyApiKey,
                GROQ_API_KEY: runtimeKeys.groqApiKey,
              },
            }
          );

          agentCache.set(cacheKey, { data: stdout, ts: Date.now() });
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(stdout);
        } catch (err) {
          const detail = err instanceof Error ? err.message : "Failed to fetch agent data";
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ detail }));
        }
      });

      // ── /peer-data: lightweight per-peer yfinance + Tavily ──────────
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/peer-data")) return next();
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ detail: "Method not allowed" }));
          return;
        }

        const url = new URL(req.url, "http://localhost");
        const ticker  = (url.searchParams.get("ticker")  ?? "").toUpperCase();
        const company = (url.searchParams.get("company") ?? "").trim();
        const quarter = Number(url.searchParams.get("quarter"));
        const year    = Number(url.searchParams.get("year"));

        if (!ticker || !company || !Number.isInteger(quarter) || !Number.isInteger(year)) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ detail: "Missing or invalid ticker/company/quarter/year" }));
          return;
        }

        const cacheKey = `peer:${ticker}:${quarter}:${year}`;
        const cached = peerCache.get(cacheKey);
        if (cached && Date.now() - cached.ts < AGENT_CACHE_TTL_MS) {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("X-Cache", "HIT");
          res.end(cached.data);
          return;
        }

        try {
          const { stdout } = await execFileAsync(
            agentPythonBin,
            [
              peerDataScriptPath,
              "--ticker",  ticker,
              "--company", company,
              "--quarter", String(quarter),
              "--year",    String(year),
              "--groq-model", groqModel,
            ],
            {
              cwd: __dirname,
              maxBuffer: 2 * 1024 * 1024,
              env: {
                ...process.env,
                TAVILY_API_KEY: runtimeKeys.tavilyApiKey,
                GROQ_API_KEY:   runtimeKeys.groqApiKey,
              },
            }
          );

          peerCache.set(cacheKey, { data: stdout, ts: Date.now() });
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(stdout);
        } catch (err) {
          const detail = err instanceof Error ? err.message : "Failed to fetch peer data";
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ detail }));
        }
      });

      // ── /peer-synthesis: Groq comparative paragraph ──────────────────
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/peer-synthesis")) return next();
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ detail: "Method not allowed" }));
          return;
        }

        try {
          const raw = (await readJsonBody(req)) as Partial<PeerSynthesisInput>;
          const body: PeerSynthesisInput = {
            mainTicker:          raw.mainTicker ?? "",
            mainCompany:         raw.mainCompany ?? "",
            timeframe:           raw.timeframe ?? { quarter: 1, year: 2020 },
            mainFinancialScore:  raw.mainFinancialScore ?? 50,
            mainCulturalScore:   raw.mainCulturalScore ?? 50,
            mainQuarterlyReturn: raw.mainQuarterlyReturn ?? null,
            peers:               raw.peers ?? [],
          };

          if (!body.mainTicker || body.peers.length === 0) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ detail: "Missing mainTicker or peers" }));
            return;
          }

          const prompt = buildPeerSynthesisPrompt(body);
          const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${runtimeKeys.groqApiKey}`,
            },
            body: JSON.stringify({
              model: groqModel,
              temperature: 0.3,
              max_tokens: 350,
              response_format: { type: "json_object" },
              messages: [
                {
                  role: "system",
                  content: "You are a data-grounded financial analyst. Return strict JSON only.",
                },
                { role: "user", content: prompt },
              ],
            }),
          });

          if (!groqRes.ok) {
            const detail = await groqRes.text().catch(() => "");
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ detail: `Groq error ${groqRes.status}: ${detail}` }));
            return;
          }

          const json = await groqRes.json();
          const text: string | undefined = json?.choices?.[0]?.message?.content;
          if (!text) throw new Error("Groq returned empty content");
          const parsed = parseJsonContent(text) as { narrative?: string };
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ narrative: parsed.narrative ?? "" }));
        } catch (err) {
          const detail = err instanceof Error ? err.message : "Peer synthesis failed";
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ detail }));
        }
      });

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/yahoo-search")) return next();
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ detail: "Method not allowed" }));
          return;
        }

        const url = new URL(req.url, "http://localhost");
        const query = (url.searchParams.get("query") ?? "").trim();
        if (!query) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ detail: "Missing query param: query" }));
          return;
        }

        try {
          const { stdout } = await execFileAsync(
            process.execPath,
            [yahooSearchScriptPath, "--query", query],
            {
              cwd: __dirname,
              maxBuffer: 2 * 1024 * 1024,
            }
          );

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(stdout);
        } catch (err) {
          const detail = err instanceof Error ? err.message : "Failed to search equities";
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ detail }));
        }
      });

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/yahoo-resolve")) return next();
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ detail: "Method not allowed" }));
          return;
        }

        const url = new URL(req.url, "http://localhost");
        const query = (url.searchParams.get("query") ?? "").trim();
        if (!query) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ detail: "Missing query param: query" }));
          return;
        }

        try {
          const { stdout } = await execFileAsync(
            process.execPath,
            [yahooResolveScriptPath, "--query", query],
            {
              cwd: __dirname,
              maxBuffer: 2 * 1024 * 1024,
            }
          );

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(stdout);
        } catch (err) {
          const detail = err instanceof Error ? err.message : "Failed to resolve ticker";
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ detail }));
        }
      });

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/yahoo-metrics")) return next();
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ detail: "Method not allowed" }));
          return;
        }

        const url = new URL(req.url, "http://localhost");
        const ticker = (url.searchParams.get("ticker") ?? "").toUpperCase();
        const quarter = Number(url.searchParams.get("quarter"));
        const year = Number(url.searchParams.get("year"));

        if (!ticker || !Number.isInteger(quarter) || !Number.isInteger(year)) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ detail: "Missing or invalid ticker/quarter/year query params" }));
          return;
        }

        try {
          const { stdout } = await execFileAsync(
            process.execPath,
            [
              yahooScriptPath,
              "--ticker", ticker,
              "--quarter", String(quarter),
              "--year", String(year),
            ],
            {
              cwd: __dirname,
              maxBuffer: 2 * 1024 * 1024,
            }
          );

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(stdout);
        } catch (err) {
          const detail = err instanceof Error ? err.message : "Failed to fetch Yahoo metrics";
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ detail }));
        }
      });

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/alpha-synthesis")) return next();
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ detail: "Method not allowed" }));
          return;
        }

        try {
          const raw = (await readJsonBody(req)) as Partial<AlphaSynthesisInput>;
          const body: AlphaSynthesisInput = {
            ticker: raw.ticker ?? "",
            companyName: raw.companyName ?? "",
            timeframe: raw.timeframe ?? { quarter: 1, year: 2020 },
            displayedMetricKeys: raw.displayedMetricKeys ?? [],
            displayedMetrics: raw.displayedMetrics ?? {},
            displayedCulturalSignals: raw.displayedCulturalSignals ?? [],
            displayedFilingHighlights: raw.displayedFilingHighlights ?? [],
            secFiling: raw.secFiling ?? null,
            scores: raw.scores,
            priceDeltaPercent: raw.priceDeltaPercent,
          };
          const result = await callGroqSynthesis(body, runtimeKeys.groqApiKey, groqModel);
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        } catch (err) {
          const detail = err instanceof Error ? err.message : "Failed to generate synthesis";
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ detail }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const groqModel = env.GROQ_MODEL || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const agentPythonBin =
    env.AGENT_PYTHON_BIN ||
    process.env.AGENT_PYTHON_BIN ||
    (existsSync(defaultAgentPythonPath) ? defaultAgentPythonPath : "python3");

  // Keys live in localStorage (browser) — synced here in-memory via /settings on page load.
  // No file storage. On server restart, the browser re-syncs keys automatically.

  return {
    plugins: [react(), yahooMetricsDevPlugin(groqModel, agentPythonBin)],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        "/api": "http://localhost:8000",
      },
    },
  };
});
