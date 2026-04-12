// READ instructions.txt before editing this file.
// Real-time agent step display. Steps stream from SSE (api/index.ts).

import type { AgentStep } from "@/types";

interface Props { steps: AgentStep[]; }

const DOT: Record<AgentStep["status"], string> = {
  pending: "○",
  running: "◉",
  done:    "●",
  error:   "✕",
};

const COLOR: Record<AgentStep["status"], string> = {
  pending: "var(--text-dim)",
  running: "var(--accent)",
  done:    "var(--text-muted)",
  error:   "var(--red)",
};

export default function AgentProgress({ steps }: Props) {
  if (steps.length === 0) return null;

  return (
    <div
      className="mt-8 p-4 border"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <p
        className="font-mono text-[9px] tracking-[0.25em] mb-4"
        style={{ color: "var(--text-muted)" }}
      >
        AGENT REASONING LOOP
      </p>
      <div className="space-y-2.5">
        {steps.map(step => (
          <div key={step.id} className="flex items-center gap-3">
            <span
              className="font-mono text-sm shrink-0 w-4 text-center"
              style={{
                color: COLOR[step.status],
                animation: step.status === "running" ? "pulse 1s infinite" : undefined,
              }}
            >
              {DOT[step.status]}
            </span>
            <span
              className="font-mono text-[11px] tracking-wide"
              style={{ color: step.status === "done" ? "var(--text-dim)" : COLOR[step.status] }}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}
