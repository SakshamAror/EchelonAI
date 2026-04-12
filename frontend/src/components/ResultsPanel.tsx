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

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

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
      {/* Reasoning bullets */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {result.reasoning.map((pt, i) => (
          <div key={i} style={{ display: "flex", gap: 14, fontSize: 12, lineHeight: 1.7, color: "#aaa8a0" }}>
            <span style={{ color: catColor[pt.category] ?? "var(--accent)", flexShrink: 0, fontSize: 14, marginTop: 1 }}>▸</span>
            <span>{pt.text}</span>
          </div>
        ))}
      </div>
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
  const periodLabel = `${MONTH_NAMES[result.timeframe.month - 1]} ${result.timeframe.year}`;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 80 }}>
      <ScoreCard result={result} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        className="fade-up fade-up-2">
        <ForumChart data={result.forumChart} />
        <CulturalSignals signals={result.culturalSignals} error={result.dataErrors?.cultural} />
      </div>
      <MetricsPanel metrics={result.metrics} periodLabel={periodLabel} error={result.dataErrors?.financial} />
      <AlphaSynthesis result={result} />
      <SourcesList sources={result.sources} />
    </div>
  );
}
