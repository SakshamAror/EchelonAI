// READ instructions.txt before editing this file.
// NEW component — Cultural Signals timeline panel.
// Receives CulturalSignal[] from AnalysisResult.culturalSignals.

import { useState } from "react";
import type { CulturalSignal } from "@/types";

interface Props {
  signals: CulturalSignal[];
  error?: string;
  /** When true, show every signal row (used when jumping from Key Signals). */
  expandForDeepLink?: boolean;
}

const SENTIMENT_STYLES: Record<string, { dot: string; border: string; titleColor: string; bodyColor: string }> = {
  pos: {
    dot:        "var(--green)",
    border:     "var(--signal-pos-border)",
    titleColor: "var(--signal-pos-title)",
    bodyColor:  "var(--signal-pos-body)",
  },
  neg: {
    dot:        "var(--red)",
    border:     "var(--signal-neg-border)",
    titleColor: "var(--signal-neg-title)",
    bodyColor:  "var(--signal-neg-body)",
  },
  neutral: {
    dot:        "var(--signal-neu-dot)",
    border:     "var(--signal-neu-border)",
    titleColor: "var(--signal-neu-title)",
    bodyColor:  "var(--text-muted)",
  },
};

const SENTIMENT_ORDER: Record<string, number> = { pos: 0, neg: 1, neutral: 2 };

/** Strip markdown image tags, links, headings, and collapse whitespace. */
function cleanMarkdown(text: string): string {
  return text
    .replace(/!\[.*?\]\(.*?\)/g, "")                // ![alt](url)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")        // [text](url) → text
    .replace(/^#{1,6}\s*/gm, "")                    // ## headings
    .replace(/\*\*(.*?)\*\*/g, "$1")                // **bold**
    .replace(/\*(.*?)\*/g, "$1")                    // *italic*
    .replace(/`([^`]+)`/g, "$1")                    // `code`
    .replace(/https?:\/\/\S+/g, "")                 // bare URLs
    .replace(/\s+/g, " ")
    .trim();
}

/** Split "Title sentence. Rest of content..." into { title, body }. */
function splitText(raw: string): { title: string; body: string } {
  const clean = cleanMarkdown(raw);
  // Split at first period followed by space/end
  const match = clean.match(/^(.+?[.!?])\s+(.+)$/s);
  if (match) {
    return {
      title: match[1].trim(),
      body:  match[2].trim().slice(0, 220) + (match[2].trim().length > 220 ? "…" : ""),
    };
  }
  return { title: clean.slice(0, 120), body: "" };
}

export default function CulturalSignals({ signals, error, expandForDeepLink = false }: Props) {
  const [expanded, setExpanded] = useState(false);

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

  const indexed = signals.map((sig, idx) => ({ sig, signalIndex1: idx + 1 }));
  const sorted = [...indexed].sort(
    (a, b) => (SENTIMENT_ORDER[a.sig.sentiment] ?? 2) - (SENTIMENT_ORDER[b.sig.sentiment] ?? 2)
  );

  const INITIAL_SHOW = 2;
  const showAll = expanded || expandForDeepLink;
  const visible = showAll ? sorted : sorted.slice(0, INITIAL_SHOW);
  const hiddenCount = sorted.length - INITIAL_SHOW;

  return (
    <div className="panel-box">
      <div className="panel-label">Cultural Signals</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map(({ sig, signalIndex1 }) => {
          const style = SENTIMENT_STYLES[sig.sentiment] ?? SENTIMENT_STYLES.neutral;
          const { title, body } = splitText(sig.text);
          return (
            <div
              id={`cultural-signal-${signalIndex1}`}
              className="echelon-jump-target"
              key={signalIndex1}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                padding: "10px 12px",
                borderLeft: `3px solid ${style.border}`,
                background: "var(--signal-item-bg)",
              }}
            >
              <span style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: style.dot,
                flexShrink: 0,
                marginTop: 5,
              }} />
              <div>
                <p style={{
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: 1.5,
                  color: style.titleColor,
                  margin: 0,
                }}>
                  {title}
                </p>
                {body && (
                  <p style={{
                    fontSize: 11,
                    lineHeight: 1.6,
                    color: style.bodyColor,
                    margin: "4px 0 0",
                  }}>
                    {body}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {sorted.length > INITIAL_SHOW && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            marginTop: 12,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--accent)",
            padding: 0,
          }}
        >
          {expanded ? "Show Less" : `Show ${hiddenCount} More`}
        </button>
      )}
    </div>
  );
}
