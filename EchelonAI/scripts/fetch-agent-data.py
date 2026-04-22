#!/usr/bin/env python3
"""
Bridge script: combines financial_agent.py + search_agent.py outputs for the frontend.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    import yfinance as yf  # type: ignore
except Exception:  # pragma: no cover - runtime environment dependent
    yf = None  # type: ignore

THIS_DIR = Path(__file__).resolve().parent
AGENTS_DIR = THIS_DIR / "agents"
if str(AGENTS_DIR) not in sys.path:
    sys.path.insert(0, str(AGENTS_DIR))

FINANCIAL_IMPORT_ERROR: Optional[str] = None
SEARCH_IMPORT_ERROR: Optional[str] = None
SEC_IMPORT_ERROR: Optional[str] = None
get_financial_metrics = None
search_cultural_events = None
compute_social_score = None
find_10q_filing = None

try:
    from financial_agent import get_financial_metrics as _get_financial_metrics  # type: ignore  # noqa: E402

    get_financial_metrics = _get_financial_metrics
except Exception as exc:  # pragma: no cover - runtime environment dependent
    FINANCIAL_IMPORT_ERROR = str(exc)

try:
    from search_agent import (  # type: ignore  # noqa: E402
        compute_social_score as _compute_social_score,
    )
    from search_agent import (  # type: ignore  # noqa: E402
        search_cultural_events as _search_cultural_events,
    )

    compute_social_score = _compute_social_score
    search_cultural_events = _search_cultural_events
except Exception as exc:  # pragma: no cover - runtime environment dependent
    SEARCH_IMPORT_ERROR = str(exc)

try:
    from sec_agent import find_10q_filing as _find_10q_filing  # type: ignore  # noqa: E402

    find_10q_filing = _find_10q_filing
except Exception as exc:  # pragma: no cover - runtime environment dependent
    SEC_IMPORT_ERROR = str(exc)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch financial + cultural data for a stock/quarter")
    parser.add_argument("--ticker", required=True)
    parser.add_argument("--company", required=True)
    parser.add_argument("--quarter", type=int, required=True)
    parser.add_argument("--year", type=int, required=True)
    return parser.parse_args()


def quarter_bounds(year: int, quarter: int) -> Tuple[date, date]:
    start_month = (quarter - 1) * 3 + 1
    start = date(year, start_month, 1)
    if quarter == 4:
        end = date(year, 12, 31)
    else:
        end = date(year, start_month + 3, 1) - timedelta(days=1)
    return start, end


def quarter_months(quarter: int) -> List[int]:
    first = (quarter - 1) * 3 + 1
    return [first, first + 1, first + 2]


def to_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        out = float(value)
    except Exception:
        return None
    if math.isnan(out) or math.isinf(out):
        return None
    return out


def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def normalize_metrics(raw: Dict[str, Any]) -> Dict[str, Optional[float]]:
    keep_keys = [
        "trailingPE",
        "enterpriseToEbitda",
        "returnOnEquity",
        "debtToEquity",
        "priceToBook",
        "currentRatio",
        "quickRatio",
        "marketCap",
        "totalCash",
        "totalDebt",
        "profitMargins",
        "grossMargins",
        "operatingMargins",
        "ebitdaMargins",
        "revenueGrowth",
        "earningsGrowth",
        "returnOnAssets",
        "payoutRatio",
        "beta",
        "freeCashflow",
        "operatingCashflow",
        "capitalExpenditures",
        "fcf_change",
        "totalRevenue",
        "dividendRate",
        "dividendYield",
        "dividend_change",
    ]
    out: Dict[str, Optional[float]] = {}
    for key in keep_keys:
        out[key] = to_float(raw.get(key))
    return out


def _resample_to(src: List[float], n: int) -> List[float]:
    """Resample a list to exactly n points using linear index interpolation."""
    if len(src) == n:
        return src[:]
    if n == 1:
        return [src[0]]
    step = (len(src) - 1) / (n - 1)
    return [src[min(len(src) - 1, int(round(i * step)))] for i in range(n)]


def build_price_chart(ticker: str, year: int, quarter: int) -> Tuple[Optional[Dict[str, Any]], Optional[str], float]:
    if yf is None:
        return None, "yfinance is not installed in the Python environment used by the agent pipeline.", 0.0

    start, end = quarter_bounds(year, quarter)
    end_plus = end + timedelta(days=1)
    try:
        hist = yf.Ticker(ticker).history(start=start.isoformat(), end=end_plus.isoformat(), interval="1d", auto_adjust=False)
    except Exception as exc:
        return None, f"Price chart fetch failed: {exc}", 0.0

    if hist is None or getattr(hist, "empty", False):
        return None, "Price chart unavailable for the selected quarter.", 0.0

    closes: List[Tuple[date, float]] = []
    for idx, row in hist.iterrows():
        try:
            close_val = to_float(row.get("Close"))
            if close_val is None:
                continue
            d = idx.date() if hasattr(idx, "date") else None
            if d is None:
                continue
            closes.append((d, close_val))
        except Exception:
            continue

    if len(closes) < 2:
        return None, "Insufficient close-price points for this quarter.", 0.0

    max_points = 24
    if len(closes) > max_points:
        step = (len(closes) - 1) / (max_points - 1)
        sampled: List[Tuple[date, float]] = []
        for i in range(max_points):
            idx = int(round(i * step))
            sampled.append(closes[idx])
        deduped: List[Tuple[date, float]] = []
        seen: set = set()
        for d, c in sampled:
            if d in seen:
                continue
            seen.add(d)
            deduped.append((d, c))
        closes = deduped

    values = [c for _, c in closes]
    n = len(values)
    stock_base = values[0]
    v_min = min(values)
    v_max = max(values)

    # Performance-rebased normalization — both stock and S&P start at 50,
    # diverge based on actual % returns using the same pixel scale.
    stock_returns = [(v / stock_base - 1) * 100.0 for v in values]

    # ── S&P 500 benchmark ────────────────────────────────────────────
    benchmark_points: List[float] = []
    benchmark_delta = 0.0
    sp_returns: List[float] = []
    try:
        sp_hist = yf.Ticker("^GSPC").history(
            start=start.isoformat(), end=end_plus.isoformat(), interval="1d", auto_adjust=False
        )
        if sp_hist is not None and not getattr(sp_hist, "empty", False):
            sp_raw: List[float] = []
            for idx, row in sp_hist.iterrows():
                cv = to_float(row.get("Close"))
                if cv is not None:
                    sp_raw.append(cv)
            if len(sp_raw) >= 2:
                sp_resampled = _resample_to(sp_raw, n)
                sp_base = sp_resampled[0]
                sp_returns = [(v / sp_base - 1) * 100.0 for v in sp_resampled]
                benchmark_delta = round(sp_returns[-1], 2)
    except Exception:
        pass  # benchmark failure is non-fatal

    # Calibrate scale: largest absolute return across both series → 40 chart units
    all_returns = stock_returns + sp_returns
    max_abs = max((abs(r) for r in all_returns), default=1.0)
    scale = 40.0 / max(max_abs, 0.5)
    scale = min(scale, 10.0)  # cap to avoid over-amplification on flat periods

    points = [round(max(5.0, min(95.0, 50.0 + r * scale)), 2) for r in stock_returns]
    if sp_returns:
        benchmark_points = [round(max(5.0, min(95.0, 50.0 + r * scale)), 2) for r in sp_returns]

    peak_index = max(range(len(values)), key=lambda i: values[i])
    start_price = values[0]
    end_price = values[-1]
    delta = ((end_price - start_price) / abs(start_price) * 100.0) if start_price != 0 else 0.0
    mid_index = (len(closes) - 1) // 2

    def label(d: date) -> str:
        return d.strftime("%b %d")

    chart = {
        "points": points,
        "labels": [label(closes[0][0]), label(closes[mid_index][0]), label(closes[-1][0])],
        "peakIndex": peak_index,
        "peakLabel": label(closes[peak_index][0]),
        "deltaPrice": round(delta, 2),
        "startPrice": round(start_price, 2),
        "endPrice": round(end_price, 2),
        "highPrice": round(v_max, 2),
        "lowPrice": round(v_min, 2),
        "benchmarkPoints": benchmark_points,
        "benchmarkDelta": benchmark_delta,
    }
    return chart, None, float(delta)


def dedupe_articles(articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    best_by_url: Dict[str, Dict[str, Any]] = {}
    for article in articles:
        url = str(article.get("url", "")).strip()
        if not url:
            continue
        prev = best_by_url.get(url)
        if not prev or float(article.get("relevance_score", 0.0)) > float(prev.get("relevance_score", 0.0)):
            best_by_url[url] = article
    merged = list(best_by_url.values())
    merged.sort(key=lambda x: float(x.get("relevance_score", 0.0)), reverse=True)
    return merged[:15]


def map_signal(row: Dict[str, Any]) -> Dict[str, Any]:
    sentiment_raw = str(row.get("sentiment", "yellow")).strip().lower()
    sentiment = "neutral"
    if sentiment_raw == "green":
        sentiment = "pos"
    elif sentiment_raw == "red":
        sentiment = "neg"

    title = str(row.get("title", "")).strip()
    content = str(row.get("content", "")).strip()
    text = title if not content else f"{title}. {content}"

    date_text = str(row.get("published_date", "")).strip()
    if len(date_text) >= 10:
        date_text = date_text[:10]

    outlet = str(row.get("outlet", "")).strip()

    return {
        "date": date_text,
        "sentiment": sentiment,
        "text": text,
        "source": outlet or "Web",
        "title": title,
        "url": str(row.get("url", "")).strip(),
        "content": content,
        "relevanceScore": to_float(row.get("relevance_score")) or 0.0,
    }


def compute_financial_score(metrics: Dict[str, Optional[float]]) -> float:
    score = 50.0
    contributors = 0

    def add(value: Optional[float], transform) -> None:
        nonlocal score, contributors
        if value is None:
            return
        score += transform(value)
        contributors += 1

    add(metrics.get("revenueGrowth"), lambda v: clamp(v * 60.0, -10.0, 10.0))
    add(metrics.get("earningsGrowth"), lambda v: clamp(v * 60.0, -10.0, 10.0))
    add(metrics.get("returnOnEquity"), lambda v: clamp(v * 45.0, -8.0, 10.0))
    add(metrics.get("returnOnAssets"), lambda v: clamp(v * 80.0, -8.0, 10.0))
    add(metrics.get("profitMargins"), lambda v: clamp(v * 45.0, -8.0, 8.0))
    add(metrics.get("debtToEquity"), lambda v: clamp((1.6 - v) * 6.0, -10.0, 8.0))
    add(metrics.get("trailingPE"), lambda v: clamp((28.0 - v) * 0.7, -8.0, 6.0))
    add(metrics.get("currentRatio"), lambda v: clamp((v - 1.0) * 6.0, -6.0, 6.0))

    if contributors == 0:
        return 50.0
    return round(clamp(score), 2)




def build_sources(signals: List[Dict[str, Any]], ticker: str) -> List[Dict[str, str]]:
    sources = [
        {
            "title": f"Financial Agent · {ticker} quarterly metrics",
            "url": "#",
            "date": "",
            "type": "filing",
        },
        {
            "title": f"Search Agent · {ticker} cultural signals",
            "url": "#",
            "date": "",
            "type": "web",
        },
    ]

    for signal in signals[:8]:
        title = signal.get("title") or signal.get("text") or "Signal Source"
        sources.append(
            {
                "title": str(title),
                "url": str(signal.get("url") or "#"),
                "date": str(signal.get("date") or ""),
                "type": "news",
            }
        )
    return sources


def main() -> None:
    args = parse_args()
    ticker = str(args.ticker).strip().upper()
    company = str(args.company).strip() or ticker
    quarter = int(args.quarter)
    year = int(args.year)

    errors: Dict[str, str] = {}

    month_for_financial = quarter * 3
    if get_financial_metrics is None:
        errors["financial"] = f"financial_agent import failed: {FINANCIAL_IMPORT_ERROR or 'unknown error'}"
        financial_metrics = normalize_metrics({})
    else:
        raw_financial = get_financial_metrics(ticker, year, month_for_financial)
        if isinstance(raw_financial, dict) and raw_financial.get("error"):
            errors["financial"] = str(raw_financial.get("error"))
            financial_metrics = normalize_metrics({})
        else:
            financial_metrics = normalize_metrics(raw_financial if isinstance(raw_financial, dict) else {})

    all_articles: List[Dict[str, Any]] = []
    if search_cultural_events is None:
        errors["cultural"] = f"search_agent import failed: {SEARCH_IMPORT_ERROR or 'unknown error'}"
    else:
        for month in quarter_months(quarter):
            try:
                batch = search_cultural_events(company, year, month, ticker=ticker)
                if isinstance(batch, list):
                    all_articles.extend(batch)
            except Exception as exc:
                errors["cultural"] = f"{exc}"
                break

    deduped_articles = dedupe_articles(all_articles)
    if compute_social_score is None:
        cultural_score = 50.0
    else:
        cultural_score = round(compute_social_score(deduped_articles), 2) if deduped_articles else 50.0
    cultural_signals = [map_signal(a) for a in deduped_articles]

    # SEC EDGAR 10-Q filing
    sec_filing: Optional[Dict[str, Any]] = None
    if find_10q_filing is None:
        errors["secFiling"] = f"sec_agent import failed: {SEC_IMPORT_ERROR or 'unknown error'}"
    else:
        try:
            raw_sec = find_10q_filing(ticker, year, quarter)
            if isinstance(raw_sec, dict) and raw_sec.get("error"):
                errors["secFiling"] = str(raw_sec["error"])
            elif isinstance(raw_sec, dict):
                sec_filing = {
                    "filingUrl": raw_sec.get("filing_url", ""),
                    "documentUrl": raw_sec.get("document_url", ""),
                    "filingDate": raw_sec.get("filing_date", ""),
                    "periodOfReport": raw_sec.get("period_of_report", ""),
                    "companyName": raw_sec.get("company_name", ""),
                    "highlights": raw_sec.get("highlights", []),
                }
        except Exception as exc:
            errors["secFiling"] = f"SEC fetch failed: {exc}"

    price_chart, price_error, delta_price = build_price_chart(ticker, year, quarter)
    if price_error:
        errors["priceChart"] = price_error

    financial_score = compute_financial_score(financial_metrics)
    alpha_score = round(clamp(0.65 * financial_score + 0.35 * cultural_score), 2)

    payload = {
        "ticker": ticker,
        "companyName": company,
        "timeframe": {"quarter": quarter, "year": year},
        "financialMetrics": financial_metrics,
        "culturalSignals": cultural_signals,
        "scores": {
            "financialScore": financial_score,
            "culturalScore": cultural_score,
            "forumMomentumScore": 0,
            "alphaScore": alpha_score,
        },
        "priceChart": price_chart,
        "priceDeltaPercent": delta_price,
        "secFiling": sec_filing,
        "sources": build_sources(cultural_signals, ticker),
        "errors": errors,
    }

    print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main()
