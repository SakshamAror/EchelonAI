// READ instructions.txt before editing this file.
// Composes all result sections. Layout: ScoreCard → 2-col grid → Metrics → Synthesis.
// To add a new section: create a component and import here.

import type { AnalysisResult } from "@/types";
import ScoreCard from "./ScoreCard";
import ForumChart from "./ForumChart";
import CulturalSignals from "./CulturalSignals";
import MetricsPanel from "./MetricsPanel";
import SourcesList from "./SourcesList";

interface Props { result: AnalysisResult }

function quarterLabel(quarter: number, year: number) {
  return `Q${quarter} ${year}`;
}

function toConciseSentences(text: string, maxSentences: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean);
  return sentences.slice(0, maxSentences).join(" ");
}

function splitInsight(text: string): { insight: string; why: string } {
  const marker = "Why it matters:";
  const idx = text.indexOf(marker);
  if (idx === -1) {
    return { insight: toConciseSentences(text, 1), why: "" };
  }
  const insight = text.slice(0, idx).trim();
  const why = text.slice(idx + marker.length).trim();
  return {
    insight: toConcSentencesSafe(insight, 1),
    why: toConcSentencesSafe(why, 2),
  };
}

function toConcSentencesSafe(text: string, maxSentences: number): string {
  const concise = toConciseSentences(text, maxSentences);
  return concise || text.trim();
}

function AlphaSynthesis({ result }: { result: AnalysisResult }) {
  if (result.dataErrors?.synthesis) {
    return (
      <div className="panel-box fade-up fade-up-4">
        <div className="panel-label">Alpha Synthesis</div>
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

  const catColor: Record<string, string> = {
    cultural:  "var(--purple)",
    financial: "var(--green)",
    filing:    "var(--accent)",
  };
  const catBg: Record<string, string> = {
    cultural: "rgba(119,110,255,0.08)",
    financial: "rgba(61,220,132,0.08)",
    filing: "rgba(245,166,35,0.08)",
  };
  const allReasoning = result.reasoning;
  return (
    <div className="panel-box fade-up fade-up-4">
      <div className="panel-label">Alpha Synthesis</div>
      {/* Italic serif intro */}
      <p className="font-display" style={{
        fontStyle: "italic", fontSize: 18, lineHeight: 1.65, color: "var(--text)",
        borderLeft: "2px solid var(--accent)", paddingLeft: 20, marginBottom: 24,
      }}>
        {result.summary}
      </p>
      <details style={{ marginTop: 6 }}>
        <summary style={{
          cursor: "pointer",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--accent)",
          userSelect: "none",
        }}>
          Read More ({allReasoning.length} Bullets)
        </summary>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
          {allReasoning.map((pt, i) => {
            const parts = splitInsight(pt.text);
            return (
              <div
                key={i}
                style={{
                  border: `1px solid ${catColor[pt.category] ?? "var(--border)"}`,
                  background: catBg[pt.category] ?? "rgba(255,255,255,0.03)",
                  padding: "10px 12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ color: catColor[pt.category] ?? "var(--accent)", fontSize: 13 }}>▸</span>
                  <span style={{
                    fontSize: 9,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: catColor[pt.category] ?? "var(--accent)",
                  }}>
                    {pt.category}
                  </span>
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.6, color: "#d2d0c8" }}>
                  <strong style={{ color: "var(--text)" }}>Insight:</strong> {parts.insight}
                </div>
                {parts.why && (
                  <div style={{ fontSize: 12, lineHeight: 1.6, color: "#b7b4ab", marginTop: 4 }}>
                    <strong style={{ color: "#d8d5cc" }}>Why it matters:</strong> {parts.why}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </details>
      {/* Citation tags */}
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
    </div>
  );
}

export default function ResultsPanel({ result }: Props) {
  const periodLabel = quarterLabel(result.timeframe.quarter, result.timeframe.year);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 80 }}>
      <ScoreCard result={result} error={result.dataErrors?.scorecard} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        className="fade-up fade-up-2">
        <ForumChart data={result.forumChart} error={result.dataErrors?.forumChart} />
        <CulturalSignals signals={result.culturalSignals} error={result.dataErrors?.cultural} />
      </div>
      <MetricsPanel metrics={result.metrics} periodLabel={periodLabel} error={result.dataErrors?.financial} />
      <AlphaSynthesis result={result} />
      <SourcesList sources={result.sources} error={result.dataErrors?.sources} />
    </div>
  );
}
