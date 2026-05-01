#!/usr/bin/env python3
"""
Fetch lightweight peer comparison data for a given ticker/quarter.
Returns a JSON object: { peers: [...], error?: string }
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import urllib.request
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    import yfinance as yf  # type: ignore
except Exception:
    yf = None

THIS_DIR = Path(__file__).resolve().parent
AGENTS_DIR = THIS_DIR / "agents"
if str(AGENTS_DIR) not in sys.path:
    sys.path.insert(0, str(AGENTS_DIR))

_FINANCIAL_OK = False
_SEARCH_OK = False
get_financial_metrics = None
search_cultural_events = None
compute_social_score = None

try:
    from financial_agent import get_financial_metrics as _gfm  # type: ignore  # noqa: E402
    get_financial_metrics = _gfm
    _FINANCIAL_OK = True
except Exception:
    pass

try:
    from search_agent import (  # type: ignore  # noqa: E402
        compute_social_score as _css,
        search_cultural_events as _sce,
    )
    compute_social_score = _css
    search_cultural_events = _sce
    _SEARCH_OK = True
except Exception:
    pass


# Curated peer map: main ticker -> [(peer_ticker, peer_name), ...]
PEER_MAP: Dict[str, List[Tuple[str, str]]] = {
    "NKE":   [("DECK", "Deckers Brands"), ("LULU", "Lululemon"), ("UAA", "Under Armour")],
    "LULU":  [("NKE", "Nike"), ("DECK", "Deckers Brands"), ("UAA", "Under Armour")],
    "NVDA":  [("AMD", "AMD"), ("INTC", "Intel"), ("AVGO", "Broadcom")],
    "AMD":   [("NVDA", "Nvidia"), ("INTC", "Intel"), ("QCOM", "Qualcomm")],
    "INTC":  [("NVDA", "Nvidia"), ("AMD", "AMD"), ("QCOM", "Qualcomm")],
    "AVGO":  [("NVDA", "Nvidia"), ("AMD", "AMD"), ("QCOM", "Qualcomm")],
    "QCOM":  [("NVDA", "Nvidia"), ("AMD", "AMD"), ("AVGO", "Broadcom")],
    "TSLA":  [("F", "Ford"), ("GM", "General Motors"), ("RIVN", "Rivian")],
    "RIVN":  [("TSLA", "Tesla"), ("F", "Ford"), ("GM", "General Motors")],
    "F":     [("TSLA", "Tesla"), ("GM", "General Motors"), ("STLA", "Stellantis")],
    "GM":    [("TSLA", "Tesla"), ("F", "Ford"), ("STLA", "Stellantis")],
    "AAPL":  [("MSFT", "Microsoft"), ("GOOGL", "Alphabet"), ("META", "Meta")],
    "MSFT":  [("AAPL", "Apple"), ("GOOGL", "Alphabet"), ("CRM", "Salesforce")],
    "GOOGL": [("MSFT", "Microsoft"), ("META", "Meta"), ("AMZN", "Amazon")],
    "GOOG":  [("MSFT", "Microsoft"), ("META", "Meta"), ("AMZN", "Amazon")],
    "META":  [("GOOGL", "Alphabet"), ("SNAP", "Snap"), ("PINS", "Pinterest")],
    "AMZN":  [("MSFT", "Microsoft"), ("GOOGL", "Alphabet"), ("WMT", "Walmart")],
    "NFLX":  [("DIS", "Disney"), ("WBD", "Warner Bros. Discovery"), ("PARA", "Paramount")],
    "DIS":   [("NFLX", "Netflix"), ("WBD", "Warner Bros. Discovery"), ("CMCSA", "Comcast")],
    "WMT":   [("TGT", "Target"), ("COST", "Costco"), ("AMZN", "Amazon")],
    "TGT":   [("WMT", "Walmart"), ("COST", "Costco"), ("KR", "Kroger")],
    "COST":  [("WMT", "Walmart"), ("TGT", "Target"), ("BJ", "BJ's Wholesale")],
    "JPM":   [("BAC", "Bank of America"), ("GS", "Goldman Sachs"), ("MS", "Morgan Stanley")],
    "GS":    [("MS", "Morgan Stanley"), ("JPM", "JPMorgan Chase"), ("BAC", "Bank of America")],
    "MS":    [("GS", "Goldman Sachs"), ("JPM", "JPMorgan Chase"), ("BAC", "Bank of America")],
    "UAL":   [("DAL", "Delta"), ("AAL", "American Airlines"), ("LUV", "Southwest")],
    "DAL":   [("UAL", "United Airlines"), ("AAL", "American Airlines"), ("LUV", "Southwest")],
    "LLY":   [("NVO", "Novo Nordisk"), ("JNJ", "Johnson & Johnson"), ("PFE", "Pfizer")],
    "JNJ":   [("ABT", "Abbott"), ("PFE", "Pfizer"), ("MRK", "Merck")],
    "PFE":   [("JNJ", "Johnson & Johnson"), ("MRK", "Merck"), ("LLY", "Eli Lilly")],
    "SBUX":  [("MCD", "McDonald's"), ("QSR", "Restaurant Brands"), ("CMG", "Chipotle")],
    "MCD":   [("SBUX", "Starbucks"), ("QSR", "Restaurant Brands"), ("CMG", "Chipotle")],
    "CMG":   [("MCD", "McDonald's"), ("SBUX", "Starbucks"), ("YUM", "Yum! Brands")],
    "V":     [("MA", "Mastercard"), ("PYPL", "PayPal"), ("AXP", "American Express")],
    "MA":    [("V", "Visa"), ("PYPL", "PayPal"), ("AXP", "American Express")],
    "PYPL":  [("V", "Visa"), ("MA", "Mastercard"), ("SQ", "Block")],
    "CRM":   [("MSFT", "Microsoft"), ("NOW", "ServiceNow"), ("ORCL", "Oracle")],
    "ORCL":  [("MSFT", "Microsoft"), ("CRM", "Salesforce"), ("NOW", "ServiceNow")],
}


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


def quarter_bounds(year: int, quarter: int) -> Tuple[date, date]:
    start_month = (quarter - 1) * 3 + 1
    start = date(year, start_month, 1)
    end = date(year, 12, 31) if quarter == 4 else date(year, start_month + 3, 1) - timedelta(days=1)
    return start, end


def quarter_mid_month(quarter: int) -> int:
    return (quarter - 1) * 3 + 2


def compute_financial_score(raw: Dict[str, Any]) -> float:
    score = 50.0
    contributors = 0

    def add(key: str, transform) -> None:
        nonlocal score, contributors
        value = to_float(raw.get(key))
        if value is None:
            return
        score += transform(value)
        contributors += 1

    add("revenueGrowth",  lambda v: clamp(v * 60.0, -10.0, 10.0))
    add("earningsGrowth", lambda v: clamp(v * 60.0, -10.0, 10.0))
    add("returnOnEquity", lambda v: clamp(v * 45.0, -8.0, 10.0))
    add("returnOnAssets", lambda v: clamp(v * 80.0, -8.0, 10.0))
    add("profitMargins",  lambda v: clamp(v * 45.0, -8.0, 8.0))
    add("debtToEquity",   lambda v: clamp((1.6 - v) * 6.0, -10.0, 8.0))
    add("trailingPE",     lambda v: clamp((28.0 - v) * 0.7, -8.0, 6.0))
    add("currentRatio",   lambda v: clamp((v - 1.0) * 6.0, -6.0, 6.0))

    if contributors == 0:
        return 50.0
    return round(clamp(score), 2)


def get_quarterly_return(ticker: str, year: int, quarter: int) -> Optional[float]:
    if yf is None:
        return None
    start, end = quarter_bounds(year, quarter)
    try:
        hist = yf.Ticker(ticker).history(
            start=start.isoformat(),
            end=(end + timedelta(days=1)).isoformat(),
            interval="1d",
            auto_adjust=False,
        )
    except Exception:
        return None
    if hist is None or getattr(hist, "empty", False):
        return None
    closes: List[float] = []
    for _, row in hist.iterrows():
        cv = to_float(row.get("Close"))
        if cv is not None:
            closes.append(cv)
    if len(closes) < 2:
        return None
    s, e = closes[0], closes[-1]
    if s == 0:
        return None
    return round((e - s) / abs(s) * 100.0, 2)


def suggest_peers_via_groq(
    ticker: str, company: str, groq_key: str, model: str
) -> List[Tuple[str, str]]:
    if not groq_key:
        return []
    prompt = (
        f"Name exactly 3 publicly traded direct competitors of {company} (ticker: {ticker}). "
        f'Return ONLY JSON: {{"peers": [{{"ticker": "AMD", "name": "AMD"}}, ...]}}. '
        f"US exchange ticker symbols only. No other text."
    )
    body = json.dumps({
        "model": model,
        "max_tokens": 200,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "user", "content": prompt}],
    }).encode()
    try:
        req = urllib.request.Request(
            "https://api.groq.com/openai/v1/chat/completions",
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {groq_key}",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read())
        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        items = parsed if isinstance(parsed, list) else parsed.get("peers", parsed.get("competitors", []))
        return [
            (str(it.get("ticker", "")).upper(), str(it.get("name", it.get("company", ""))))
            for it in items[:3]
            if it.get("ticker")
        ]
    except Exception:
        return []


def get_peers(ticker: str, company: str, groq_key: str, model: str) -> List[Tuple[str, str]]:
    peers = PEER_MAP.get(ticker.upper(), [])
    if peers:
        return peers
    return suggest_peers_via_groq(ticker, company, groq_key, model)


def get_peer_cultural(
    peer_name: str, peer_ticker: str, year: int, quarter: int
) -> Tuple[float, str, str]:
    """Returns (cultural_score, top_headline, dominant_sentiment)."""
    if not _SEARCH_OK or search_cultural_events is None or compute_social_score is None:
        return 50.0, "", "neutral"
    mid_month = quarter_mid_month(quarter)
    try:
        articles = search_cultural_events(peer_name, year, mid_month, ticker=peer_ticker)
    except Exception:
        return 50.0, "", "neutral"
    if not articles:
        return 50.0, "", "neutral"
    score = round(compute_social_score(articles), 2)
    top = articles[0]
    headline = str(top.get("title", "")).strip()
    dominant = "pos" if score > 60 else "neg" if score < 45 else "neutral"
    return score, headline, dominant


def build_peer_entry(ticker: str, name: str, year: int, quarter: int) -> Dict[str, Any]:
    raw_metrics: Dict[str, Any] = {}
    if _FINANCIAL_OK and get_financial_metrics is not None:
        try:
            result = get_financial_metrics(ticker, year, quarter * 3)
            if isinstance(result, dict) and not result.get("error"):
                raw_metrics = result
        except Exception:
            pass

    fin_score = compute_financial_score(raw_metrics)
    key_metrics = {
        "revenueGrowth":  to_float(raw_metrics.get("revenueGrowth")),
        "profitMargins":  to_float(raw_metrics.get("profitMargins")),
        "returnOnEquity": to_float(raw_metrics.get("returnOnEquity")),
        "debtToEquity":   to_float(raw_metrics.get("debtToEquity")),
        "trailingPE":     to_float(raw_metrics.get("trailingPE")),
    }

    q_return = get_quarterly_return(ticker, year, quarter)
    cultural_score, top_headline, cultural_sentiment = get_peer_cultural(name, ticker, year, quarter)

    return {
        "ticker": ticker,
        "companyName": name,
        "quarterlyReturn": q_return,
        "financialScore": fin_score,
        "culturalScore": cultural_score,
        "culturalSentiment": cultural_sentiment,
        "topHeadline": top_headline,
        "keyMetrics": key_metrics,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch peer comparison data")
    parser.add_argument("--ticker",      required=True)
    parser.add_argument("--company",     required=True)
    parser.add_argument("--quarter",     type=int, required=True)
    parser.add_argument("--year",        type=int, required=True)
    parser.add_argument("--groq-model",  default="llama-3.3-70b-versatile")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    ticker  = str(args.ticker).strip().upper()
    company = str(args.company).strip() or ticker
    quarter = int(args.quarter)
    year    = int(args.year)
    groq_key = os.environ.get("GROQ_API_KEY", "")
    model    = str(args.groq_model)

    peers_raw = get_peers(ticker, company, groq_key, model)
    if not peers_raw:
        print(json.dumps({"peers": [], "error": "No peers found for this ticker"}))
        return

    peers = [build_peer_entry(p_ticker, p_name, year, quarter) for p_ticker, p_name in peers_raw[:3]]
    print(json.dumps({"peers": peers}, ensure_ascii=False))


if __name__ == "__main__":
    main()
