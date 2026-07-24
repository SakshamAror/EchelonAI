import Papa from "papaparse";

export type Field = "date" | "ticker" | "action" | "qty" | "price" | "fees";
export const REQUIRED_FIELDS: Field[] = ["date", "ticker", "action", "qty", "price"];
export const OPTIONAL_FIELDS: Field[] = ["fees"];
export const ALL_FIELDS: Field[] = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

export type Mapping = Record<Field, number | null>; // field -> column index

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export interface CanonicalTrade {
  date: string;                 // ISO yyyy-mm-dd
  ticker: string;
  action: "buy" | "sell";
  qty: number;
  price: number;
  fees: number;
}

export interface NormalizeResult {
  trades: CanonicalTrade[];
  skipped: number;              // non-buy/sell or unparseable rows
  errors: string[];             // sample of problems (capped)
}

// ── Parse ─────────────────────────────────────────────────────────────────────
export function parseCsv(text: string): ParsedCsv {
  const out = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
  const data = (out.data ?? []) as string[][];
  if (data.length === 0) return { headers: [], rows: [] };
  const headers = data[0].map(h => String(h ?? "").trim());
  const rows = data.slice(1);
  return { headers, rows };
}

// ── Header-name heuristics ─────────────────────────────────────────────────────
const HEADER_PATTERNS: Record<Field, RegExp> = {
  date:   /\b(date|time|executed|settled|trade\s*date|when)\b/i,
  ticker: /\b(ticker|symbol|security|instrument|stock)\b/i,
  action: /\b(action|side|type|transaction|activity|buy\/?sell|direction)\b/i,
  qty:    /\b(qty|quantity|shares|units|amount|filled)\b/i,
  price:  /\b(price|fill\s*price|exec\s*price|unit\s*price|cost\s*per|avg\s*price)\b/i,
  fees:   /\b(fee|fees|commission|comm|charge)\b/i,
};

const BUY_WORDS = new Set(["buy", "bought", "b", "purchase", "bto", "buy to open"]);
const SELL_WORDS = new Set(["sell", "sold", "s", "sto", "sell to close", "sale"]);

function looksLikeDate(v: string): boolean {
  if (!v) return false;
  const t = Date.parse(v);
  return !Number.isNaN(t);
}
function looksLikeNumber(v: string): boolean {
  if (!v) return false;
  return !Number.isNaN(Number(v.replace(/[$,]/g, "")));
}
function looksLikeAction(v: string): boolean {
  const s = v.trim().toLowerCase();
  return BUY_WORDS.has(s) || SELL_WORDS.has(s);
}
function looksLikeTicker(v: string): boolean {
  return /^[A-Za-z.\-]{1,6}$/.test(v.trim());
}

// Best-effort auto-map. Returns index per field or null if not inferable.
export function inferMapping(parsed: ParsedCsv): Mapping {
  const { headers, rows } = parsed;
  const sample = rows.slice(0, 20);
  const used = new Set<number>();
  const map: Mapping = { date: null, ticker: null, action: null, qty: null, price: null, fees: null };

  // Pass 1: header-name match
  for (const field of ALL_FIELDS) {
    const idx = headers.findIndex((h, i) => !used.has(i) && HEADER_PATTERNS[field].test(h));
    if (idx >= 0) { map[field] = idx; used.add(idx); }
  }

  // Pass 2: value inference for anything still unmapped
  const colMatches = (pred: (v: string) => boolean, i: number) => {
    const vals = sample.map(r => (r[i] ?? "").trim()).filter(Boolean);
    if (vals.length === 0) return 0;
    return vals.filter(pred).length / vals.length;
  };
  const inferByValue = (field: Field, pred: (v: string) => boolean, threshold = 0.6) => {
    if (map[field] != null) return;
    let best = -1, bestScore = threshold;
    for (let i = 0; i < headers.length; i++) {
      if (used.has(i)) continue;
      const s = colMatches(pred, i);
      if (s > bestScore) { bestScore = s; best = i; }
    }
    if (best >= 0) { map[field] = best; used.add(best); }
  };

  inferByValue("date", looksLikeDate);
  inferByValue("action", looksLikeAction);
  inferByValue("ticker", looksLikeTicker);
  // price vs qty are both numeric — infer qty first (often integer-ish), then price
  inferByValue("qty", looksLikeNumber, 0.8);
  inferByValue("price", looksLikeNumber, 0.8);

  return map;
}

// Fields that could not be inferred and have no obvious column (for the mapping UI)
export function missingRequired(map: Mapping): Field[] {
  return REQUIRED_FIELDS.filter(f => map[f] == null);
}

// ── Normalize with a (possibly user-corrected) mapping ─────────────────────────
function toISODate(v: string): string | null {
  const t = Date.parse(v);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}
function toNumber(v: string): number | null {
  const n = Number(String(v).replace(/[$,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}
function normAction(v: string): "buy" | "sell" | null {
  const s = v.trim().toLowerCase();
  if (BUY_WORDS.has(s) || s.startsWith("buy")) return "buy";
  if (SELL_WORDS.has(s) || s.startsWith("sell")) return "sell";
  return null;
}

export function normalizeRows(parsed: ParsedCsv, map: Mapping): NormalizeResult {
  const errors: string[] = [];
  const trades: CanonicalTrade[] = [];
  let skipped = 0;

  parsed.rows.forEach((row, idx) => {
    const get = (f: Field) => (map[f] != null ? (row[map[f]!] ?? "").trim() : "");
    const action = normAction(get("action"));
    if (!action) { skipped++; return; } // dividends/transfers/etc.

    const date = toISODate(get("date"));
    const ticker = get("ticker").toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
    const qty = toNumber(get("qty"));
    const price = toNumber(get("price"));
    const fees = map.fees != null ? (toNumber(get("fees")) ?? 0) : 0;

    if (!date || !ticker || qty == null || price == null || qty <= 0 || price <= 0) {
      if (errors.length < 8) errors.push(`Row ${idx + 2}: invalid date/ticker/qty/price`);
      skipped++;
      return;
    }
    trades.push({ date, ticker, action, qty, price, fees });
  });

  return { trades, skipped, errors };
}
