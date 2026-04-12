// READ instructions.txt before editing this file.
// Company + timeframe input form. Keep form logic here, not in App.tsx.

import { useState } from "react";
import type { AnalysisRequest, Quarter, TimeFrame } from "@/types";

interface Props {
  onSubmit: (req: AnalysisRequest) => void;
  loading: boolean;
}

const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];
const YEARS = [2024, 2023, 2022, 2021];

// Maps quarter+year → display label like "Q3 2024"
function quarterLabel(q: Quarter, y: number) { return `${q} ${y}`; }

// Flattened list for the single dropdown
const PERIOD_OPTIONS: { quarter: Quarter; year: number }[] = YEARS.flatMap(y =>
  QUARTERS.map(q => ({ quarter: q, year: y }))
);

const DEMO_SUGGESTIONS = [
  { company: "Nike",   quarter: "Q3" as Quarter, year: 2024 },
  { company: "Nvidia", quarter: "Q2" as Quarter, year: 2024 },
  { company: "Tesla",  quarter: "Q4" as Quarter, year: 2023 },
];

const INPUT_STYLE: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  fontFamily: "'Space Mono', monospace",
  fontSize: "13px",
  outline: "none",
  width: "100%",
  padding: "14px 16px",
  transition: "border-color 0.15s",
};

export default function SearchForm({ onSubmit, loading }: Props) {
  const [company,   setCompany]   = useState("");
  const [timeframe, setTimeframe] = useState<TimeFrame>({ quarter: "Q3", year: 2024 });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim()) return;
    onSubmit({ company: company.trim(), timeframe });
  }

  function fillDemo(s: typeof DEMO_SUGGESTIONS[0]) {
    setCompany(s.company);
    setTimeframe({ quarter: s.quarter, year: s.year });
  }

  const periodValue = `${timeframe.quarter}-${timeframe.year}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Company input */}
      <div>
        <label
          className="block font-mono text-[10px] tracking-[0.2em] mb-2"
          style={{ color: "var(--text-muted)" }}
        >
          TERM / COMPANY
        </label>
        <input
          type="text"
          value={company}
          onChange={e => setCompany(e.target.value)}
          placeholder="e.g. Nike, Ozempic, Taylor Swift..."
          disabled={loading}
          style={INPUT_STYLE}
          onFocus={e  => { e.currentTarget.style.borderColor = "var(--accent)"; }}
          onBlur={e   => { e.currentTarget.style.borderColor = "var(--border)"; }}
        />
      </div>

      {/* Period selector */}
      <div>
        <label
          className="block font-mono text-[10px] tracking-[0.2em] mb-2"
          style={{ color: "var(--text-muted)" }}
        >
          QUARTER
        </label>
        <div className="relative">
          <select
            value={periodValue}
            onChange={e => {
              const [q, y] = e.target.value.split("-");
              setTimeframe({ quarter: q as Quarter, year: Number(y) });
            }}
            disabled={loading}
            style={{
              ...INPUT_STYLE,
              appearance: "none",
              WebkitAppearance: "none",
              cursor: "pointer",
              paddingRight: "40px",
            }}
          >
            {PERIOD_OPTIONS.map(({ quarter, year }) => (
              <option key={`${quarter}-${year}`} value={`${quarter}-${year}`}>
                {quarterLabel(quarter, year)}
              </option>
            ))}
          </select>
          {/* Custom dropdown arrow */}
          <span
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-mono text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            ▼
          </span>
        </div>
      </div>

      {/* CTA button */}
      <button
        type="submit"
        disabled={loading || !company.trim()}
        className="w-full font-mono font-bold tracking-[0.3em] text-sm py-4 transition-colors"
        style={{
          background: loading || !company.trim() ? "var(--border)" : "var(--accent)",
          color: loading || !company.trim() ? "var(--text-muted)" : "#000",
          cursor: loading || !company.trim() ? "not-allowed" : "pointer",
          border: "none",
        }}
        onMouseEnter={e => {
          if (!loading && company.trim())
            e.currentTarget.style.background = "var(--accent-h)";
        }}
        onMouseLeave={e => {
          if (!loading && company.trim())
            e.currentTarget.style.background = "var(--accent)";
        }}
      >
        {loading ? "ANALYZING..." : "ANALYZE →"}
      </button>

      {/* Demo quick-fills */}
      <div className="flex items-center gap-4 pt-1">
        <span className="font-mono text-[10px] tracking-widest" style={{ color: "var(--text-muted)" }}>
          TRY:
        </span>
        {DEMO_SUGGESTIONS.map(s => (
          <button
            key={s.company}
            type="button"
            onClick={() => fillDemo(s)}
            disabled={loading}
            className="font-mono text-[11px] tracking-wide underline underline-offset-2 transition-colors"
            style={{
              color: "var(--text-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecorationColor: "var(--border)",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            {s.company}
          </button>
        ))}
      </div>
    </form>
  );
}
