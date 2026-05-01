// READ instructions.txt before editing this file.
// Composes all result sections. Layout: ScoreCard → Synthesis → Chart+Cultural → Metrics → SEC → Sources.
// To add a new section: create a component and import here.

import { useCallback, useEffect, useState } from "react";
import type { AnalysisResult } from "@/types";
import ScoreCard from "./ScoreCard";
import ForumChart from "./ForumChart";
import CulturalSignals from "./CulturalSignals";
import MetricsPanel from "./MetricsPanel";
import SecFilingPanel from "./SecFilingPanel";
import SourcesList from "./SourcesList";
import PeerCohortPanel from "./PeerCohortPanel";

interface Props { result: AnalysisResult }

function quarterLabel(quarter: number, year: number) {
  return `Q${quarter} ${year}`;
}

const BULLETS_DEFAULT_SHOWN = 3;

function bulletColor(category: string, direction?: string): string {
  if (category === "cultural") return direction === "neg" ? "#fca5a5" : "#86efac";
  if (category === "financial") return direction === "neg" ? "#ff4c4c" : "#3ddc84";
  if (category === "filing") return direction === "neg" ? "#fdba74" : "#fde047";
  return "var(--accent)";
}
function bulletBg(category: string, direction?: string): string {
  if (category === "cultural") return direction === "neg" ? "rgba(252,165,165,0.08)" : "rgba(134,239,172,0.08)";
  if (category === "financial") return direction === "neg" ? "rgba(255,76,76,0.08)" : "rgba(61,220,132,0.08)";
  if (category === "filing") return direction === "neg" ? "rgba(253,186,116,0.1)" : "rgba(253,224,71,0.1)";
  return "rgba(245,166,35,0.08)";
}
function bulletLabel(category: string, direction?: string): string {
  if (category === "cultural") return direction === "neg" ? "cultural · negative" : "cultural · positive";
  if (category === "financial") return direction === "neg" ? "financial · negative" : "financial · positive";
  if (category === "filing") return direction === "neg" ? "filing · negative" : "filing · positive";
  return category;
}

function AlphaSynthesis({ result, onJumpToDetail }: { result: AnalysisResult; onJumpToDetail: (anchorId: string) => void }) {
  const [expanded,  setExpanded]  = useState(false);
  const [copied,    setCopied]    = useState(false);

  if (result.dataErrors?.synthesis) {
    return (
      <div className="panel-box fade-up fade-up-2">
        <div className="panel-label">Echelon Synthesis</div>
        <div style={{
          padding: 14,
          border: "1px solid var(--red)",
          background: "rgba(255,76,76,0.06)",
          color: "var(--red)",
          fontSize: 12,
          lineHeight: 1.6,
        }}>
          {result.dataErrors.synthesis}
        </div>
      </div>
    );
  }

  function handleCopy() {
    const text = [result.summary, "", ...result.reasoning.map(r => `• [${bulletLabel(r.category, r.direction)}] ${r.text}`)].join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  const visibleBullets = expanded ? result.reasoning : result.reasoning.slice(0, BULLETS_DEFAULT_SHOWN);
  const hiddenCount   = result.reasoning.length - BULLETS_DEFAULT_SHOWN;

  return (
    <div className="panel-box fade-up fade-up-2">
      {/* Header with copy button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div className="panel-label" style={{ marginBottom: 0 }}>Echelon Synthesis</div>
        <button
          onClick={handleCopy}
          title="Copy synthesis to clipboard"
          style={{
            background: "none",
            border: "1px solid var(--border)",
            color: copied ? "var(--green)" : "var(--text-muted)",
            cursor: "pointer",
            fontSize: 10,
            letterSpacing: "0.1em",
            padding: "4px 10px",
            fontFamily: "'DM Mono', monospace",
            transition: "all 0.15s",
            flexShrink: 0,
          }}
          onMouseEnter={e => { if (!copied) { e.currentTarget.style.borderColor = "var(--accent-dim)"; e.currentTarget.style.color = "var(--accent)"; }}}
          onMouseLeave={e => { if (!copied) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}}
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>

      {/* Summary paragraphs */}
      <div style={{
        borderLeft: "2px solid var(--accent)", paddingLeft: 16, marginBottom: 24,
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        {result.summary.split("\n\n").map((para, i) => (
          <p key={i} style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text)", margin: 0 }}>
            {para}
          </p>
        ))}
      </div>

      {/* Signal bullets — top N always visible */}
      {result.reasoning.length > 0 && (
        <div>
          <p style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 12 }}>
            Key Signals
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {visibleBullets.map((pt, i) => (
              <div
                key={i}
                style={{
                  border: `1px solid ${bulletColor(pt.category, pt.direction)}`,
                  background: bulletBg(pt.category, pt.direction),
                  padding: "10px 12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ color: bulletColor(pt.category, pt.direction), fontSize: 11, marginTop: 2, flexShrink: 0 }}>▸</span>
                  <div style={{ flex: 1 }}>
                    <span style={{
                      fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase",
                      color: bulletColor(pt.category, pt.direction), display: "block", marginBottom: 4,
                    }}>
                      {bulletLabel(pt.category, pt.direction)}
                    </span>
                    <p style={{ fontSize: 12, lineHeight: 1.65, color: "var(--text)", margin: 0 }}>
                      {pt.text}
                    </p>
                    {pt.detailAnchor && (
                      <button
                        type="button"
                        onClick={() => onJumpToDetail(pt.detailAnchor!)}
                        style={{
                          marginTop: 8,
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          fontSize: 10,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          color: "var(--accent)",
                          fontFamily: "'DM Mono', monospace",
                        }}
                      >
                        View in detail ↓
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Expand / collapse */}
          {hiddenCount > 0 && (
            <button
              onClick={() => setExpanded(e => !e)}
              style={{
                marginTop: 12,
                background: "none",
                border: "1px solid var(--border)",
                color: "var(--accent)",
                cursor: "pointer",
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                padding: "6px 14px",
                fontFamily: "'DM Mono', monospace",
                transition: "all 0.15s",
                width: "100%",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent-dim)"; e.currentTarget.style.background = "rgba(245,166,35,0.05)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "none"; }}
            >
              {expanded ? `Show less ↑` : `Show ${hiddenCount} more signal${hiddenCount !== 1 ? "s" : ""} ↓`}
            </button>
          )}
        </div>
      )}

      {/* Citation tags */}
      {result.sources.length > 0 && (
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border)",
          display: "flex", flexWrap: "wrap", gap: 8 }}>
          {result.sources.map((src, i) => (
            <span key={i} style={{ fontSize: 10, padding: "4px 10px",
              border: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <span style={{ color: "var(--accent)", marginRight: 4 }}>[{i + 1}]</span>
              {src.title}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ResultsPanel({ result }: Props) {
  const periodLabel = quarterLabel(result.timeframe.quarter, result.timeframe.year);
  const [expandCulturalForDetail, setExpandCulturalForDetail] = useState(false);

  useEffect(() => {
    setExpandCulturalForDetail(false);
  }, [result.ticker, result.timeframe.quarter, result.timeframe.year]);

  const jumpToDetail = useCallback((anchorId: string) => {
    if (anchorId.startsWith("cultural-signal-")) {
      setExpandCulturalForDetail(true);
    }
    const scroll = () => {
      const el = document.getElementById(anchorId);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const prevBox = el.style.boxShadow;
      const prevTr = el.style.transition;
      el.style.transition = "box-shadow 0.35s ease";
      el.style.boxShadow = "0 0 0 2px var(--accent), 0 0 20px rgba(245,166,35,0.2)";
      window.setTimeout(() => {
        el.style.boxShadow = prevBox;
        el.style.transition = prevTr;
      }, 1600);
    };
    if (anchorId.startsWith("cultural-signal-")) {
      requestAnimationFrame(() => requestAnimationFrame(scroll));
    } else {
      scroll();
    }
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 80 }}>

      {/* 1 — Signal overview (price delta + scores) */}
      <ScoreCard result={result} error={result.dataErrors?.scorecard} />

      {/* 2 — Peer cohort comparison */}
      <PeerCohortPanel result={result} />

      {/* 3 — Synthesis (LLM summary + signal bullets) */}
      <AlphaSynthesis result={result} onJumpToDetail={jumpToDetail} />

      {/* 4 — Chart + Cultural signals side by side */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }} className="fade-up fade-up-3">
        <ForumChart data={result.forumChart} error={result.dataErrors?.forumChart} />
        <CulturalSignals
          signals={result.culturalSignals}
          error={result.dataErrors?.cultural}
          expandForDeepLink={expandCulturalForDetail}
        />
      </div>

      {/* 5 — Financial metrics */}
      <MetricsPanel metrics={result.metrics} periodLabel={periodLabel} error={result.dataErrors?.financial} />

      {/* 6 — SEC filing */}
      <SecFilingPanel
        filing={result.secFiling}
        error={result.dataErrors?.secFiling}
        quarter={result.timeframe.quarter}
        year={result.timeframe.year}
      />

      {/* 7 — Sources */}
      <SourcesList sources={result.sources} error={result.dataErrors?.sources} />
    </div>
  );
}
