// READ instructions.txt before editing this file.
// App.tsx — root layout + state. No business logic. Add new sections in components/.

import { useState } from "react";
import SearchForm from "@/components/SearchForm";
import AgentProgress from "@/components/AgentProgress";
import ResultsPanel from "@/components/ResultsPanel";
import type { AnalysisRequest, AnalysisResult, AgentStep } from "@/types";
import { DEMO_RESULTS } from "@/api/demo";

// Flip to false once backend is wired
const USE_DEMO = true;

const DEMO_KEY_MAP: Record<string, string> = {
  nike:   "NKE-Q3-2024",
  nvidia: "NVDA-Q2-2024",
  tesla:  "TSLA-Q4-2023",
};

const DEFAULT_STEPS: AgentStep[] = [
  { id: "metrics",    label: "Pulling stock metrics via yfinance",          status: "pending" },
  { id: "edgar",      label: "Fetching 10-Q / 10-K from SEC EDGAR",         status: "pending" },
  { id: "nia",        label: "Indexing filings into Nia · querying MD&A",   status: "pending" },
  { id: "scraper",    label: "Scraping cultural signals & news",             status: "pending" },
  { id: "forum",      label: "Fetching Forum attention data",                status: "pending" },
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
      setTimeout(advance, 150);
    }, 550 + Math.random() * 350);
  }
  advance();
}

export default function App() {
  const [loading,  setLoading]  = useState(false);
  const [steps,    setSteps]    = useState<AgentStep[]>([]);
  const [result,   setResult]   = useState<AnalysisResult | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  async function handleAnalyze(req: AnalysisRequest) {
    setLoading(true);
    setResult(null);
    setError(null);
    setSteps(DEFAULT_STEPS.map(s => ({ ...s, status: "pending" })));

    if (USE_DEMO) {
      const key  = DEMO_KEY_MAP[req.company.toLowerCase()];
      const demo = key ? DEMO_RESULTS[key] : null;
      simulateSteps(setSteps, () => {
        if (demo) setResult(demo);
        else setError(`No demo data for "${req.company}". Try Nike, Nvidia, or Tesla.`);
        setLoading(false);
      });
      return;
    }

    try {
      const { analyzeStock } = await import("@/api");
      setResult(await analyzeStock(req));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)", color: "var(--text)" }}>

      {/* ── Header ───────────────────────────────────────────── */}
      <header className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          {/* Logo — FORUM in accent, ALPHA in white */}
          <span className="font-display font-bold tracking-widest text-xl">
            <span style={{ color: "var(--accent)" }}>FORUM</span>
            <span style={{ color: "var(--text)" }}>ALPHA</span>
          </span>
          <span className="font-mono text-[9px] tracking-widest hidden sm:block" style={{ color: "var(--text-muted)" }}>
            CULTURAL SIGNAL<br />INTELLIGENCE
          </span>
          <span
            className="font-mono text-[10px] tracking-widest border px-2 py-0.5"
            style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
          >
            BETA
          </span>
        </div>
        <span className="font-mono text-[10px] tracking-wide hidden sm:block" style={{ color: "var(--text-muted)" }}>
          NOT FINANCIAL ADVICE
        </span>
      </header>

      {/* ── Main ─────────────────────────────────────────────── */}
      <main className="flex-1 px-6 py-14 max-w-lg mx-auto w-full">

        {/* Eyebrow */}
        <p className="font-mono text-[10px] tracking-[0.25em] mb-6" style={{ color: "var(--text-muted)" }}>
          // &nbsp; SIGNAL INTELLIGENCE PLATFORM
        </p>

        {/* Hero heading */}
        <h1 className="font-display font-bold leading-tight mb-6" style={{ fontSize: "clamp(2rem, 8vw, 2.75rem)" }}>
          Why did{" "}
          <em style={{ color: "var(--accent)", fontStyle: "italic" }}>this stock</em>
          <br />move the way it did?
        </h1>

        <p className="font-mono text-xs mb-10" style={{ color: "var(--text-muted)" }}>
          Not prediction. Not noise. Cultural +<br />financial signal, unified.
        </p>

        {/* Search form */}
        <SearchForm onSubmit={handleAnalyze} loading={loading} />

        {/* Agent progress */}
        {steps.length > 0 && <AgentProgress steps={steps} />}

        {/* Error */}
        {error && (
          <div
            className="mt-6 p-4 font-mono text-xs border"
            style={{ borderColor: "var(--red)", color: "var(--red)", background: "#2a1010" }}
          >
            {error}
          </div>
        )}

        {/* Results */}
        {result && <ResultsPanel result={result} />}
      </main>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t px-6 py-4" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-lg mx-auto flex flex-wrap gap-x-6 gap-y-1 justify-between items-center">
          {["Forum API", "Nia · Exa", "Omnara Agent"].map(t => (
            <span key={t} className="font-mono text-[10px] tracking-widest" style={{ color: "var(--text-dim)" }}>
              {t}
            </span>
          ))}
          <span className="font-mono text-[10px]" style={{ color: "var(--text-dim)" }}>
            Not financial advice. Educational signal intelligence only.
          </span>
        </div>
      </footer>

    </div>
  );
}
