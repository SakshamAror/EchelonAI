// READ instructions.txt before editing this file.
// ─────────────────────────────────────────────────────────────────────────────
// API wrappers for AlphaIQ backend.
// To add a new endpoint: append a new exported async function here.
// Do NOT restructure existing functions — other components import them.
// Backend base URL is proxied via Vite: /api → http://localhost:8000
// ─────────────────────────────────────────────────────────────────────────────

import type { AnalysisRequest, AnalysisResult, AgentStep } from "@/types";

const BASE = "/api";

export async function analyzeStock(
  request: AnalysisRequest
): Promise<AnalysisResult> {
  const res = await fetch(`${BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// SSE stream for real-time agent progress updates.
// Calls onStep for each agent step event, onDone when analysis is complete.
export function streamAnalysis(
  request: AnalysisRequest,
  onStep: (step: AgentStep) => void,
  onDone: (result: AnalysisResult) => void,
  onError: (err: Error) => void
): () => void {
  const params = new URLSearchParams({
    company: request.company,
    month: String(request.timeframe.month),
    year: String(request.timeframe.year),
    ...(request.ticker ? { ticker: request.ticker } : {}),
  });
  const es = new EventSource(`${BASE}/analyze/stream?${params}`);

  es.addEventListener("step", (e) => {
    onStep(JSON.parse(e.data) as AgentStep);
  });
  es.addEventListener("done", (e) => {
    onDone(JSON.parse(e.data) as AnalysisResult);
    es.close();
  });
  es.onerror = () => {
    onError(new Error("Stream connection lost"));
    es.close();
  };

  return () => es.close();
}

// ─── Demo fixtures (used when backend is not running) ─────────────────────
export { DEMO_RESULTS } from "./demo";
