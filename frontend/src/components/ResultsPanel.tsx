// READ instructions.txt before editing this file.
// Composes all output sections. To add a new section, create a component and import here.

import type { AnalysisResult, ReasoningPoint } from "@/types";
import ScoreCard from "./ScoreCard";
import MetricsPanel from "./MetricsPanel";
import SourcesList from "./SourcesList";

interface Props { result: AnalysisResult; }

const catLabel: Record<ReasoningPoint["category"], string> = {
  cultural:  "CULTURAL",
  financial: "FINANCIAL",
  filing:    "FILING",
};
const catColor: Record<ReasoningPoint["category"], string> = {
  cultural:  "var(--accent)",
  financial: "var(--green)",
  filing:    "#a78bfa",
};

function ReasoningList({ reasoning }: { reasoning: ReasoningPoint[] }) {
  return (
    <div
      className="mt-4 border"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <p className="font-mono text-[9px] tracking-[0.25em]" style={{ color: "var(--text-muted)" }}>
          MOVEMENT DRIVERS
        </p>
      </div>
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {reasoning.map((point, i) => (
          <div key={i} className="px-4 py-4 flex gap-4">
            <span
              className="font-mono text-[9px] tracking-widest shrink-0 mt-0.5 w-16"
              style={{ color: catColor[point.category] }}
            >
              {catLabel[point.category]}
            </span>
            <div>
              <p className="font-mono text-[11px] leading-relaxed" style={{ color: "var(--text)" }}>
                {point.text}
              </p>
              {point.sources.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {point.sources.map((src, j) => (
                    <span
                      key={j}
                      className="font-mono text-[9px] px-2 py-0.5 border tracking-wide"
                      style={{
                        borderColor: "var(--border)",
                        color: "var(--text-muted)",
                        background: "var(--surface-2, #252525)",
                      }}
                    >
                      {src.title}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ResultsPanel({ result }: Props) {
  return (
    <div className="mt-2 pb-12">
      <ScoreCard result={result} />
      <MetricsPanel metrics={result.metrics} />
      <ReasoningList reasoning={result.reasoning} />
      <SourcesList sources={result.sources} />
    </div>
  );
}
