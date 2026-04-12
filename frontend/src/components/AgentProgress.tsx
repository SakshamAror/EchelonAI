// READ instructions.txt before editing this file.
// Fullscreen loading overlay shown while the agent runs.
// Receives steps[] + company name for the header display.

import type { AgentStep } from "@/types";

interface Props {
  active: boolean;
  steps: AgentStep[];
  company: string;
  periodLabel: string;
}

const ICON: Record<AgentStep["status"], string> = {
  pending: "⬡",
  running: "⬡",
  done:    "✓",
  error:   "✕",
};

export default function AgentProgress({ active, steps, company, periodLabel }: Props) {
  if (!active) return null;
  if (steps.length === 0) return null;
  const allDone = steps.every(s => s.status === "done" || s.status === "error");
  if (allDone) return null;

  const doneCount = steps.filter(s => s.status === "done").length;
  const progress  = Math.round((doneCount / steps.length) * 100);

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(10,10,10,0.93)",
      zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
      gap: 20,
    }}>
      {/* Company name */}
      <p className="font-bebas" style={{ fontSize: 48, color: "var(--accent)", letterSpacing: 4 }}>
        {company.toUpperCase() || "ANALYZING"}
      </p>
      <p style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--text-muted)", marginTop: -16, marginBottom: 4 }}>
        {periodLabel.toUpperCase()}
      </p>

      {/* Steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.map(step => (
          <div key={step.id} style={{
            display: "flex", alignItems: "center", gap: 10,
            fontSize: 11, letterSpacing: "0.05em",
            color: step.status === "done"    ? "var(--green)"
                 : step.status === "running" ? "var(--accent)"
                 : step.status === "error"   ? "var(--red)"
                 : "var(--text-muted)",
            transition: "color 0.4s",
          }}>
            <span style={{
              width: 12, textAlign: "center",
              animation: step.status === "running" ? "blink 1.4s infinite" : undefined,
            }}>
              {ICON[step.status]}
            </span>
            {step.label}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ width: 300, height: 2, background: "var(--border)", marginTop: 8 }}>
        <div style={{
          height: "100%", background: "var(--accent)",
          width: `${progress}%`, transition: "width 0.6s ease",
        }} />
      </div>
    </div>
  );
}
