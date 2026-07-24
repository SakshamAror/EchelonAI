import { supabase } from "@/lib/supabase";
import type { CanonicalTrade } from "@/lib/csvImport";
import type { ReplayTrade, CashFlowEvent } from "@/lib/tradeReplay";

export interface Profile {
  id: string;
  account_name: string;
  type: "csv" | "snaptrade";
  broker: string;              // "CSV" | "Alpaca" | ...
  currency: string;
  starting_cash: number;
  connected_at: string;
}

export interface CashFlow {
  id: string;
  account_id: string;
  flow_date: string;   // yyyy-mm-dd
  amount: number;      // magnitude (> 0)
  kind: "deposit" | "withdrawal";
}

function requireClient() {
  if (!supabase) throw new Error("Supabase not configured");
  return supabase;
}

export function sanitizeName(raw: string): string {
  return raw.replace(/[^A-Za-z0-9 ]/g, "").trim().slice(0, 40);
}

// ── Profiles ────────────────────────────────────────────────────────────────
const PROFILE_COLS = "id, account_name, type, broker, currency, starting_cash, connected_at";

export async function listProfiles(): Promise<Profile[]> {
  const sb = requireClient();
  const { data, error } = await sb
    .from("portfolio_accounts")
    .select(PROFILE_COLS)
    .order("connected_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Profile[];
}

// type stays 'csv' (RLS-managed trade-based profile); broker distinguishes source.
export async function createProfile(name: string, startingCash: number, broker = "CSV"): Promise<Profile> {
  const sb = requireClient();
  const { data: userData } = await sb.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not signed in");

  const clean = sanitizeName(name) || "Portfolio";
  const { data, error } = await sb
    .from("portfolio_accounts")
    .insert({ user_id: userId, type: "csv", broker, account_name: clean, starting_cash: startingCash })
    .select(PROFILE_COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as Profile;
}

export async function updateStartingCash(accountId: string, value: number): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.from("portfolio_accounts").update({ starting_cash: value }).eq("id", accountId);
  if (error) throw new Error(error.message);
}

export async function deleteProfile(accountId: string): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.from("portfolio_accounts").delete().eq("id", accountId);
  if (error) throw new Error(error.message);
}

// ── Trades ──────────────────────────────────────────────────────────────────
export async function insertTrades(accountId: string, trades: CanonicalTrade[]): Promise<void> {
  const sb = requireClient();
  if (trades.length === 0) return;
  const rows = trades.map(t => ({
    account_id: accountId,
    ticker: t.ticker,
    direction: t.action,
    qty: t.qty,
    price: t.price,
    fees: t.fees,
    executed_at: t.date + "T00:00:00Z",
  }));
  const { error } = await sb.from("trades").insert(rows);
  if (error) throw new Error(error.message);
}

export async function deleteAllTrades(accountId: string): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.from("trades").delete().eq("account_id", accountId);
  if (error) throw new Error(error.message);
}

export async function listTrades(accountId: string): Promise<ReplayTrade[]> {
  const sb = requireClient();
  const { data, error } = await sb
    .from("trades")
    .select("ticker, direction, qty, price, fees, executed_at")
    .eq("account_id", accountId)
    .order("executed_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(r => ({
    date: String(r.executed_at).slice(0, 10),
    ticker: r.ticker,
    action: r.direction as "buy" | "sell",
    qty: Number(r.qty),
    price: Number(r.price),
    fees: Number(r.fees),
  }));
}

// ── Cash flows ──────────────────────────────────────────────────────────────
export async function listCashFlows(accountId: string): Promise<CashFlow[]> {
  const sb = requireClient();
  const { data, error } = await sb
    .from("cash_flows")
    .select("id, account_id, flow_date, amount, kind")
    .eq("account_id", accountId)
    .order("flow_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CashFlow[];
}

export async function addCashFlow(
  accountId: string, flowDate: string, amount: number, kind: "deposit" | "withdrawal"
): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.from("cash_flows").insert({
    account_id: accountId, flow_date: flowDate, amount: Math.abs(amount), kind,
  });
  if (error) throw new Error(error.message);
}

export async function deleteCashFlow(id: string): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.from("cash_flows").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteAllCashFlows(accountId: string): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.from("cash_flows").delete().eq("account_id", accountId);
  if (error) throw new Error(error.message);
}

export async function insertCashFlows(
  accountId: string, flows: { flowDate: string; amount: number; kind: "deposit" | "withdrawal" }[]
): Promise<void> {
  const sb = requireClient();
  if (flows.length === 0) return;
  const rows = flows.map(f => ({ account_id: accountId, flow_date: f.flowDate, amount: Math.abs(f.amount), kind: f.kind }));
  const { error } = await sb.from("cash_flows").insert(rows);
  if (error) throw new Error(error.message);
}

// Convert stored cash flows to signed events for the replay engine
export function toFlowEvents(flows: CashFlow[]): CashFlowEvent[] {
  return flows.map(f => ({ date: f.flow_date, amount: f.kind === "withdrawal" ? -f.amount : f.amount }));
}
