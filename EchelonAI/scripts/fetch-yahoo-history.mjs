#!/usr/bin/env node

// Historical daily/weekly closes for one ticker over a range.
// Usage: node scripts/fetch-yahoo-history.mjs --ticker AAPL --range 6mo

import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// range → { days | months (null = all), interval }
const RANGE_CONFIG = {
  "1d":  { days: 5,      interval: "5m", lastSessionOnly: true },
  "5d":  { days: 5,      interval: "15m" },
  "1mo": { months: 1,    interval: "5m" },
  "6mo": { months: 6,    interval: "60m" },
  "1y":  { months: 12,   interval: "60m" },
  "5y":  { months: 60,   interval: "1wk" },
  "max": { months: null, interval: "1mo" },
};

function parseArgs(argv) {
  let ticker = "", range = "6mo";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--ticker") ticker = (argv[i + 1] ?? "").trim().toUpperCase();
    if (argv[i] === "--range") range = (argv[i + 1] ?? "6mo").trim();
  }
  if (!/^[A-Z0-9.\-]{1,10}$/.test(ticker)) {
    console.error("Usage: node scripts/fetch-yahoo-history.mjs --ticker AAPL --range 6mo");
    process.exit(1);
  }
  if (!RANGE_CONFIG[range]) range = "6mo";
  return { ticker, range };
}

async function main() {
  const { ticker, range } = parseArgs(process.argv.slice(2));
  const cfg = RANGE_CONFIG[range];

  const DAY = 24 * 60 * 60 * 1000;
  const period1 = cfg.days != null
    ? new Date(Date.now() - cfg.days * DAY)
    : cfg.months == null
      ? new Date(Date.UTC(1970, 0, 1))
      : new Date(Date.now() - cfg.months * 30 * DAY);

  // validateResult:false — skip strict schema throw on malformed rows.
  const chart = await yf.chart(
    ticker,
    { period1, period2: new Date(), interval: cfg.interval },
    { validateResult: false }
  );

  let points = (chart?.quotes ?? [])
    .filter((q) => q?.date && typeof q.close === "number" && Number.isFinite(q.close))
    .map((q) => ({ t: new Date(q.date).getTime(), close: q.close }))
    .sort((a, b) => a.t - b.t);

  // 1D: keep only the latest trading session (robust on weekends/holidays)
  if (cfg.lastSessionOnly && points.length > 0) {
    const lastDay = new Date(points[points.length - 1].t).toISOString().slice(0, 10);
    points = points.filter((p) => new Date(p.t).toISOString().slice(0, 10) === lastDay);
  }

  console.log(JSON.stringify({ ticker, range, points }, null, 2));
}

main().catch((err) => {
  console.error(`Failed to fetch history: ${err.message}`);
  process.exit(1);
});
