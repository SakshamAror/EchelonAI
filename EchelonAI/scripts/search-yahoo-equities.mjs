#!/usr/bin/env node

import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

function usageAndExit() {
  console.error("Usage: node scripts/search-yahoo-equities.mjs --query <company-or-ticker>");
  process.exit(1);
}

function parseArgs(argv) {
  const args = { query: "" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--query") args.query = argv[i + 1] ?? "";
  }
  if (!args.query.trim()) usageAndExit();
  return { query: args.query.trim() };
}

function normalizeTicker(value) {
  return String(value ?? "").trim().toUpperCase();
}

// Yahoo Finance exchange codes for US markets (NYSE, NASDAQ, NYSE Arca, NYSE American, BATS)
const US_EXCHANGE_CODES = new Set([
  "NYQ",  // NYSE
  "NMS",  // NASDAQ Global Select Market
  "NGM",  // NASDAQ Global Market
  "NCM",  // NASDAQ Capital Market
  "ASE",  // NYSE American (AMEX)
  "PCX",  // NYSE Arca
  "BATS", // BATS/CBOE
  "BTS",
]);

function isPublicListedEquity(quote) {
  if (!quote || quote.quoteType !== "EQUITY") return false;

  const symbol = normalizeTicker(quote.symbol);
  if (!symbol) return false;

  const exchange = String(quote.exchange ?? "").trim().toUpperCase();
  if (!US_EXCHANGE_CODES.has(exchange)) return false;

  return true;
}

function scoreQuote(quote, queryUpper) {
  const symbol = normalizeTicker(quote.symbol);
  const shortname = String(quote.shortname ?? "");
  const longname = String(quote.longname ?? "");
  const name = `${shortname} ${longname}`.toUpperCase();

  let score = 0;
  if (symbol === queryUpper) score += 1000;
  else if (symbol.startsWith(queryUpper)) score += 600;
  else if (symbol.includes(queryUpper)) score += 350;

  if (name.includes(queryUpper)) score += 250;
  if (quote.exchange) score += 20;
  if (quote.shortname || quote.longname) score += 20;

  return score;
}

async function main() {
  const { query } = parseArgs(process.argv.slice(2));
  const queryUpper = query.toUpperCase();

  const payload = await yf.search(query, {
    quotesCount: 30,
    newsCount: 0,
    enableFuzzyQuery: true,
  });

  const quotes = Array.isArray(payload?.quotes) ? payload.quotes : [];
  const filtered = quotes.filter(isPublicListedEquity);

  const seen = new Set();
  const results = filtered
    .map((q) => ({
      ticker: normalizeTicker(q.symbol),
      companyName:
        (typeof q.shortname === "string" && q.shortname.trim()) ||
        (typeof q.longname === "string" && q.longname.trim()) ||
        normalizeTicker(q.symbol),
      exchange: String(q.exchDisp || q.exchange || "").trim(),
      region: typeof q.region === "string" ? q.region : "",
      currency: typeof q.currency === "string" ? q.currency : "",
      score: scoreQuote(q, queryUpper),
    }))
    .filter((item) => {
      if (!item.ticker || seen.has(item.ticker)) return false;
      seen.add(item.ticker);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map(({ score, ...rest }) => rest);

  console.log(
    JSON.stringify(
      {
        query,
        results,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(`Failed to search Yahoo equities: ${err.message}`);
  process.exit(1);
});
