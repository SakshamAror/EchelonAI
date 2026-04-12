// READ instructions.txt before editing this file.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { IncomingMessage } from "node:http";

const execFileAsync = promisify(execFile);
const yahooScriptPath = path.resolve(__dirname, "./scripts/fetch-yfinance-metrics.mjs");

interface AlphaSynthesisInput {
  ticker: string;
  companyName: string;
  timeframe: { month: number; year: number };
  direction: "up" | "down" | "flat";
  alphaScore: number;
  culturalScore: number;
  financialScore: number;
  forumMomentumScore: number;
  metrics: Record<string, unknown>;
  culturalSignals: unknown[];
  forumChart: Record<string, unknown>;
  sources: unknown[];
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function buildGeminiPrompt(input: AlphaSynthesisInput) {
  const schema = {
    summary: "string",
    summarySourceIndices: [1, 2],
    reasoning: [
      {
        text: "string",
        category: "financial | cultural | filing",
        sourceIndices: [1, 2],
      },
    ],
  };

  return `
You are a financial+cultural signal synthesis analyst.
Task: write Alpha Synthesis from ONLY the provided dataset.
Do not invent facts, dates, or numbers.
Do not give investment advice.

Output must be strict JSON following this shape:
${JSON.stringify(schema, null, 2)}

Rules:
1) summary: 2-3 sentences, clear causal narrative.
2) summarySourceIndices: include 1-3 source indices that support the summary.
3) reasoning: 3 to 4 bullets.
4) Every reasoning item must use category: financial, cultural, or filing.
5) Every reasoning item must include sourceIndices pointing to provided sources (1-based indices).
6) If data is mixed or weak, explicitly state uncertainty in summary.
7) Keep wording concise and high-signal; no hype.
8) Cite only indices that exist in DATA.sources.

DATA:
${JSON.stringify(input, null, 2)}
  `.trim();
}

async function callGeminiSynthesis(input: AlphaSynthesisInput) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const prompt = buildGeminiPrompt(input);
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini error ${res.status}: ${detail}`);
  }

  const json = await res.json();
  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty content");

  return JSON.parse(text);
}

function yahooMetricsDevPlugin() {
  return {
    name: "yahoo-metrics-dev-endpoint",
    configureServer(server: import("vite").ViteDevServer) {
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
        const month = Number(url.searchParams.get("month"));
        const year = Number(url.searchParams.get("year"));

        if (!ticker || !Number.isInteger(month) || !Number.isInteger(year)) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ detail: "Missing or invalid ticker/month/year query params" }));
          return;
        }

        try {
          const { stdout } = await execFileAsync(
            process.execPath,
            [
              yahooScriptPath,
              "--ticker", ticker,
              "--month", String(month),
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
          const result = await callGeminiSynthesis(body);
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

export default defineConfig({
  plugins: [react(), yahooMetricsDevPlugin()],
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
});
