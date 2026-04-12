// READ instructions.txt before editing this file.
// App.tsx — root layout + state only. No business logic. Add sections in components/.

import { useEffect, useRef, useState } from "react";
import SearchForm, { periodLabel } from "@/components/SearchForm";
import AgentProgress from "@/components/AgentProgress";
import ResultsPanel from "@/components/ResultsPanel";
import type { AnalysisRequest, AnalysisResult, AgentStep } from "@/types";
import { getDemoResultWithLiveMetrics } from "@/api/demo";

const USE_DEMO = true;
const BYPASS_DEMO_AGENT_PROGRESS = false;

const DEMO_KEY_MAP: Record<string, string> = {
  nike:   "NKE-9-2024",
  nvidia: "NVDA-8-2024",
  tesla:  "TSLA-12-2023",
};

const DEFAULT_STEPS: AgentStep[] = [
  { id: "forum",      label: "Pulling Forum attention data",                status: "pending" },
  { id: "scraper",    label: "Retrieving cultural signals via Nia / Exa",   status: "pending" },
  { id: "edgar",      label: "Fetching 10-Q / 10-K from SEC EDGAR",         status: "pending" },
  { id: "nia",        label: "Indexing filings into Nia · querying MD&A",   status: "pending" },
  { id: "metrics",    label: "Running Omnara financial agent · yfinance",   status: "pending" },
  { id: "synthesize", label: "Synthesizing Alpha Score · Gemini 2.0 Flash", status: "pending" },
];

function simulateSteps(
  setSteps: React.Dispatch<React.SetStateAction<AgentStep[]>>,
  onDone: () => void
) {
  let i = 0;
  function advance() {
    if (i >= DEFAULT_STEPS.length) { onDone(); return; }
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: "running" } : s));
    setTimeout(() => {
      setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: "done" } : s));
      i++;
      setTimeout(advance, 120);
    }, 700 + Math.random() * 400);
  }
  advance();
}

export default function App() {
  const runIdRef = useRef(0);
  const [loading,   setLoading]   = useState(false);
  const [overlayOn, setOverlayOn] = useState(false);
  const [steps,     setSteps]     = useState<AgentStep[]>([]);
  const [result,    setResult]    = useState<AnalysisResult | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [lastReq,   setLastReq]   = useState<AnalysisRequest | null>(null);

  useEffect(() => {
    if (!result && !error) return;
    setLoading(false);
    setOverlayOn(false);
    setSteps([]);
  }, [result, error]);

  useEffect(() => {
    if (!overlayOn) return;
    const allAgentsDone = steps.length > 0 && steps.every(
      s => s.status === "done" || s.status === "error"
    );
    if (!allAgentsDone) return;
    setOverlayOn(false);
    setLoading(false);
    setSteps([]);
  }, [overlayOn, steps]);

  async function handleAnalyze(req: AnalysisRequest) {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    const setStepsForRun: React.Dispatch<React.SetStateAction<AgentStep[]>> = next => {
      if (runIdRef.current !== runId) return;
      setSteps(next);
    };

    setLoading(true);
    setOverlayOn(true);
    setResult(null);
    setError(null);
    setLastReq(req);
    setStepsForRun(DEFAULT_STEPS.map(s => ({ ...s, status: "pending" })));

    if (USE_DEMO) {
      const key  = DEMO_KEY_MAP[req.company.toLowerCase()];
      const demo = key ? await getDemoResultWithLiveMetrics(key, req.timeframe) : null;

      if (BYPASS_DEMO_AGENT_PROGRESS) {
        if (runIdRef.current !== runId) return;
        if (demo) setResult(demo);
        else setError(`No demo data for "${req.company}". Try Nike, Nvidia, or Tesla.`);
        setOverlayOn(false);
        setStepsForRun([]);
        setLoading(false);
        return;
      }

      let finished = false;
      const finish = () => {
        if (finished) return;
        if (runIdRef.current !== runId) return;
        finished = true;
        if (demo) setResult(demo);
        else if (key) setError(`Failed to fetch live Yahoo Finance metrics for "${req.company}".`);
        else setError(`No demo data for "${req.company}". Try Nike, Nvidia, or Tesla.`);
        setOverlayOn(false);
        setStepsForRun([]);
        setLoading(false);
      };

      // Safety net: even if simulated step timers are delayed, always complete the flow.
      const failSafeMs = 8000;
      setTimeout(() => {
        if (runIdRef.current !== runId) return;
        setStepsForRun(prev => prev.map(s => ({ ...s, status: "done" })));
        finish();
      }, failSafeMs);

      simulateSteps(setStepsForRun, finish);
      return;
    }

    try {
      const { analyzeStock } = await import("@/api");
      if (runIdRef.current !== runId) return;
      const nextResult = await analyzeStock(req);
      if (runIdRef.current !== runId) return;
      setResult(nextResult);
    } catch (err) {
      if (runIdRef.current !== runId) return;
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      if (runIdRef.current !== runId) return;
      setOverlayOn(false);
      setLoading(false);
    }
  }

  const monthLabel = lastReq ? periodLabel(lastReq.timeframe) : "";
  const showProgressOverlay = overlayOn && loading;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 40px", borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, background: "rgba(10,10,10,0.95)",
        backdropFilter: "blur(10px)", zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="font-bebas" style={{ fontSize: 28, letterSpacing: 4, color: "var(--accent)" }}>
            Forum<span style={{ color: "var(--text)" }}>Alpha</span>
          </span>
          <span style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--text-muted)" }}>
            Cultural Signal Intelligence
          </span>
          <span style={{ fontSize: 10, padding: "4px 10px", border: "1px solid var(--accent-dim)",
            color: "var(--accent)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Beta
          </span>
        </div>
        <span style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--text-muted)" }}>
          Not Financial Advice
        </span>
      </nav>

      {/* ── Hero + Form ─────────────────────────────────────────── */}
      <section style={{ padding: "60px 40px 40px", maxWidth: 1100, margin: "0 auto", width: "100%" }}>
        <p style={{ fontSize: 10, letterSpacing: "0.3em", color: "var(--text-muted)",
          textTransform: "uppercase", marginBottom: 16 }}>
          // &nbsp;Signal Intelligence Platform
        </p>
        <h1 className="font-display" style={{ fontSize: "clamp(36px, 5vw, 64px)",
          lineHeight: 1.1, fontWeight: 400, marginBottom: 8 }}>
          Why did <em style={{ fontStyle: "italic", color: "var(--accent)" }}>this stock</em>
          <br />move the way it did?
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-muted)", letterSpacing: "0.05em", marginBottom: 48 }}>
          Not prediction. Not noise. Cultural + financial signal, unified.
        </p>
        <SearchForm onSubmit={handleAnalyze} loading={loading} />
      </section>

      <hr style={{ border: "none", borderTop: "1px solid var(--border)",
        maxWidth: 1100, margin: "0 auto", width: "100%" }} />

      {/* ── Results ─────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 40px 0", width: "100%", flex: 1 }}>
        {error && (
          <div style={{ padding: 16, border: "1px solid var(--red)", color: "var(--red)",
            background: "rgba(255,76,76,0.06)", fontSize: 12, marginBottom: 16 }}>
            {error}
          </div>
        )}
        {result && <ResultsPanel result={result} />}
      </section>

      {/* ── Agent loading overlay ────────────────────────────────── */}
      <AgentProgress
        active={showProgressOverlay}
        steps={steps}
        company={lastReq?.company ?? ""}
        monthLabel={monthLabel}
      />

      {/* ── Fixed status bar ─────────────────────────────────────── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "var(--surface)", borderTop: "1px solid var(--border)",
        padding: "8px 40px", display: "flex", alignItems: "center", gap: 24,
        fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.05em", zIndex: 100,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)",
          animation: "statusPulse 2s infinite", flexShrink: 0 }} />
        <span>Forum API</span>
        <span style={{ color: "var(--text-dim)" }}>·</span>
        <span>Nia · Exa</span>
        <span style={{ color: "var(--text-dim)" }}>·</span>
        <span>Omnara Agent</span>
        <span style={{ marginLeft: "auto" }}>
          Not financial advice. Educational signal intelligence only.
        </span>
      </div>

    </div>
  );
}
