// READ instructions.txt before editing this file.
// Composes all result sections. Layout: ScoreCard → 2-col grid → Metrics → Synthesis.
// To add a new section: create a component and import here.

import type { AnalysisResult } from "@/types";
import ScoreCard from "./ScoreCard";
import ForumChart from "./ForumChart";
import CulturalSignals from "./CulturalSignals";
import MetricsPanel from "./MetricsPanel";
import SecFilingPanel from "./SecFilingPanel";
import SourcesList from "./SourcesList";

interface Props { result: AnalysisResult }

function quarterLabel(quarter: number, year: number) {
  return `Q${quarter} ${year}`;
}


function AlphaSynthesis({ result }: { result: AnalysisResult }) {
  if (result.dataErrors?.synthesis) {
    return (
      <div className="panel-box fade-up fade-up-4">
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

  function bulletColor(category: string, direction?: string): string {
    if (category === "cultural") return direction === "neg" ? "#fca5a5" : "#86efac";
    if (category === "financial") return direction === "neg" ? "#ff4c4c" : "#3ddc84";
    return "var(--accent)";
  }
  function bulletBg(category: string, direction?: string): string {
    if (category === "cultural") return direction === "neg" ? "rgba(252,165,165,0.08)" : "rgba(134,239,172,0.08)";
    if (category === "financial") return direction === "neg" ? "rgba(255,76,76,0.08)" : "rgba(61,220,132,0.08)";
    return "rgba(245,166,35,0.08)";
  }
  function bulletLabel(category: string, direction?: string): string {
    if (category === "cultural") return direction === "neg" ? "cultural · negative" : "cultural · positive";
    if (category === "financial") return direction === "neg" ? "financial · negative" : "financial · positive";
    return category;
  }
  const allReasoning = result.reasoning;
  return (
    <div className="panel-box fade-up fade-up-4">
      <div className="panel-label">Echelon Synthesis</div>
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
            return (
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
                      fontSize: 8,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: bulletColor(pt.category, pt.direction),
                      display: "block",
                      marginBottom: 4,
                    }}>
                      {bulletLabel(pt.category, pt.direction)}
                    </span>
                    <p style={{ fontSize: 12, lineHeight: 1.65, color: "var(--text)", margin: 0 }}>
                      {pt.text}
                    </p>
                  </div>
                </div>
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
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}
        className="fade-up fade-up-2">
        <ForumChart data={result.forumChart} error={result.dataErrors?.forumChart} />
        <CulturalSignals signals={result.culturalSignals} error={result.dataErrors?.cultural} />
      </div>
      <MetricsPanel metrics={result.metrics} periodLabel={periodLabel} error={result.dataErrors?.financial} />
      <AlphaSynthesis result={result} />
      <SecFilingPanel
        filing={result.secFiling}
        error={result.dataErrors?.secFiling}
        quarter={result.timeframe.quarter}
        year={result.timeframe.year}
      />
      <SourcesList sources={result.sources} error={result.dataErrors?.sources} />
    </div>
  );
}
