// READ instructions.txt before editing this file.
// Detailed sources list — shown below Alpha Synthesis as expandable reference.

import type { Source } from "@/types";

interface Props { sources: Source[]; error?: string }

const typeLabel: Record<Source["type"], string> = {
  news: "NEWS", filing: "SEC", forum: "FORUM", web: "WEB",
};
const typeColor: Record<Source["type"], string> = {
  news: "var(--accent)", filing: "var(--purple)", forum: "var(--green)", web: "var(--text-muted)",
};

export default function SourcesList({ sources, error }: Props) {
  if (error) {
    return (
      <div className="panel-box fade-up fade-up-4" style={{ marginBottom: 0 }}>
        <div className="panel-label">All Sources</div>
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
  if (sources.length === 0) return null;
  return (
    <div className="panel-box fade-up fade-up-4" style={{ marginBottom: 0 }}>
      <div className="panel-label">All Sources ({sources.length})</div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {sources.map((src, i) => (
          <a
            key={i}
            href={src.url === "#" ? undefined : src.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none" }}
          >
            <div
              style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "12px 0",
                borderBottom: i < sources.length - 1 ? "1px solid var(--border)" : "none",
                cursor: src.url !== "#" ? "pointer" : "default",
              }}
              onMouseEnter={e => { if (src.url !== "#") (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <span style={{ fontSize: 9, letterSpacing: "0.15em", color: typeColor[src.type],
                minWidth: 44, paddingTop: 2 }}>
                {typeLabel[src.type]}
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, color: "var(--text)" }}>{src.title}</p>
                <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{src.date}</p>
              </div>
              {src.url !== "#" && (
                <span style={{ fontSize: 12, color: "var(--text-muted)", paddingTop: 2 }}>↗</span>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
