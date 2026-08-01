import { useState } from "react";
import {
  parseCsv, inferMapping, normalizeRows, REQUIRED_FIELDS, ALL_FIELDS,
  type ParsedCsv, type Mapping, type Field, type NormalizeResult,
} from "@/lib/csvImport";
import { insertTrades, deleteAllTrades } from "@/lib/portfolioApi";

const FIELD_LABEL: Record<Field, string> = {
  date: "Date", ticker: "Ticker", action: "Action (buy/sell)",
  qty: "Quantity", price: "Price", fees: "Fees (optional)",
};

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--border)", color: "var(--text)", background: "var(--surface-2)",
  fontFamily: "'DM Mono', monospace", fontSize: 12, padding: "8px 10px", outline: "none",
};
const btnStyle: React.CSSProperties = {
  background: "var(--accent)", border: "none", color: "#000", fontFamily: "'DM Mono', monospace",
  fontSize: 11, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase",
  padding: "9px 18px", cursor: "pointer",
};

export default function CsvImport({ accountId, hasTrades, onImported }: {
  accountId: string; hasTrades: boolean; onImported: () => void;
}) {
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [result, setResult] = useState<NormalizeResult | null>(null);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null); setResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const p = parseCsv(text);
      if (p.headers.length === 0) { setErr("Could not read any columns from that file."); return; }
      setParsed(p);
      setMapping(inferMapping(p));
    };
    reader.readAsText(file);
  }

  function setField(field: Field, colIdx: number | null) {
    if (!mapping) return;
    setMapping({ ...mapping, [field]: colIdx });
  }

  function preview() {
    if (!parsed || !mapping) return;
    const missing = REQUIRED_FIELDS.filter(f => mapping[f] == null);
    if (missing.length) { setErr(`Choose a column for: ${missing.map(f => FIELD_LABEL[f]).join(", ")}`); return; }
    setErr(null);
    setResult(normalizeRows(parsed, mapping));
  }

  async function doImport() {
    if (!result) return;
    if (result.trades.length === 0) { setErr("No valid buy/sell rows found."); return; }
    setBusy(true); setErr(null);
    try {
      if (replace && hasTrades) await deleteAllTrades(accountId);
      await insertTrades(accountId, result.trades);
      setParsed(null); setMapping(null); setResult(null); setReplace(false);
      onImported();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  // Step 1: upload
  if (!parsed || !mapping) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Upload a trades CSV (any format). We auto-detect columns; you confirm the mapping next.
        </p>
        <input type="file" accept=".csv,text/csv" onChange={onFile}
          style={{ fontSize: 11, color: "var(--text-muted)" }} />
        {err && <div style={{ fontSize: 11, color: "var(--red)" }}>{err}</div>}
      </div>
    );
  }

  // Step 2: map + confirm
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {ALL_FIELDS.map(field => (
          <div key={field} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 9, letterSpacing: "0.14em", color: "var(--text-muted)", textTransform: "uppercase" }}>
              {FIELD_LABEL[field]}
            </label>
            <select style={{ ...inputStyle, cursor: "pointer" }}
              value={mapping[field] ?? ""} onChange={e => setField(field, e.target.value === "" ? null : Number(e.target.value))}>
              <option value="">{field === "fees" ? "(none)" : "— choose column —"}</option>
              {parsed.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
            </select>
          </div>
        ))}
      </div>

      {!result ? (
        <button style={btnStyle} onClick={preview}>Preview</button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            <span style={{ color: "var(--green)" }}>{result.trades.length}</span> trades ·{" "}
            <span style={{ color: "var(--text-dim)" }}>{result.skipped} skipped</span>
            {" "}(dividends/transfers/invalid rows)
          </div>
          {result.errors.length > 0 && (
            <div style={{ fontSize: 10, color: "var(--red)" }}>
              {result.errors.slice(0, 4).map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
          {/* preview first rows */}
          <div style={{ fontSize: 11, color: "var(--text)", border: "1px solid var(--border)", padding: 8, maxHeight: 140, overflowY: "auto" }}>
            {result.trades.slice(0, 5).map((t, i) => (
              <div key={i} style={{ color: "var(--text-muted)" }}>
                {t.date} · <span style={{ color: t.action === "buy" ? "var(--green)" : "var(--red)" }}>{t.action}</span>{" "}
                {t.qty} <span style={{ color: "var(--accent)" }}>{t.ticker}</span> @ ${t.price}
              </div>
            ))}
          </div>
          {hasTrades && (
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} />
              Replace existing trades (otherwise append)
            </label>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...btnStyle, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={doImport}>
              {busy ? "Importing…" : `Import ${result.trades.length} trades`}
            </button>
            <button onClick={() => { setResult(null); }} style={{
              background: "none", border: "1px solid var(--border)", color: "var(--text-muted)",
              fontFamily: "'DM Mono', monospace", fontSize: 11, padding: "9px 18px", cursor: "pointer",
              letterSpacing: "0.1em", textTransform: "uppercase",
            }}>Back</button>
          </div>
        </div>
      )}

      {err && <div style={{ fontSize: 11, color: "var(--red)" }}>{err}</div>}
    </div>
  );
}
