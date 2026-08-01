#!/usr/bin/env node

// Current-price quote for one or more tickers.
// Usage: node scripts/fetch-yahoo-quote.mjs --tickers AAPL,MSFT,NVDA

import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

function parseArgs(argv) {
  let tickers = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--tickers") tickers = argv[i + 1] ?? "";
  }
  const list = tickers
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter((t) => /^\^?[A-Z0-9.\-]{1,10}$/.test(t));  // leading ^ allows indices like ^IRX
  if (list.length === 0) {
    console.error("Usage: node scripts/fetch-yahoo-quote.mjs --tickers AAPL,MSFT");
    process.exit(1);
  }
  return Array.from(new Set(list));
}

async function main() {
  const tickers = parseArgs(process.argv.slice(2));

  // validateResult:false — skip strict schema throw on malformed Yahoo quotes.
  const raw = await yf.quote(tickers, {}, { validateResult: false });
  const arr = Array.isArray(raw) ? raw : [raw];

  const quotes = arr
    .filter((q) => q && q.symbol)
    .map((q) => ({
      ticker: String(q.symbol).toUpperCase(),
      price: typeof q.regularMarketPrice === "number" ? q.regularMarketPrice : null,
      currency: typeof q.currency === "string" ? q.currency : "USD",
      changePercent:
        typeof q.regularMarketChangePercent === "number" ? q.regularMarketChangePercent : null,
      marketState: typeof q.marketState === "string" ? q.marketState : null,
    }));

  console.log(JSON.stringify({ quotes }, null, 2));
}

main().catch((err) => {
  console.error(`Failed to fetch quotes: ${err.message}`);
  process.exit(1);
});
