// READ instructions.txt before editing this file.
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { IncomingMessage } from "node:http";

const execFileAsync = promisify(execFile);
const yahooScriptPath = path.resolve(__dirname, "./scripts/fetch-yfinance-metrics.mjs");
const yahooResolveScriptPath = path.resolve(__dirname, "./scripts/resolve-yahoo-ticker.mjs");
const yahooSearchScriptPath = path.resolve(__dirname, "./scripts/search-yahoo-equities.mjs");

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

  return `
You are a financial+cultural signal synthesis analyst.
Task: write Alpha Synthesis from ONLY the provided dataset.
Do not invent facts, dates, or numbers.
Do not give investment advice.
Do not use any outside knowledge.
Do not cite anything outside the allowed keys/indices.

Output must be strict JSON following this shape:
${JSON.stringify(schema, null, 2)}

Rules:
1) summary: 5-8 sentences with clear causal interpretation and confidence caveats.
2) reasoning: 6-10 items, most important first.
3) Each reasoning item MUST include:
   - insight: concise statement of what the cited data point shows (max 1 sentence)
   - whyItMatters: concise implication (max 2 short sentences)
4) metricCitations must contain ONLY values from DATA.displayedMetricKeys.
5) culturalSignalCitations must contain ONLY valid indices from DATA.displayedCulturalSignals.index.
6) Every reasoning item must cite at least one metric or one cultural signal.
7) Across all reasoning items, cover ALL metric keys in DATA.displayedMetricKeys at least once.
8) If DATA.displayedCulturalSignals is non-empty, cover ALL cultural signal indices at least once.
9) Do not create a reasoning item for any metric whose value is null.
10) If a metric is null, do not cite it in reasoning; you may mention data limitations in summary only.
11) Never claim or imply "the company did not report" unless that exact claim exists in DATA.
12) If DATA.displayedCulturalSignals is empty, keep synthesis financial-only.
13) Do not mention any metric name not present in DATA.displayedMetricKeys.
14) Keep wording high-signal, no hype, no generic filler.
15) Order reasoning items from most important to least important.

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

function yahooMetricsDevPlugin(groqApiKey: string, groqModel: string) {
  return {
    name: "yahoo-metrics-dev-endpoint",
    configureServer(server: import("vite").ViteDevServer) {
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

  return {
    plugins: [react(), yahooMetricsDevPlugin(groqApiKey, groqModel)],
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
