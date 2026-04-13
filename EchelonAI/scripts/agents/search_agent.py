"""
Search agent for cultural events and news using Tavily.
"""

from __future__ import annotations

import calendar
import os
import json
import re
from typing import Dict, List
from urllib.parse import urlparse

from dotenv import load_dotenv
from tavily import TavilyClient

REPUTABLE_DOMAINS = {
    "reuters.com",
    "bloomberg.com",
    "cnbc.com",
    "ft.com",
    "wsj.com",
    "apnews.com",
    "bbc.com",
    "theguardian.com",
}

# Monthly traffic and estimated clicks (hardcoded)
OUTLET_TRAFFIC = {
    "Reuters": {"monthly_volume": 203000, "estimated_clicks": 163000},
    "Bloomberg": {"monthly_volume": 258000, "estimated_clicks": 206000},
    "CNBC": {"monthly_volume": 359000, "estimated_clicks": 310000},
    "Financial Times": {"monthly_volume": 42900, "estimated_clicks": 41600},
    "The Wall Street Journal": {"monthly_volume": 229000, "estimated_clicks": 203000},
    "AP News": {"monthly_volume": 34400, "estimated_clicks": 31500},
    "BBC": {"monthly_volume": 579000, "estimated_clicks": 451000},
    "The Guardian": {"monthly_volume": 149000, "estimated_clicks": 127000},
}

# Lightweight sentiment with weights, negation, and intensifiers.
POSITIVE_SCORES = {
    "beat": 1.5,
    "beats": 1.5,
    "profit": 1.4,
    "profits": 1.4,
    "surge": 1.4,
    "rally": 1.3,
    "rallies": 1.3,
    "growth": 1.2,
    "strong": 1.2,
    "upgrade": 1.2,
    "upgraded": 1.2,
    "bullish": 1.2,
    "outperform": 1.2,
    "outperforms": 1.2,
    "win": 1.2,
    "wins": 1.2,
    "positive": 1.1,
    "raises": 1.1,
    "raised": 1.1,
    "record-high": 1.8,
}

NEGATIVE_SCORES = {
    "miss": -1.5,
    "misses": -1.5,
    "decline": -1.3,
    "declines": -1.3,
    "drop": -1.2,
    "drops": -1.2,
    "fall": -1.2,
    "falls": -1.2,
    "loss": -1.4,
    "losses": -1.4,
    "negative": -1.1,
    "lawsuit": -1.6,
    "sue": -1.6,
    "sues": -1.6,
    "investigation": -1.5,
    "probe": -1.4,
    "recall": -1.4,
    "downgrade": -1.3,
    "downgraded": -1.3,
    "cut": -1.0,
    "cuts": -1.0,
    "warns": -1.2,
    "warning": -1.2,
    "slump": -1.3,
    "weak": -1.1,
    "plunge": -1.6,
    "fraud": -1.8,
    "layoffs": -1.4,
    "layoff": -1.4,
}

PHRASE_SCORES = {
    "beats expectations": 2.0,
    "record profit": 2.0,
    "record profits": 2.0,
    "strong demand": 1.5,
    "profit warning": -2.0,
    "misses expectations": -2.0,
    "price cuts": -1.5,
    "under investigation": -2.0,
}

NEGATIONS = {"not", "no", "never", "without"}
INTENSIFIERS = {"very", "really", "strongly", "sharply", "significantly"}
DIMINISHERS = {"slightly", "somewhat", "marginally", "modestly"}


def _month_name(month: int) -> str:
    if not 1 <= month <= 12:
        raise ValueError("month must be in 1..12")
    return calendar.month_name[month]


def _domain_from_url(url: str) -> str:
    try:
        netloc = urlparse(url).netloc.lower()
    except Exception:
        return ""
    if netloc.startswith("www."):
        netloc = netloc[4:]
    return netloc


def _outlet_name_from_url(url: str) -> str:
    domain = _domain_from_url(url)
    if not domain:
        return ""
    outlet_map = {
        "reuters.com": "Reuters",
        "bloomberg.com": "Bloomberg",
        "cnbc.com": "CNBC",
        "ft.com": "Financial Times",
        "wsj.com": "The Wall Street Journal",
        "apnews.com": "AP News",
        "bbc.com": "BBC",
        "theguardian.com": "The Guardian",
    }
    for d, name in outlet_map.items():
        if domain == d or domain.endswith("." + d):
            return name
    return domain


def _score_article(title: str, content: str, url: str, month_name: str, year: int) -> float:
    score = 0.0

    # More substance: longer content snippets
    if content:
        score += min(len(content), 1000) / 100.0  # cap influence

    # Temporal relevance: title includes month or year
    title_l = (title or "").lower()
    if str(year) in title_l:
        score += 5.0
    if month_name.lower() in title_l:
        score += 3.0

    # Reputable domain boost
    domain = _domain_from_url(url)
    if domain in REPUTABLE_DOMAINS:
        score += 4.0
    else:
        # Also boost reputable subdomains, e.g., www.bbc.com
        if any(domain.endswith("." + d) for d in REPUTABLE_DOMAINS):
            score += 3.0

    return score


def _extract_date(result: Dict[str, object]) -> str:
    for key in (
        "published_date",
        "published_at",
        "published_time",
        "date",
        "datetime",
        "time",
        "created_at",
    ):
        val = result.get(key)
        if val:
            return str(val).strip()
    meta = result.get("metadata")
    if isinstance(meta, dict):
        for key in (
            "published_date",
            "published_at",
            "published_time",
            "date",
            "datetime",
            "time",
            "created_at",
        ):
            val = meta.get(key)
            if val:
                return str(val).strip()
    return ""


def _classify_sentiment(text: str) -> str:
    """
    Lightweight sentiment classifier with negation and intensifier handling.
    Returns: red (negative), yellow (neutral), green (positive)
    """
    if not text:
        return "yellow"
    text_l = text.lower()
    score = 0.0

    for phrase, p_score in PHRASE_SCORES.items():
        if phrase in text_l:
            score += p_score

    tokens = re.findall(r"[a-z]+(?:-[a-z]+)?", text_l)
    for i, tok in enumerate(tokens):
        base = 0.0
        if tok in POSITIVE_SCORES:
            base = POSITIVE_SCORES[tok]
        elif tok in NEGATIVE_SCORES:
            base = NEGATIVE_SCORES[tok]
        if base == 0.0:
            continue

        window = tokens[max(0, i - 3) : i]
        if any(w in NEGATIONS for w in window):
            base *= -0.8
        if any(w in INTENSIFIERS for w in window):
            base *= 1.4
        if any(w in DIMINISHERS for w in window):
            base *= 0.6
        score += base

    if score >= 1.5:
        return "green"
    if score <= -1.5:
        return "red"
    return "yellow"


def _sentiment_value(label: str) -> int:
    if label == "green":
        return 1
    if label == "red":
        return -1
    return 0


def _outlet_weight(outlet: str) -> float:
    data = OUTLET_TRAFFIC.get(outlet)
    if not data:
        return 1.0
    # Blend monthly volume and estimated clicks, then dampen via sqrt
    base = 0.6 * data["monthly_volume"] + 0.4 * data["estimated_clicks"]
    return (base ** 0.5) / 100.0


def _cap_outlet_weights(weights: List[float], cap_ratio: float = 0.35) -> List[float]:
    if not weights:
        return weights
    total = sum(weights)
    if total == 0:
        return weights
    cap = cap_ratio * total
    capped = [min(w, cap) for w in weights]
    capped_total = sum(capped)
    if capped_total == 0:
        return capped
    return [w / capped_total for w in capped]


def compute_social_score(articles: List[Dict[str, object]]) -> float:
    """
    Social score in [0, 100], combining traffic-weighted sentiment,
    polarity ratio, and impact (relevance_score).
    """
    if not articles:
        return 50.0

    weights = []
    sentiment_vals = []
    impacts = []
    for a in articles:
        outlet = str(a.get("outlet", "")).strip()
        weights.append(_outlet_weight(outlet))
        sentiment_vals.append(_sentiment_value(str(a.get("sentiment", "yellow"))))
        impacts.append(float(a.get("relevance_score", 0.0)))

    norm_weights = _cap_outlet_weights(weights, cap_ratio=0.35)

    # Traffic-weighted sentiment index in [-1, 1]
    sentiment_index = sum(w * s for w, s in zip(norm_weights, sentiment_vals))

    # Polarity ratio focuses on positive vs negative volume
    pos_w = sum(w for w, s in zip(norm_weights, sentiment_vals) if s > 0)
    neg_w = sum(w for w, s in zip(norm_weights, sentiment_vals) if s < 0)
    polarity_ratio = (pos_w - neg_w) / (pos_w + neg_w + 1e-6)

    # Impact index from relevance scores
    avg_impact = sum(impacts) / max(len(impacts), 1)
    impact_index = min(1.0, avg_impact / 12.0)

    # Blend: sentiment + polarity + impact
    score = 78.0 + 40.0 * sentiment_index + 10.0 * polarity_ratio + 5.0 * impact_index
    return max(0.0, min(100.0, score))


def search_cultural_events(term: str, year: int, month: int) -> List[Dict[str, object]]:
    """
    Search the web for news and cultural events related to a term within a specific month and year.

    Returns a list of dicts with: title, url, content (<=800 chars), relevance_score.
    """
    if not term or not isinstance(term, str):
        raise ValueError("term must be a non-empty string")
    if not isinstance(year, int):
        raise ValueError("year must be an int")

    month_name = _month_name(month)

    load_dotenv()
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        raise RuntimeError(
            "TAVILY_API_KEY is not set. Add it via the Settings panel in the app."
        )

    client = TavilyClient(api_key=api_key)

    query = f"{term} news events controversy announcement {month_name} {year}"

    response = client.search(
        query=query,
        search_depth="basic",
        max_results=10,
        include_raw_content=False,
    )

    results = response.get("results", []) if isinstance(response, dict) else []

    articles: List[Dict[str, object]] = []
    for r in results:
        title = (r.get("title") or "").strip()
        url = (r.get("url") or "").strip()
        content = (r.get("content") or "").strip()
        if len(content) > 800:
            content = content[:800].rstrip()

        score = _score_article(title, content, url, month_name, year)
        sentiment = _classify_sentiment(f"{title} {content}")
        outlet = (r.get("source") or "").strip()
        if not outlet:
            outlet = _outlet_name_from_url(url)
        published_date = _extract_date(r)

        articles.append(
            {
                "title": title,
                "url": url,
                "content": content,
                "relevance_score": score,
                "sentiment": sentiment,
                "outlet": outlet,
                "published_date": published_date,
            }
        )

    # Filter to reputable domains only; fall back to all if < 2 reputable found
    reputable = [a for a in articles if _domain_from_url(str(a.get("url", ""))) in REPUTABLE_DOMAINS]
    final = reputable if len(reputable) >= 2 else articles
    final.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
    return final[:10]


def save_articles_to_json(
    articles: List[Dict[str, object]], output_path: str = "search_results.json"
) -> str:
    """
    Save articles to a JSON file and return the output path.
    """
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)
    return output_path


def save_output_to_json(
    articles: List[Dict[str, object]], output_path: str = "search_results.json"
) -> str:
    """
    Save articles plus computed social score to a JSON file.
    """
    payload = {
        "social_score": compute_social_score(articles),
        "articles": articles,
    }
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return output_path


def format_articles_for_llm(articles: List[Dict[str, object]]) -> str:
    """
    Format article list into a clean string for LLM prompts.
    """
    lines: List[str] = []
    for idx, article in enumerate(articles, start=1):
        title = str(article.get("title", "")).strip()
        url = str(article.get("url", "")).strip()
        content = str(article.get("content", "")).strip()
        lines.append(f"{idx}. {title} - {url} - {content}")
    return "\n".join(lines)


if __name__ == "__main__":
    test_term = "Nvidia"
    test_year = 2024
    test_month = 5
    found = search_cultural_events(test_term, test_year, test_month)
    output_file = save_output_to_json(found)
    print(f"Articles returned: {len(found)}")
    print(f"Saved to: {output_file}")
    print(f"Social score: {compute_social_score(found):.2f}")
    print(format_articles_for_llm(found))
