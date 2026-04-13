// READ instructions.txt before editing this file.
// App.tsx — root layout + state only. No business logic. Add sections in components/.

import { useEffect, useRef, useState } from "react";
import SearchForm, { periodLabel } from "@/components/SearchForm";
import AgentProgress from "@/components/AgentProgress";
import ResultsPanel from "@/components/ResultsPanel";
import type { AnalysisRequest, AnalysisResult, AgentStep } from "@/types";
import { getAnyStockResultWithLiveMetrics } from "@/api/demo";

const USE_DEMO = true;
const BYPASS_DEMO_AGENT_PROGRESS = false;

const DEFAULT_STEPS: AgentStep[] = [
  { id: "ticker",     label: "Resolving equity and market data",             status: "pending" },
  { id: "financials", label: "Fetching financial metrics via yfinance",      status: "pending" },
  { id: "pricechart", label: "Building quarterly price chart",               status: "pending" },
  { id: "cultural",   label: "Scanning cultural signals via Tavily",         status: "pending" },
  { id: "scores",     label: "Computing Echelon scores",                     status: "pending" },
  { id: "synthesize", label: "Synthesizing analysis via Groq LLM",          status: "pending" },
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
      if (BYPASS_DEMO_AGENT_PROGRESS) {
        const demo = await getAnyStockResultWithLiveMetrics(req);
        if (runIdRef.current !== runId) return;
        setResult(demo);
        setOverlayOn(false);
        setStepsForRun([]);
        setLoading(false);
        return;
      }

      // Run animation and data fetch concurrently.
      // Loading screen shows immediately; result appears when BOTH are done.
      let dataResult: AnalysisResult | null = null;
      let animDone = false;
      let finished = false;

      const tryFinish = () => {
        if (finished || !dataResult || !animDone) return;
        if (runIdRef.current !== runId) return;
        finished = true;
        setResult(dataResult);
        setOverlayOn(false);
        setStepsForRun([]);
        setLoading(false);
      };

      // Start animation immediately — plays while data is fetching
      simulateSteps(setStepsForRun, () => {
        animDone = true;
        tryFinish();
      });

      // Fetch data in parallel (not awaited — runs alongside animation)
      getAnyStockResultWithLiveMetrics(req).then(demo => {
        if (runIdRef.current !== runId) return;
        dataResult = demo;
        tryFinish();
      });

      // Failsafe: if either side stalls, force-complete after 15s
      setTimeout(() => {
        if (runIdRef.current !== runId || finished) return;
        setStepsForRun(prev => prev.map(s => ({ ...s, status: "done" })));
        animDone = true;
        tryFinish();
      }, 15000);

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

  const selectedPeriodLabel = lastReq ? periodLabel(lastReq.timeframe) : "";
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
            Echelon<span style={{ color: "var(--text)" }}>AI</span>
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
        periodLabel={selectedPeriodLabel}
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
        <span>Search Agent</span>
        <span style={{ color: "var(--text-dim)" }}>·</span>
        <span>Tavily API</span>
        <span style={{ color: "var(--text-dim)" }}>·</span>
        <span>Financial Agent</span>
        <span style={{ marginLeft: "auto" }}>
          Not financial advice. Educational signal intelligence only.
        </span>
      </div>

    </div>
  );
}
