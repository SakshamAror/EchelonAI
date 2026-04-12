// READ instructions.txt before editing this file.
// Horizontal input row: company field + month select + analyze button.
// Keep form logic here, not in App.tsx.

import { useState } from "react";
import type { AnalysisRequest, TimeFrame } from "@/types";

interface Props {
  onSubmit: (req: AnalysisRequest) => void;
  loading: boolean;
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const YEARS = [2025, 2024, 2023, 2022, 2021];
const PERIOD_OPTIONS: TimeFrame[] = YEARS.flatMap(year =>
  Array.from({ length: 12 }, (_, i) => ({ month: 12 - i, year }))
);

export function periodLabel({ month, year }: TimeFrame) {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}
function periodValue({ month, year }: TimeFrame) { return `${month}-${year}`; }

const DEMO_SUGGESTIONS = [
  { company: "Nike",   timeframe: { month: 9,  year: 2024 } },
  { company: "Nvidia", timeframe: { month: 8,  year: 2024 } },
  { company: "Tesla",  timeframe: { month: 12, year: 2023 } },
];

const BASE: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  fontFamily: "'DM Mono', monospace",
  fontSize: 14,
  padding: "14px 16px",
  outline: "none",
  transition: "border-color 0.2s",
  width: "100%",
};

export default function SearchForm({ onSubmit, loading }: Props) {
  const [company,   setCompany]   = useState("");
  const [timeframe, setTimeframe] = useState<TimeFrame>({ month: 10, year: 2024 });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim()) return;
    onSubmit({ company: company.trim(), timeframe });
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Labels row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
        <div style={{ flex: 2 }}>
          <label style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--text-muted)", textTransform: "uppercase" }}>
            Term / Company
          </label>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--text-muted)", textTransform: "uppercase" }}>
            Month
          </label>
        </div>
        <div style={{ width: 120 }} />
      </div>

      {/* Input row */}
      <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
        {/* Company */}
        <input
          style={{ ...BASE, flex: 2 }}
          type="text"
          value={company}
          onChange={e => setCompany(e.target.value)}
          placeholder="e.g. Nike, Ozempic, Taylor Swift..."
          disabled={loading}
          onFocus={e => { e.currentTarget.style.borderColor = "var(--accent-dim)"; }}
          onBlur={e  => { e.currentTarget.style.borderColor = "var(--border)"; }}
        />

        {/* Month select */}
        <div style={{ flex: 1, position: "relative" }}>
          <select
            style={{
              ...BASE,
              appearance: "none", WebkitAppearance: "none",
              cursor: "pointer", paddingRight: 36,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='%23555550'%3E%3Cpath d='M6 8L0 0h12z'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 14px center",
            }}
            value={periodValue(timeframe)}
            onChange={e => {
              const [m, y] = e.target.value.split("-");
              setTimeframe({ month: Number(m), year: Number(y) });
            }}
            disabled={loading}
          >
            {PERIOD_OPTIONS.map(opt => (
              <option key={periodValue(opt)} value={periodValue(opt)}>
                {periodLabel(opt)}
              </option>
            ))}
          </select>
        </div>

        {/* Analyze button */}
        <button
          type="submit"
          disabled={loading || !company.trim()}
          style={{
            background: loading || !company.trim() ? "var(--border)" : "var(--accent)",
            color: loading || !company.trim() ? "var(--text-muted)" : "#000",
            border: "none", cursor: loading || !company.trim() ? "not-allowed" : "pointer",
            fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 500,
            letterSpacing: "0.15em", textTransform: "uppercase",
            padding: "0 28px", whiteSpace: "nowrap",
            transition: "all 0.2s",
          }}
          onMouseEnter={e => { if (!loading && company.trim()) { e.currentTarget.style.background = "#fff"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
          onMouseLeave={e => { e.currentTarget.style.background = "var(--accent)"; e.currentTarget.style.transform = "none"; }}
        >
          {loading ? "Analyzing..." : "Analyze →"}
        </button>
      </div>

      {/* Demo chips */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 16 }}>
        <span style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--text-muted)", textTransform: "uppercase", marginRight: 4 }}>
          Try:
        </span>
        {DEMO_SUGGESTIONS.map(s => (
          <button
            key={s.company}
            type="button"
            onClick={() => { setCompany(s.company); setTimeframe(s.timeframe); }}
            disabled={loading}
            style={{
              fontSize: 11, padding: "4px 12px", border: "1px solid var(--border)",
              color: "var(--text-muted)", cursor: "pointer", background: "transparent",
              fontFamily: "'DM Mono', monospace", transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent-dim)"; e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.background = "rgba(245,166,35,0.05)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}
          >
            {s.company}
          </button>
        ))}
      </div>
    </form>
  );
}
