// READ instructions.txt before editing this file.
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { IncomingMessage } from "node:http";

const execFileAsync = promisify(execFile);
const yahooScriptPath = path.resolve(__dirname, "./scripts/fetch-yfinance-metrics.mjs");
const yahooResolveScriptPath = path.resolve(__dirname, "./scripts/resolve-yahoo-ticker.mjs");
const yahooSearchScriptPath = path.resolve(__dirname, "./scripts/search-yahoo-equities.mjs");
const agentDataScriptPath = path.resolve(__dirname, "./scripts/fetch-agent-data.py");
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
  const schema = {
    summary: "string",
    reasoning: [
      {
        insight: "string",
        whyItMatters: "string",
        metricCitations: ["priceChangePercent", "epsSurprisePercent"],
        culturalSignalCitations: [1, 2],
      },
    ],
  };

  const priceContext = typeof input.priceDeltaPercent === "number"
    ? `The stock ${input.priceDeltaPercent >= 0 ? "rose" : "fell"} ${Math.abs(input.priceDeltaPercent).toFixed(2)}% over the quarter.`
    : "";

  const scoreContext = input.scores
    ? `Echelon scores: Financial ${input.scores.financialScore.toFixed(1)}/100 · Cultural ${input.scores.culturalScore.toFixed(1)}/100 · Overall ${input.scores.echelonScore.toFixed(1)}/100.`
    : "";

  const sentimentCounts = input.displayedCulturalSignals.reduce(
    (acc, s) => { acc[s.sentiment] = (acc[s.sentiment] || 0) + 1; return acc; },
    {} as Record<string, number>
  );
  const sentimentSummary = Object.entries(sentimentCounts)
    .map(([k, v]) => `${v} ${k === "pos" ? "positive" : k === "neg" ? "negative" : "neutral"}`)
    .join(", ");

  return `
You are an Echelon analyst writing a retrospective signal synthesis for ${input.companyName} (${input.ticker}) — Q${input.timeframe.quarter} ${input.timeframe.year}.
${priceContext} ${scoreContext}

Your job: explain, causally and in past tense, how the interplay of financial fundamentals and cultural/media signals drove the stock's narrative and price action during this quarter.

SENTIMENT KEY for DATA.displayedCulturalSignals:
  "pos"     = market-positive coverage (upgrades, beats, product wins, bullish narrative)
  "neg"     = market-negative coverage (misses, lawsuits, regulatory risk, bearish narrative)
  "neutral" = ambiguous or informational coverage with no clear directional signal
Cultural signal mix this quarter: ${sentimentSummary || "no signals available"}.

Output must be strict JSON matching this exact shape:
${JSON.stringify(schema, null, 2)}

WRITING RULES — follow every one:
1)  summary: 6-9 sentences, past tense. Structure it as:
      - Sentence 1-2: Overall quarter narrative — what happened to the stock and why at a high level.
      - Sentence 3-4: Most significant cultural signal(s) — what the coverage said, its sentiment, and how it shaped market perception.
      - Sentence 5-6: Key financial factors — which metrics were strongest or weakest and what they revealed.
      - Sentence 7-9: How cultural and financial signals interacted causally, plus confidence caveats.
2)  reasoning: 6-10 items ordered most → least important. Aim for roughly half cultural, half financial.
3)  For every CULTURAL reasoning item:
      - insight: state specifically what the signal said, its sentiment, and what narrative it created for investors (past tense, 1 sentence).
      - whyItMatters: explain the causal chain — how this coverage shifted perception, sentiment, or positioning (2 sentences max).
4)  For every FINANCIAL reasoning item:
      - insight: state the metric value and what it revealed about the business (past tense, 1 sentence).
      - whyItMatters: explain what this implied for valuation, risk, or growth trajectory (2 sentences max).
5)  metricCitations: only keys from DATA.displayedMetricKeys.
6)  culturalSignalCitations: only indices from DATA.displayedCulturalSignals[].index.
7)  Every reasoning item must cite at least one metric OR one signal — never zero citations.
8)  Cover ALL non-null metric keys across the full reasoning list.
9)  Cover ALL cultural signal indices at least once if signals exist.
10) Skip reasoning items for null metrics — mention data gaps in summary only.
11) Do NOT invent facts, dates, or numbers not present in DATA.
12) Do NOT use outside knowledge. Only DATA.
13) Past tense throughout: "reported", "showed", "rose", "fell", "faced", "posted". NOT "is", "has", "remains", "continues".
14) No hype, no generic filler, no investment advice.
15) Negative cultural signals are equally important as financial ones — do not downplay them.
16) If cultural score was low (< 45), explicitly explain which signals drove sentiment down and why.
17) If cultural score was high (> 65), explain which positive signals reinforced the bullish narrative.

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

function yahooMetricsDevPlugin(groqApiKey: string, groqModel: string, agentPythonBin: string) {
  return {
    name: "yahoo-metrics-dev-endpoint",
    configureServer(server: import("vite").ViteDevServer) {
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
            }
          );

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
          const body = (await readJsonBody(req)) as AlphaSynthesisInput;
          const result = await callGroqSynthesis(body, groqApiKey, groqModel);
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
  const groqApiKey = env.GROQ_API_KEY || process.env.GROQ_API_KEY || "";
  const groqModel = env.GROQ_MODEL || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const agentPythonBin =
    env.AGENT_PYTHON_BIN ||
    process.env.AGENT_PYTHON_BIN ||
    (existsSync(defaultAgentPythonPath) ? defaultAgentPythonPath : "python3");

  return {
    plugins: [react(), yahooMetricsDevPlugin(groqApiKey, groqModel, agentPythonBin)],
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
