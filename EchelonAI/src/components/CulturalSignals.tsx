// READ instructions.txt before editing this file.
// NEW component — Cultural Signals timeline panel.
// Receives CulturalSignal[] from AnalysisResult.culturalSignals.

import { useState } from "react";
import type { CulturalSignal } from "@/types";

interface Props { signals: CulturalSignal[]; error?: string }

const SENTIMENT_STYLES: Record<string, { dot: string; border: string; titleColor: string; bodyColor: string }> = {
  pos: {
    dot:        "var(--green)",
    border:     "rgba(61,220,132,0.35)",
    titleColor: "#9ee8be",
    bodyColor:  "#7ec9a4",
  },
  neg: {
    dot:        "var(--red)",
    border:     "rgba(255,76,76,0.35)",
    titleColor: "#f5a0a0",
    bodyColor:  "#d88080",
  },
  neutral: {
    dot:        "#c8a84b",
    border:     "rgba(200,168,75,0.3)",
    titleColor: "#e0d09a",
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

export default function CulturalSignals({ signals, error }: Props) {
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

  const sorted = [...signals]
    .sort((a, b) => (SENTIMENT_ORDER[a.sentiment] ?? 2) - (SENTIMENT_ORDER[b.sentiment] ?? 2))
    .slice(0, 10);

  const INITIAL_SHOW = 2;
  const visible = expanded ? sorted : sorted.slice(0, INITIAL_SHOW);
  const hiddenCount = sorted.length - INITIAL_SHOW;

  return (
    <div className="panel-box">
      <div className="panel-label">Cultural Signals</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map((sig, i) => {
          const style = SENTIMENT_STYLES[sig.sentiment] ?? SENTIMENT_STYLES.neutral;
          const { title, body } = splitText(sig.text);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                padding: "10px 12px",
                borderLeft: `3px solid ${style.border}`,
                background: "rgba(255,255,255,0.02)",
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
