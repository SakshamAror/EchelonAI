// Current-price lookups via the /yahoo-quote dev endpoint (dev-only; production
// ports this to the backend). Used by the position editor + positions panel.

export interface Quote {
  ticker: string;
  price: number | null;
  currency: string;
  changePercent: number | null;
  marketState: string | null;
}

export async function getQuotes(tickers: string[]): Promise<Record<string, Quote>> {
  const clean = Array.from(new Set(tickers.map(t => t.toUpperCase()))).filter(Boolean);
  if (clean.length === 0) return {};
  const res = await fetch(`/yahoo-quote?${new URLSearchParams({ tickers: clean.join(",") })}`);
  if (!res.ok) throw new Error(`Quote request failed (${res.status})`);
  const payload = await res.json() as { quotes?: Quote[] };
  const map: Record<string, Quote> = {};
  for (const q of payload.quotes ?? []) map[q.ticker] = q;
  return map;
}

export async function getQuote(ticker: string): Promise<Quote | null> {
  const map = await getQuotes([ticker]);
  return map[ticker.toUpperCase()] ?? null;
}

export interface HistoryPoint { t: number; close: number }

export type HistoryRange = "1d" | "5d" | "1mo" | "6mo" | "1y" | "5y" | "max";

// In-memory cache so switching ranges/views doesn't refetch the same series.
const historyCache = new Map<string, { data: HistoryPoint[]; ts: number }>();
const HISTORY_TTL_MS = 5 * 60 * 1000;

export async function getHistory(ticker: string, range: HistoryRange): Promise<HistoryPoint[]> {
  const key = `${ticker}:${range}`;
  const hit = historyCache.get(key);
  if (hit && Date.now() - hit.ts < HISTORY_TTL_MS) return hit.data;

  const res = await fetch(`/yahoo-history?${new URLSearchParams({ ticker, range })}`);
  if (!res.ok) throw new Error(`History request failed (${res.status})`);
  const payload = await res.json() as { points?: HistoryPoint[] };
  const data = payload.points ?? [];
  historyCache.set(key, { data, ts: Date.now() });
  return data;
}
