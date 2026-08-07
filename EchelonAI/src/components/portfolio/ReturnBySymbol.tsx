import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";

export interface SymbolReturn {
  ticker: string;
  side: "long" | "short";
  returnPct: number;   // sign-adjusted period return (green = you made money)
  pnl: number;         // $ P&L over the window
  closed?: boolean;    // position was fully closed within the window (realized)
}

function fmtMoney(v: number): string {
  return `${v < 0 ? "-" : "+"}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function Bars({ rows, onPick }: { rows: SymbolReturn[]; onPick: (t: string) => void }) {
  const maxAbs = Math.max(1, ...rows.map(r => Math.abs(r.returnPct)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {rows.map(r => {
        const pos = r.returnPct >= 0;
        const w = (Math.abs(r.returnPct) / maxAbs) * 50; // % of half-width
        const color = pos ? "var(--green)" : "var(--red)";
        return (
          <div key={r.ticker} onClick={() => onPick(r.ticker)}
            style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "5px 0", fontSize: 12 }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
            <span style={{ width: 62, color: "var(--accent)", flexShrink: 0 }}>
              {r.ticker}
              {r.side === "short" && <span style={{ color: "var(--red)", fontSize: 8, marginLeft: 3 }}>S</span>}
              {r.closed && <span title="Closed in period" style={{ color: "var(--text-dim)", fontSize: 8, marginLeft: 3 }}>C</span>}
            </span>
            <div style={{ flex: 1, position: "relative", height: 16 }}>
              <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--border-2)" }} />
              <div style={{
                position: "absolute", top: 3, bottom: 3, background: color, opacity: 0.85,
                [pos ? "left" : "right"]: "50%", width: `${w}%`,
              }} />
            </div>
            <span style={{ width: 62, textAlign: "right", color, flexShrink: 0 }}>
              {pos ? "+" : ""}{r.returnPct.toFixed(2)}%
            </span>
            <span style={{ width: 74, textAlign: "right", color: "var(--text-muted)", flexShrink: 0, fontSize: 11 }}>
              {fmtMoney(r.pnl)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function ReturnBySymbol({ data, onPick }: { data: SymbolReturn[]; onPick: (t: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...data].sort((a, b) => Math.abs(b.returnPct) - Math.abs(a.returnPct));
  const top = sorted.slice(0, 10).sort((a, b) => b.returnPct - a.returnPct);

  useEffect(() => {
    if (!expanded) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [expanded]);

  if (data.length === 0) {
    return <div style={{ fontSize: 11, color: "var(--text-dim)", padding: "12px 0" }}>No open positions.</div>;
  }

  return (
    <>
      <div style={{ position: "relative" }}>
        {sorted.length > 10 && (
          <button onClick={() => setExpanded(true)} title="Show all"
            style={{ position: "absolute", top: -34, right: 0, background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Maximize2 size={12} />
          </button>
        )}
        <Bars rows={top} onPick={onPick} />
        {sorted.length > 10 && (
          <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 8 }}>
            Top 10 of {sorted.length} — expand for all.
          </div>
        )}
      </div>

      {expanded && createPortal(
        <div onClick={() => setExpanded(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
          <div onClick={e => e.stopPropagation()} className="panel-box" style={{ width: "100%", maxWidth: 720, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div className="panel-label" style={{ marginBottom: 0 }}>Return by Symbol — All</div>
              <button onClick={() => setExpanded(false)} style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={14} />
              </button>
            </div>
            <Bars rows={sorted} onPick={onPick} />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
