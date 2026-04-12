#!/usr/bin/env node

import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

function usageAndExit() {
  console.error("Usage: node scripts/resolve-yahoo-ticker.mjs --query <company-or-ticker>");
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

function isPublicListedEquity(quote) {
  if (!quote || quote.quoteType !== "EQUITY") return false;

  const symbol = normalizeTicker(quote.symbol);
  if (!symbol) return false;

  const exchange = String(quote.exchange ?? "").trim().toUpperCase();
  if (!exchange) return false;

  const disallowedExchanges = new Set(["PNK", "OTC", "OTCM", "GREY", "YHD"]);
  if (disallowedExchanges.has(exchange)) return false;

  return true;
}

function pickBestQuote(quotes) {
  if (!Array.isArray(quotes) || quotes.length === 0) return null;

  const scored = quotes
    .filter(isPublicListedEquity)
    .map((q) => {
      let score = 0;
      if (q.isYahooFinance === true) score += 10;
      if (q.exchange) score += 5;
      if (q.shortname || q.longname) score += 2;
      return { q, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.q ?? null;
}

async function main() {
  const { query } = parseArgs(process.argv.slice(2));
  const result = await yf.search(query, {
    quotesCount: 10,
    newsCount: 0,
    enableFuzzyQuery: true,
  });

  const best = pickBestQuote(result?.quotes ?? []);
  if (!best) {
    throw new Error(`No ticker found for query: ${query}`);
  }

  const ticker = normalizeTicker(best.symbol);
  const companyName =
    (typeof best.shortname === "string" && best.shortname.trim()) ||
    (typeof best.longname === "string" && best.longname.trim()) ||
    query;

  console.log(
    JSON.stringify(
      {
        ticker,
        companyName,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(`Failed to resolve ticker: ${err.message}`);
  process.exit(1);
});
