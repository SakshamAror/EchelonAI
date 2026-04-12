// READ instructions.txt before editing this file.
// NEW component — Cultural Signals timeline panel.
// Receives CulturalSignal[] from AnalysisResult.culturalSignals.

import type { CulturalSignal } from "@/types";

interface Props { signals: CulturalSignal[]; error?: string }

export default function CulturalSignals({ signals, error }: Props) {
  if (error) {
    return (
      <div className="panel-box">
        <div className="panel-label">Cultural Signals</div>
        <div style={{
          padding: 14,
          border: "1px solid var(--red)",
          background: "rgba(255,76,76,0.06)",
          color: "var(--red)",
          fontSize: 12,
          lineHeight: 1.6,
        }}>
          {error}
        </div>
      </div>
    );
  }
  return (
    <div className="panel-box">
      <div className="panel-label">Cultural Signals</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {signals.map((sig, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
              paddingBottom: i < signals.length - 1 ? 16 : 0,
              marginBottom: i < signals.length - 1 ? 16 : 0,
              borderBottom: i < signals.length - 1 ? "1px solid var(--border)" : "none",
            }}
          >
            {/* Date */}
            <span style={{
              fontSize: 10,
              color: "var(--text-muted)",
              whiteSpace: "nowrap",
              paddingTop: 3,
              minWidth: 44,
              letterSpacing: "0.05em",
            }}>
              {sig.date}
            </span>

            {/* Sentiment dot */}
            <span style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: sig.sentiment === "pos"
                ? "var(--green)"
                : sig.sentiment === "neg"
                ? "var(--red)"
                : "var(--text-muted)",
              flexShrink: 0,
              marginTop: 5,
            }} />

            {/* Text + source */}
            <div>
              <p style={{ fontSize: 12, lineHeight: 1.65, color: "var(--text)" }}>
                {sig.text}
              </p>
              <p style={{ fontSize: 10, color: "var(--accent-dim)", marginTop: 3 }}>
                ↗ {sig.source}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
