import { useEffect, useRef, useState } from "react";
import { Settings } from "lucide-react";
import type { Stats } from "@/lib/portfolioStats";

type Tier = "core" | "advanced";

interface StatDef {
  key: keyof Stats;
  label: string;
  fmt: (v: number) => string;
  color?: (v: number) => string;   // sign-based color
  tier: Tier;
}

const money = (v: number) => `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
const pctNoSign = (v: number) => `${v.toFixed(2)}%`;
const num = (v: number) => v.toFixed(2);
const signColor = (v: number) => (v > 0 ? "var(--green)" : v < 0 ? "var(--red)" : "var(--text)");

const DEFS: StatDef[] = [
  { key: "pnl",          label: "PnL",          fmt: money,      color: signColor, tier: "core" },
  { key: "totalReturn",  label: "Total Return", fmt: pct,        color: signColor, tier: "core" },
  { key: "cagr",         label: "CAGR",         fmt: pct,        color: signColor, tier: "core" },
  { key: "vsSpy",        label: "vs SPY",       fmt: pct,        color: signColor, tier: "core" },
  { key: "maxDrawdown",  label: "Max DD",       fmt: pctNoSign,  color: () => "var(--red)", tier: "core" },
  { key: "sharpe",       label: "Sharpe",       fmt: num,        color: signColor, tier: "core" },
  { key: "winRate",      label: "Win Rate",     fmt: pctNoSign,  tier: "core" },
  { key: "sortino",      label: "Sortino",      fmt: num,        color: signColor, tier: "advanced" },
  { key: "calmar",       label: "Calmar",       fmt: num,        color: signColor, tier: "advanced" },
  { key: "volatility",   label: "Volatility",   fmt: pctNoSign,  tier: "advanced" },
  { key: "beta",         label: "Beta",         fmt: num,        tier: "advanced" },
  { key: "alpha",        label: "Alpha",        fmt: pct,        color: signColor, tier: "advanced" },
  { key: "plRatio",      label: "P/L Ratio",    fmt: num,        tier: "advanced" },
];

function loadTier(): Tier {
  return localStorage.getItem("echelon_stats_tier") === "advanced" ? "advanced" : "core";
}

export default function StatsBar({ stats }: { stats: Stats | null }) {
  const [tier, setTier] = useState<Tier>(loadTier);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { localStorage.setItem("echelon_stats_tier", tier); }, [tier]);
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const shown = DEFS.filter(d => tier === "advanced" || d.tier === "core");

  return (
    <div style={{
      // full-bleed: span the viewport width even inside a centered container
      width: "100vw", marginLeft: "calc(50% - 50vw)",
      background: "var(--surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)",
      padding: "14px 40px", marginBottom: 24,
      display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap",
    }}>
      {shown.map(d => {
        const v = stats ? stats[d.key] : null;
        return (
          <div key={d.key} style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 64 }}>
            <span style={{ fontSize: 9, letterSpacing: "0.16em", color: "var(--text-muted)", textTransform: "uppercase" }}>
              {d.label}
            </span>
            <span style={{
              fontSize: 17, fontWeight: 600, fontFamily: "'DM Mono', monospace",
              color: v == null ? "var(--text-dim)" : (d.color ? d.color(v) : "var(--text)"),
            }}>
              {v == null ? "—" : d.fmt(v)}
            </span>
          </div>
        );
      })}

      {/* tier settings */}
      <div ref={menuRef} style={{ marginLeft: "auto", position: "relative" }}>
        <button onClick={() => setMenuOpen(o => !o)} title="Choose metrics"
          style={{
            background: "none", border: "1px solid var(--border)", cursor: "pointer",
            color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center",
            width: 30, height: 30,
          }}>
          <Settings size={14} />
        </button>
        {menuOpen && (
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 120,
            background: "var(--surface-2)", border: "1px solid var(--border-2)", minWidth: 150,
          }}>
            {(["core", "advanced"] as Tier[]).map(t => (
              <button key={t} onClick={() => { setTier(t); setMenuOpen(false); }}
                style={{
                  display: "block", width: "100%", textAlign: "left", padding: "9px 12px",
                  background: t === tier ? "rgba(245,166,35,0.10)" : "transparent", border: "none",
                  color: t === tier ? "var(--accent)" : "var(--text)", cursor: "pointer",
                  fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
                }}>
                {t === "core" ? "Core (7)" : "Advanced (13)"}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
