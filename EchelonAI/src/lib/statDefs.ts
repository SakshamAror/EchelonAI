import type { Stats } from "@/lib/portfolioStats";
import type { Tier } from "@/lib/useStatsTier";

export interface StatDef {
  key: keyof Stats;
  label: string;
  fmt: (v: number) => string;
  color?: (v: number) => string;   // sign-based color
  tier: Tier;
}

export const money = (v: number) => `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
export const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
export const pctNoSign = (v: number) => `${v.toFixed(2)}%`;
export const num = (v: number) => v.toFixed(2);
export const signColor = (v: number) => (v > 0 ? "var(--green)" : v < 0 ? "var(--red)" : "var(--text)");

export const STAT_DEFS: StatDef[] = [
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
  { key: "volatilityDrag", label: "Vol. Drag",  fmt: pctNoSign,  tier: "advanced" },
];
