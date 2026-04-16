// SEC EDGAR 10-Q filing panel.
// Shows filing metadata, key financial highlights as bullets, and a link to the actual document.

import type { SecFiling } from "@/types";

interface Props {
  filing?: SecFiling | null;
  error?: string;
  quarter: number;
  year: number;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export default function SecFilingPanel({ filing, error, quarter, year }: Props) {
  const label = `SEC 10-Q · Q${quarter} ${year}`;

  if (error && !filing) {
    return (
      <div className="panel-box fade-up fade-up-5">
        <div className="panel-label">{label}</div>
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

  if (!filing) return null;

  return (
    <div className="panel-box fade-up fade-up-5">
      <div className="panel-label">{label}</div>

      {/* Metadata row */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "6px 24px",
        marginBottom: filing.highlights.length > 0 ? 20 : 0,
        fontSize: 12,
        color: "var(--text-muted)",
      }}>
        {filing.filingDate && (
          <span>
            <span style={{ color: "var(--accent)", marginRight: 6 }}>Filed</span>
            {formatDate(filing.filingDate)}
          </span>
        )}
        {filing.periodOfReport && (
          <span>
            <span style={{ color: "var(--accent)", marginRight: 6 }}>Period end</span>
            {formatDate(filing.periodOfReport)}
          </span>
        )}
        {filing.companyName && (
          <span>
            <span style={{ color: "var(--accent)", marginRight: 6 }}>Entity</span>
            {filing.companyName}
          </span>
        )}
      </div>

      {/* Financial highlights as bullets */}
      {filing.highlights.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {filing.highlights.map((h, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 14px",
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
              }}
            >
              <span style={{
                color: "var(--accent)",
                fontSize: 10,
                marginTop: 3,
                flexShrink: 0,
                letterSpacing: "0.05em",
              }}>▸</span>
              <p style={{
                fontSize: 12,
                lineHeight: 1.7,
                color: "var(--text)",
                margin: 0,
              }}>
                {h}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Link directly to the filing document */}
      <a
        href={filing.documentUrl || filing.filingUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--accent)",
          textDecoration: "none",
          borderBottom: "1px solid var(--accent)",
          paddingBottom: 2,
        }}
      >
        Open 10-Q Filing
        <span style={{ fontSize: 10 }}>↗</span>
      </a>
    </div>
  );
}
