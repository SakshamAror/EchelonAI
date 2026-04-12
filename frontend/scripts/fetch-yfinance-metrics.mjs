#!/usr/bin/env node

/**
 * Live Yahoo Finance -> FinancialMetrics mapper.
 *
 * Usage:
 *   npm run metrics:yahoo -- --ticker NVDA --quarter 3 --year 2024
 */

import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

function usageAndExit() {
  console.error(
    "Usage: node scripts/fetch-yfinance-metrics.mjs --ticker <SYMBOL> --quarter <1-4> --year <YYYY>"
  );
  process.exit(1);
}

function parseArgs(argv) {
  const args = { ticker: "", quarter: 0, year: 0 };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--ticker") args.ticker = (argv[i + 1] ?? "").toUpperCase();
    if (token === "--quarter") args.quarter = Number(argv[i + 1]);
    if (token === "--year") args.year = Number(argv[i + 1]);
  }
  if (!args.ticker || !Number.isInteger(args.quarter) || !Number.isInteger(args.year)) {
    usageAndExit();
  }
  if (args.quarter < 1 || args.quarter > 4 || args.year < 1970 || args.year > 2100) {
    usageAndExit();
  }
  return args;
}

function quarterBounds(year, quarter) {
  const startMonth = (quarter - 1) * 3;
  return {
    start: new Date(Date.UTC(year, startMonth, 1, 0, 0, 0)),
    end: new Date(Date.UTC(year, startMonth + 3, 0, 23, 59, 59)),
  };
}

function toDate(v) {
  if (v instanceof Date && !Number.isNaN(v.valueOf())) return v;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    if (!Number.isNaN(d.valueOf())) return d;
  }
  return null;
}

function num(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v && typeof v === "object" && typeof v.raw === "number") return v.raw;
  return null;
}

function safePercentDelta(current, previous) {
  if (current == null || previous == null) return null;
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function pairAtOrBeforeTarget(items, getDate, getValue, targetEnd) {
  const normalized = (items ?? [])
    .map((row) => ({ date: getDate(row), value: getValue(row) }))
    .filter((x) => x.date && x.value != null)
    .sort((a, b) => a.date - b.date);

  if (normalized.length < 2) return { current: null, previous: null };

  let idx = normalized.findLastIndex((x) => x.date <= targetEnd);
  if (idx < 0) idx = normalized.length - 1;
  if (idx === 0) return { current: normalized[0].value, previous: null };
  return { current: normalized[idx].value, previous: normalized[idx - 1].value };
}

function extractFcfChangeQoQ(quoteSummary, targetEnd) {
  const rows = quoteSummary?.cashflowStatementHistoryQuarterly?.cashflowStatements;

  const fromFcf = pairAtOrBeforeTarget(
    rows,
    (row) => toDate(row?.endDate),
    (row) => num(row?.freeCashFlow),
    targetEnd
  );
  const fcfDelta = safePercentDelta(fromFcf.current, fromFcf.previous);
  if (fcfDelta != null) return fcfDelta;

  const fromFallback = pairAtOrBeforeTarget(
    rows,
    (row) => toDate(row?.endDate),
    (row) => {
      const ocf = num(row?.totalCashFromOperatingActivities);
      const capex = num(row?.capitalExpenditures);
      if (ocf == null || capex == null) return null;
      return ocf + capex;
    },
    targetEnd
  );
  return safePercentDelta(fromFallback.current, fromFallback.previous);
}

function extractEarningsSurprises(quoteSummary, targetEnd) {
  const rows = quoteSummary?.earningsHistory?.history ?? [];
  const normalized = rows
    .map((row) => ({ row, date: toDate(row?.quarter ?? row?.period) }))
    .filter((x) => x.date)
    .sort((a, b) => a.date - b.date);

  let idx = normalized.findLastIndex((x) => x.date <= targetEnd);
  if (idx < 0 && normalized.length > 0) idx = normalized.length - 1;
  const row = idx >= 0 ? normalized[idx].row : null;

  const epsSurprisePercent = num(row?.surprisePercent);
  const revenueActual = num(row?.revenueActual);
  const revenueEstimate = num(row?.revenueEstimate);
  const revenueSurprisePercent = safePercentDelta(revenueActual, revenueEstimate);

  return { epsSurprisePercent, revenueSurprisePercent };
}

function priceChangeFromChart(chart, periodStart, periodEnd) {
  const closes = chart?.quotes ?? [];
  const clean = closes
    .filter((q) => q?.date && q?.close != null)
    .filter((q) => q.date >= periodStart && q.date <= periodEnd)
    .map((q) => q.close)
    .filter((v) => typeof v === "number" && Number.isFinite(v));

  if (clean.length < 2) return null;
  return safePercentDelta(clean[clean.length - 1], clean[0]);
}

function extractDividendChangePercent(chart, year, quarter) {
  const prevQuarter = quarter === 1 ? 4 : quarter - 1;
  const prevYear = quarter === 1 ? year - 1 : year;
  const currentBounds = quarterBounds(year, quarter);
  const prevBounds = quarterBounds(prevYear, prevQuarter);
  const dividends = chart?.events?.dividends ?? [];

  let currentTotal = 0;
  let prevTotal = 0;
  for (const d of dividends) {
    const date = toDate(d?.date);
    const amount = num(d?.amount);
    if (!date || amount == null) continue;
    if (date >= currentBounds.start && date <= currentBounds.end) currentTotal += amount;
    if (date >= prevBounds.start && date <= prevBounds.end) prevTotal += amount;
  }

  if (currentTotal === 0 && prevTotal === 0) return null;
  if (prevTotal === 0) return currentTotal > 0 ? 100 : null;
  return ((currentTotal - prevTotal) / Math.abs(prevTotal)) * 100;
}

async function fetchFinancialMetrics({ ticker, quarter, year }) {
  const targetQuarter = quarter;
  const targetBounds = quarterBounds(year, targetQuarter);
  const prevQuarter = targetQuarter === 1 ? 4 : targetQuarter - 1;
  const prevQuarterYear = targetQuarter === 1 ? year - 1 : year;
  const prevBounds = quarterBounds(prevQuarterYear, prevQuarter);

  const summaryModules = [
    "summaryDetail",
    "defaultKeyStatistics",
    "earningsHistory",
    "incomeStatementHistoryQuarterly",
    "cashflowStatementHistoryQuarterly",
    "financialData",
  ];

  const [quoteSummary, chart] = await Promise.all([
    yf.quoteSummary(ticker, { modules: summaryModules }),
    yf.chart(ticker, {
      period1: prevBounds.start,
      period2: new Date(targetBounds.end.getTime() + 24 * 60 * 60 * 1000),
      interval: "1d",
      events: "div",
    }),
  ]);

  const { epsSurprisePercent, revenueSurprisePercent } = extractEarningsSurprises(
    quoteSummary,
    targetBounds.end
  );

  const metrics = {
    priceChangePercent: priceChangeFromChart(chart, targetBounds.start, targetBounds.end) ?? 0,
    peRatio:
      num(quoteSummary?.summaryDetail?.trailingPE) ??
      num(quoteSummary?.summaryDetail?.forwardPE) ??
      null,
    epsSurprisePercent,
    revenueSurprisePercent,
    dividendChangePercent: extractDividendChangePercent(chart, year, quarter),
    fcfChangeQoQ: extractFcfChangeQoQ(quoteSummary, targetBounds.end),
    pegRatio: num(quoteSummary?.defaultKeyStatistics?.pegRatio),
    priceToBook: num(quoteSummary?.defaultKeyStatistics?.priceToBook),
    priceToSalesTtm:
      num(quoteSummary?.summaryDetail?.priceToSalesTrailing12Months) ??
      num(quoteSummary?.defaultKeyStatistics?.priceToSalesTrailing12Months),
    enterpriseValue:
      num(quoteSummary?.defaultKeyStatistics?.enterpriseValue) ??
      num(quoteSummary?.financialData?.enterpriseValue),
    enterpriseToEbitda:
      num(quoteSummary?.defaultKeyStatistics?.enterpriseToEbitda) ??
      num(quoteSummary?.financialData?.enterpriseToEbitda),
  };

  return {
    ticker,
    timeframe: { quarter, year },
    metrics,
    pulledFrom: {
      provider: "Yahoo Finance",
      modules: {
        quoteSummary: summaryModules,
        chart: ["interval=1d", "events=div"],
      },
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const payload = await fetchFinancialMetrics(args);
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((err) => {
  console.error(`Failed to fetch Yahoo metrics: ${err.message}`);
  process.exit(1);
});
