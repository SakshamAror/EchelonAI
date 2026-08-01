import type { CanonicalTrade } from "@/lib/csvImport";
import { replayPositions } from "@/lib/tradeReplay";
import {
  insertTrades, deleteAllTrades, insertCashFlows, deleteAllCashFlows, updateStartingCash,
} from "@/lib/portfolioApi";

export interface AlpacaCreds { keyId: string; secret: string; paper: boolean; }

interface AlpacaFill { transaction_time?: string; symbol?: string; side?: string; qty?: string; price?: string }
interface AlpacaCash { date?: string; net_amount?: string }
interface AlpacaSyncResponse {
  account?: { cash?: string };
  fills?: AlpacaFill[];
  csd?: AlpacaCash[];
  csw?: AlpacaCash[];
}

// ── localStorage creds (per profile) — dev pattern, same as Groq/Tavily keys ───
// Production hardening: move to Supabase Vault + backend proxy (Alpaca keys can trade).
const credsKey = (profileId: string) => `echelon_alpaca_${profileId}`;
export function saveAlpacaCreds(profileId: string, c: AlpacaCreds) {
  localStorage.setItem(credsKey(profileId), JSON.stringify(c));
}
export function loadAlpacaCreds(profileId: string): AlpacaCreds | null {
  const raw = localStorage.getItem(credsKey(profileId));
  if (!raw) return null;
  try { return JSON.parse(raw) as AlpacaCreds; } catch { return null; }
}
export function clearAlpacaCreds(profileId: string) {
  localStorage.removeItem(credsKey(profileId));
}

async function fetchAlpaca(creds: AlpacaCreds): Promise<AlpacaSyncResponse> {
  const res = await fetch("/alpaca/sync", {
    headers: {
      "x-alpaca-key-id": creds.keyId,
      "x-alpaca-secret": creds.secret,
      "x-alpaca-paper": creds.paper ? "1" : "0",
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string })?.detail ?? `Alpaca sync failed (${res.status})`);
  }
  return res.json();
}

// Pull fills + cash activities, reconcile starting cash so NLV matches Alpaca, and
// write everything into the profile (replacing prior data). Feeds the same replay engine.
export async function syncAlpacaToProfile(profileId: string, creds: AlpacaCreds): Promise<{ trades: number; flows: number }> {
  const data = await fetchAlpaca(creds);

  const trades: CanonicalTrade[] = (data.fills ?? [])
    .map(f => ({
      date: String(f.transaction_time ?? "").slice(0, 10),
      ticker: String(f.symbol ?? "").toUpperCase(),
      action: (f.side === "sell" ? "sell" : "buy") as "buy" | "sell",
      qty: Math.abs(Number(f.qty)),
      price: Number(f.price),
      fees: 0,
    }))
    .filter(t => t.date && t.ticker && t.qty > 0 && t.price > 0 &&
      ((data.fills ?? []).length > 0)); // keep valid rows

  const flows = [
    ...(data.csd ?? []).map(a => ({ flowDate: String(a.date ?? "").slice(0, 10), amount: Math.abs(Number(a.net_amount)), kind: "deposit" as const })),
    ...(data.csw ?? []).map(a => ({ flowDate: String(a.date ?? "").slice(0, 10), amount: Math.abs(Number(a.net_amount)), kind: "withdrawal" as const })),
  ].filter(f => f.flowDate && f.amount > 0);

  // Reconcile starting cash so replayed cash matches Alpaca's reported cash exactly.
  const flowEvents = flows.map(f => ({ date: f.flowDate, amount: f.kind === "withdrawal" ? -f.amount : f.amount }));
  const alpacaCash = Number(data.account?.cash ?? 0);
  const base = replayPositions(trades, 0, flowEvents).cashNow;
  const startingCash = alpacaCash - base;

  await updateStartingCash(profileId, startingCash);
  await deleteAllTrades(profileId);
  await insertTrades(profileId, trades);
  await deleteAllCashFlows(profileId);
  await insertCashFlows(profileId, flows);

  return { trades: trades.length, flows: flows.length };
}
