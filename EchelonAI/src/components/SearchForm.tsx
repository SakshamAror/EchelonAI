// READ instructions.txt before editing this file.
// Horizontal input row: equity search field + quarter select + analyze button.
// Keep form logic here, not in App.tsx.

import { useEffect, useRef, useState } from "react";
import type { AnalysisRequest, TimeFrame } from "@/types";

interface Props {
  onSubmit: (req: AnalysisRequest) => void;
  loading: boolean;
  keysReady?: boolean;
}

interface EquitySearchResult {
  ticker: string;
  companyName: string;
  exchange: string;
  region?: string;
  currency?: string;
}

interface EquitySearchResponse {
  results?: EquitySearchResult[];
}

const MIN_YEAR = 2021;

function currentQuarterFromDate(d: Date) {
  return Math.floor(d.getMonth() / 3) + 1;
}

function latestCompletedQuarterFromDate(d: Date): TimeFrame {
  const currentYear = d.getFullYear();
  const currentQuarter = currentQuarterFromDate(d);

  if (currentQuarter === 1) {
    return { quarter: 4, year: currentYear - 1 };
  }
  return { quarter: currentQuarter - 1, year: currentYear };
}

function buildPeriodOptions(): TimeFrame[] {
  const { year: latestYear, quarter: latestQuarter } = latestCompletedQuarterFromDate(new Date());
  const options: TimeFrame[] = [];

  for (let year = latestYear; year >= MIN_YEAR; year--) {
    const startQuarter = year === latestYear ? latestQuarter : 4;
    for (let quarter = startQuarter; quarter >= 1; quarter--) {
      options.push({ quarter, year });
    }
  }

  return options;
}

const PERIOD_OPTIONS: TimeFrame[] = buildPeriodOptions();
const DEFAULT_TIMEFRAME: TimeFrame = PERIOD_OPTIONS[0] ?? latestCompletedQuarterFromDate(new Date());

export function periodLabel({ quarter, year }: TimeFrame) {
  return `Q${quarter} ${year}`;
}

function periodValue({ quarter, year }: TimeFrame) {
  return `${quarter}-${year}`;
}

function formatSearchSelection(option: EquitySearchResult) {
  return `${option.companyName} (${option.ticker})`;
}

const DEMO_SUGGESTIONS = [
  { company: "Nike", ticker: "NKE", timeframe: { quarter: 3, year: 2024 } },
  { company: "Nvidia", ticker: "NVDA", timeframe: { quarter: 3, year: 2024 } },
  { company: "Tesla", ticker: "TSLA", timeframe: { quarter: 4, year: 2023 } },
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

export default function SearchForm({ onSubmit, loading, keysReady = true }: Props) {
  const [query, setQuery] = useState("");
  const [selectedEquity, setSelectedEquity] = useState<EquitySearchResult | null>(null);
  const [timeframe, setTimeframe] = useState<TimeFrame>(DEFAULT_TIMEFRAME);
  const [results, setResults] = useState<EquitySearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const requestSeqRef = useRef(0);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!searchBoxRef.current) return;
      if (!searchBoxRef.current.contains(event.target as Node)) {
        setShowResults(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener("mousedown", handleDocumentClick);
    return () => document.removeEventListener("mousedown", handleDocumentClick);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();

    if (!trimmed || (selectedEquity && trimmed === formatSearchSelection(selectedEquity))) {
      setResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    const seq = requestSeqRef.current + 1;
    requestSeqRef.current = seq;

    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);

      try {
        const params = new URLSearchParams({ query: trimmed });
        const res = await fetch(`/yahoo-search?${params.toString()}`);
        if (!res.ok) {
          let detail = `Search request failed (${res.status})`;
          try {
            const err = await res.json();
            if (typeof err?.detail === "string" && err.detail.trim()) detail = err.detail;
          } catch {
            // ignore parse error
          }
          throw new Error(detail);
        }

        const payload = (await res.json()) as EquitySearchResponse;
        if (requestSeqRef.current !== seq) return;

        const nextResults = Array.isArray(payload.results) ? payload.results : [];
        setResults(nextResults);
        setActiveIndex(nextResults.length > 0 ? 0 : -1);
      } catch (err) {
        if (requestSeqRef.current !== seq) return;
        setResults([]);
        setSearchError(err instanceof Error ? err.message : "Failed to search equities");
        setActiveIndex(-1);
      } finally {
        if (requestSeqRef.current === seq) setSearchLoading(false);
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [query, selectedEquity]);

  function applySelection(option: EquitySearchResult) {
    setSelectedEquity(option);
    setQuery(formatSearchSelection(option));
    setShowResults(false);
    setActiveIndex(-1);
    setSearchError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = query.trim();
    if (!trimmed) return;

    let chosen = selectedEquity;
    if (!chosen) {
      const upper = trimmed.toUpperCase();
      const exact = results.find(
        (item) =>
          item.ticker === upper ||
          item.companyName.toUpperCase() === upper
      );
      chosen = exact ?? results[0] ?? null;
    }

    if (!chosen) {
      setSearchError("Select a publicly listed equity from the search results.");
      setShowResults(true);
      return;
    }

    const ticker = chosen.ticker;
    const company = chosen.companyName;

    onSubmit({ company, ticker, timeframe });
    setShowResults(false);
  }

  const canSubmit = keysReady && !!query.trim() && !loading && !searchLoading && (selectedEquity !== null || results.length > 0);

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
        <div style={{ flex: 2 }}>
          <label style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--text-muted)", textTransform: "uppercase" }}>
            Stock / Ticker
          </label>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--text-muted)", textTransform: "uppercase" }}>
            Quarter
          </label>
        </div>
        <div style={{ width: 120 }} />
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
        <div ref={searchBoxRef} style={{ flex: 2, position: "relative" }}>
          <input
            style={{ ...BASE }}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedEquity(null);
              setShowResults(true);
            }}
            onFocus={() => {
              if (query.trim()) setShowResults(true);
            }}
            onKeyDown={(e) => {
              if (!showResults || results.length === 0) return;

              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((prev) => (prev + 1) % results.length);
              }

              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
              }

              if (e.key === "Enter" && activeIndex >= 0 && activeIndex < results.length) {
                e.preventDefault();
                applySelection(results[activeIndex]);
              }

              if (e.key === "Escape") {
                setShowResults(false);
                setActiveIndex(-1);
              }
            }}
            placeholder="Search by company or ticker (e.g. Apple or AAPL)"
            disabled={loading}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
            }}
            onFocusCapture={(e) => {
              e.currentTarget.style.borderColor = "var(--accent-dim)";
            }}
          />

          {showResults && query.trim() && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                right: 0,
                zIndex: 120,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                maxHeight: 280,
                overflowY: "auto",
              }}
            >
              {searchLoading && (
                <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)" }}>
                  Searching publicly listed equities...
                </div>
              )}

              {!searchLoading && searchError && (
                <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--red)" }}>
                  {searchError}
                </div>
              )}

              {!searchLoading && !searchError && results.length === 0 && (
                <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)" }}>
                  No publicly listed equity matches found.
                </div>
              )}

              {!searchLoading && !searchError && results.map((item, idx) => (
                <button
                  key={`${item.ticker}-${item.exchange}`}
                  type="button"
                  onClick={() => applySelection(item)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    border: "none",
                    borderBottom: idx < results.length - 1 ? "1px solid var(--border)" : "none",
                    background: idx === activeIndex ? "rgba(245,166,35,0.10)" : "transparent",
                    color: "var(--text)",
                    cursor: "pointer",
                    fontFamily: "'DM Mono', monospace",
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                >
                  <div style={{ fontSize: 12, color: "var(--text)" }}>
                    {item.companyName} <span style={{ color: "var(--accent)" }}>({item.ticker})</span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
                    {item.exchange}{item.region ? ` · ${item.region}` : ""}{item.currency ? ` · ${item.currency}` : ""}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1, position: "relative" }}>
          <select
            style={{
              ...BASE,
              appearance: "none",
              WebkitAppearance: "none",
              cursor: "pointer",
              paddingRight: 36,
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='%23555550'%3E%3Cpath d='M6 8L0 0h12z'/%3E%3C/svg%3E\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 14px center",
            }}
            value={periodValue(timeframe)}
            onChange={(e) => {
              const [q, y] = e.target.value.split("-");
              setTimeframe({ quarter: Number(q), year: Number(y) });
            }}
            disabled={loading}
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={periodValue(opt)} value={periodValue(opt)}>
                {periodLabel(opt)}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            background: canSubmit ? "var(--accent)" : "var(--border)",
            color: canSubmit ? "#000" : "var(--text-muted)",
            border: "none",
            cursor: canSubmit ? "pointer" : "not-allowed",
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            padding: "0 28px",
            whiteSpace: "nowrap",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            if (!canSubmit) return;
            e.currentTarget.style.background = "#fff";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            if (!canSubmit) return;
            e.currentTarget.style.background = "var(--accent)";
            e.currentTarget.style.transform = "none";
          }}
        >
          {loading ? "Analyzing..." : !keysReady ? "Add API Keys →" : "Analyze →"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 16 }}>
        <span style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--text-muted)", textTransform: "uppercase", marginRight: 4 }}>
          Try:
        </span>
        {DEMO_SUGGESTIONS.map((s) => (
          <button
            key={s.ticker}
            type="button"
            onClick={() => {
              setSelectedEquity({ ticker: s.ticker, companyName: s.company, exchange: "Preset" });
              setQuery(`${s.company} (${s.ticker})`);
              setTimeframe(s.timeframe);
              setShowResults(false);
              setSearchError(null);
            }}
            disabled={loading}
            style={{
              fontSize: 11,
              padding: "4px 12px",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
              cursor: "pointer",
              background: "transparent",
              fontFamily: "'DM Mono', monospace",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent-dim)";
              e.currentTarget.style.color = "var(--accent)";
              e.currentTarget.style.background = "rgba(245,166,35,0.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            {s.company}
          </button>
        ))}
      </div>
    </form>
  );
}
