import { useEffect, useRef, useState } from "react";
import { getQuotes } from "@/lib/priceApi";

export interface EquityResult {
  ticker: string;
  companyName: string;
  exchange: string;
  currency?: string;
  price?: number | null;
}

interface Props {
  onSelect: (r: EquityResult) => void;
  placeholder?: string;
}

// Reuses the Analyze tab's /yahoo-search dev endpoint for validated US-equity selection.
export default function TickerSearch({ onSelect, placeholder = "Search ticker (e.g. AAPL)" }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EquityResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const seqRef = useRef(0);
  const priceSeqRef = useRef(0);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); setErr(null); setLoading(false); return; }

    const seq = seqRef.current + 1;
    seqRef.current = seq;
    const timer = window.setTimeout(async () => {
      setLoading(true); setErr(null);
      try {
        const res = await fetch(`/yahoo-search?${new URLSearchParams({ query: q })}`);
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const payload = await res.json();
        if (seqRef.current !== seq) return;
        const next = Array.isArray(payload.results) ? payload.results : [];
        setResults(next);
        setActive(next.length ? 0 : -1);
      } catch (e) {
        if (seqRef.current !== seq) return;
        setResults([]);
        setErr(e instanceof Error ? e.message : "Search failed");
      } finally {
        if (seqRef.current === seq) setLoading(false);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  // Fetch current prices for the current result set (one batched call per settled search)
  useEffect(() => {
    if (results.length === 0) { setPrices({}); return; }
    const seq = priceSeqRef.current + 1;
    priceSeqRef.current = seq;
    getQuotes(results.map(r => r.ticker))
      .then(map => {
        if (priceSeqRef.current !== seq) return;
        const next: Record<string, number | null> = {};
        for (const r of results) next[r.ticker] = map[r.ticker]?.price ?? null;
        setPrices(next);
      })
      .catch(() => { if (priceSeqRef.current === seq) setPrices({}); });
  }, [results]);

  function pick(r: EquityResult) {
    onSelect({ ...r, price: prices[r.ticker] ?? null });
    setQuery("");
    setResults([]);
    setPrices({});
    setOpen(false);
    setActive(-1);
  }

  const inputStyle: React.CSSProperties = {
    border: "1px solid var(--border)", color: "var(--text)",
    fontFamily: "'DM Mono', monospace", fontSize: 13, padding: "10px 12px",
    outline: "none", width: "100%", background: "var(--surface-2)",
  };

  return (
    <div ref={boxRef} style={{ position: "relative", width: "100%" }}>
      <input
        style={inputStyle}
        value={query}
        placeholder={placeholder}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { if (query.trim()) setOpen(true); }}
        onKeyDown={e => {
          if (!open || results.length === 0) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive(p => (p + 1) % results.length); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive(p => (p <= 0 ? results.length - 1 : p - 1)); }
          if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(results[active]); }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && query.trim() && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 120,
          background: "var(--surface-2)", border: "1px solid var(--border)",
          maxHeight: 240, overflowY: "auto",
        }}>
          {loading && <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-muted)" }}>Searching…</div>}
          {!loading && err && <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--red)" }}>{err}</div>}
          {!loading && !err && results.length === 0 && (
            <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-muted)" }}>No matches.</div>
          )}
          {!loading && !err && results.map((r, i) => (
            <button
              key={`${r.ticker}-${r.exchange}`}
              type="button"
              onClick={() => pick(r)}
              onMouseEnter={() => setActive(i)}
              style={{
                width: "100%", textAlign: "left", padding: "8px 12px", border: "none",
                borderBottom: i < results.length - 1 ? "1px solid var(--border)" : "none",
                background: i === active ? "rgba(245,166,35,0.10)" : "transparent",
                color: "var(--text)", cursor: "pointer", fontFamily: "'DM Mono', monospace",
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12 }}>{r.companyName} <span style={{ color: "var(--accent)" }}>({r.ticker})</span></span>
                <span style={{ display: "block", fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{r.exchange}</span>
              </span>
              <span style={{ fontSize: 12, color: "var(--text)", whiteSpace: "nowrap", flexShrink: 0 }}>
                {r.ticker in prices ? (prices[r.ticker] != null ? `$${prices[r.ticker]!.toFixed(2)}` : "—") : "…"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
