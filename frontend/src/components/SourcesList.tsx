// READ instructions.txt before editing this file.
// Cited sources list. Types: "news" | "filing" | "forum" | "web"

import type { Source } from "@/types";

interface Props { sources: Source[]; }

const typeLabel: Record<Source["type"], string> = {
  news:   "NEWS",
  filing: "SEC",
  forum:  "FORUM",
  web:    "WEB",
};
const typeColor: Record<Source["type"], string> = {
  news:   "var(--accent)",
  filing: "#a78bfa",
  forum:  "var(--green)",
  web:    "var(--text-muted)",
};

export default function SourcesList({ sources }: Props) {
  if (sources.length === 0) return null;

  return (
    <div
      className="mt-4 border"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <p className="font-mono text-[9px] tracking-[0.25em]" style={{ color: "var(--text-muted)" }}>
          CITED SOURCES ({sources.length})
        </p>
      </div>
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {sources.map((src, i) => (
          <a
            key={i}
            href={src.url === "#" ? undefined : src.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-4 px-4 py-3 transition-colors group"
            style={{ textDecoration: "none" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-2, #252525)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <span
              className="font-mono text-[9px] tracking-widest shrink-0 mt-0.5 w-10"
              style={{ color: typeColor[src.type] }}
            >
              {typeLabel[src.type]}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className="font-mono text-[11px] leading-snug"
                style={{ color: "var(--text)" }}
              >
                {src.title}
              </p>
              <p className="font-mono text-[9px] mt-1" style={{ color: "var(--text-dim)" }}>
                {src.date}
              </p>
            </div>
            {src.url !== "#" && (
              <span className="font-mono text-[10px] shrink-0 mt-0.5" style={{ color: "var(--text-dim)" }}>↗</span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
