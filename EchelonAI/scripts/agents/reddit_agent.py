"""
Reddit agent — fetches historical and recent Reddit posts for a ticker/quarter.

Strategy:
  1. For quarters older than 12 months: Arctic Shift archive API
  2. For recent quarters: Reddit native .json search API (no auth needed)
  3. Dedupes by post id, scores sentiment on post titles
"""
from __future__ import annotations

import calendar
import math
import re
import time
from datetime import date, datetime
from statistics import median
from typing import Dict, List, Optional, Tuple

try:
    import requests as _requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

SUBREDDITS = ["wallstreetbets", "investing", "stocks"]
HEADERS = {"User-Agent": "EchelonAI/1.0 research@echelonai.com"}
FETCH_TIMEOUT = 12
REDDIT_SLEEP = 1.5   # seconds between Reddit .json requests (rate limit safety)
ARCTIC_SLEEP = 0.5   # Arctic Shift is more permissive

# ── Lightweight sentiment classifier ─────────────────────────────────────────
# Tuned for Reddit/WSB vocabulary on top of the base finance lexicon.

_POSITIVE_SCORES = {
    "beat": 1.5, "beats": 1.5, "profit": 1.4, "surge": 1.4, "rally": 1.3,
    "growth": 1.2, "strong": 1.2, "upgrade": 1.2, "bullish": 1.2, "moon": 1.3,
    "squeeze": 1.4, "win": 1.2, "gains": 1.2, "calls": 0.8, "long": 0.6,
    "buy": 0.8, "yolo": 0.9, "tendies": 1.0, "rocket": 1.1, "breakout": 1.2,
}
_NEGATIVE_SCORES = {
    "miss": -1.5, "decline": -1.3, "drop": -1.2, "fall": -1.2, "loss": -1.4,
    "lawsuit": -1.6, "fraud": -1.8, "puts": -0.8, "sell": -0.7, "bankrupt": -2.0,
    "crash": -1.6, "dump": -1.4, "bagholders": -1.3, "down": -0.8, "dead": -1.0,
    "short": -0.5, "overvalued": -1.1, "warning": -1.2,
}
_NEGATIONS = {"not", "no", "never", "without"}


def _classify_sentiment(text: str) -> str:
    if not text:
        return "neutral"
    tokens = re.findall(r"[a-z]+(?:-[a-z]+)?", text.lower())
    score = 0.0
    for i, tok in enumerate(tokens):
        base = _POSITIVE_SCORES.get(tok, 0.0) + _NEGATIVE_SCORES.get(tok, 0.0)
        if base == 0.0:
            continue
        window = tokens[max(0, i - 3): i]
        if any(w in _NEGATIONS for w in window):
            base *= -0.8
        score += base
    if score >= 1.5:
        return "pos"
    if score <= -1.5:
        return "neg"
    return "neutral"


# ── Date helpers ──────────────────────────────────────────────────────────────

def _quarter_unix_bounds(year: int, quarter: int) -> Tuple[int, int]:
    start_month = (quarter - 1) * 3 + 1
    end_month = start_month + 2
    last_day = calendar.monthrange(year, end_month)[1]
    start = int(datetime(year, start_month, 1).timestamp())
    end = int(datetime(year, end_month, last_day, 23, 59, 59).timestamp())
    return start, end


def _quarter_date_strs(year: int, quarter: int) -> Tuple[str, str]:
    start_month = (quarter - 1) * 3 + 1
    end_month = start_month + 2
    last_day = calendar.monthrange(year, end_month)[1]
    return f"{year}-{start_month:02d}-01", f"{year}-{end_month:02d}-{last_day:02d}"


def _is_recent_quarter(year: int, quarter: int) -> bool:
    """True if the quarter ended within the last 12 months."""
    end_month = quarter * 3
    last_day = calendar.monthrange(year, end_month)[1]
    quarter_end = date(year, end_month, last_day)
    return (date.today() - quarter_end).days < 365


def _ts_to_iso(ts: float) -> str:
    try:
        return datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")
    except Exception:
        return ""


# ── Arctic Shift (historical, > 12 months) ───────────────────────────────────

ARCTIC_BASE = "https://arctic-shift.photon-reddit.com/api"


def _arctic_shift_search(ticker: str, company: str, year: int, quarter: int) -> List[Dict]:
    """Fetch posts from Arctic Shift archive for a specific quarter."""
    start_date, end_date = _quarter_date_strs(year, quarter)
    subreddits_str = ",".join(SUBREDDITS)
    seen_ids: set = set()
    all_posts: List[Dict] = []

    # Query ticker first, then company name if sparse
    for query in [ticker, company]:
        if query == company and len(all_posts) >= 5:
            break
        try:
            resp = _requests.get(
                f"{ARCTIC_BASE}/posts/search",
                headers=HEADERS,
                params={
                    "subreddit": subreddits_str,
                    "after": start_date,
                    "before": end_date,
                    "q": query,
                    "limit": 100,
                    "sort": "score",
                },
                timeout=FETCH_TIMEOUT,
            )
            if resp.status_code != 200:
                time.sleep(ARCTIC_SLEEP)
                continue
            data = resp.json()
            items = data if isinstance(data, list) else data.get("data", [])
            for item in items:
                post_id = str(item.get("id", ""))
                if not post_id or post_id in seen_ids:
                    continue
                seen_ids.add(post_id)
                ts = float(item.get("created_utc", 0))
                title = str(item.get("title", "")).strip()
                if not title:
                    continue
                permalink = item.get("permalink", "")
                all_posts.append({
                    "id": post_id,
                    "title": title,
                    "score": int(item.get("score", 0)),
                    "num_comments": int(item.get("num_comments", 0)),
                    "created_utc": ts,
                    "subreddit": str(item.get("subreddit", "")).lower().strip(),
                    "url": f"https://reddit.com{permalink}" if permalink else str(item.get("url", "")),
                    "sentiment": _classify_sentiment(title),
                    "date": _ts_to_iso(ts),
                })
            time.sleep(ARCTIC_SLEEP)
        except Exception:
            time.sleep(ARCTIC_SLEEP)
            continue

    return all_posts


# ── Reddit .json (recent, within last 12 months) ─────────────────────────────

def _reddit_json_search(ticker: str, company: str, start_ts: int, end_ts: int) -> List[Dict]:
    """
    Fetch posts from Reddit native .json API.
    Uses t=year (widest supported window), then filters client-side by timestamp.
    """
    seen_ids: set = set()
    all_posts: List[Dict] = []

    for sub in SUBREDDITS:
        for query in [ticker, company]:
            try:
                resp = _requests.get(
                    f"https://www.reddit.com/r/{sub}/search.json",
                    headers=HEADERS,
                    params={
                        "q": query,
                        "restrict_sr": "on",
                        "sort": "top",
                        "t": "year",
                        "limit": 100,
                    },
                    timeout=FETCH_TIMEOUT,
                )
                if resp.status_code != 200:
                    time.sleep(REDDIT_SLEEP)
                    continue
                children = resp.json().get("data", {}).get("children", [])
                for child in children:
                    p = child.get("data", {})
                    ts = float(p.get("created_utc", 0))
                    if not (start_ts <= ts <= end_ts):
                        continue
                    post_id = str(p.get("id", ""))
                    if not post_id or post_id in seen_ids:
                        continue
                    seen_ids.add(post_id)
                    title = str(p.get("title", "")).strip()
                    if not title:
                        continue
                    permalink = str(p.get("permalink", ""))
                    all_posts.append({
                        "id": post_id,
                        "title": title,
                        "score": int(p.get("score", 0)),
                        "num_comments": int(p.get("num_comments", 0)),
                        "created_utc": ts,
                        "subreddit": sub,
                        "url": f"https://reddit.com{permalink}" if permalink else "",
                        "sentiment": _classify_sentiment(title),
                        "date": _ts_to_iso(ts),
                    })
                time.sleep(REDDIT_SLEEP)
            except Exception:
                time.sleep(REDDIT_SLEEP)
                continue

    return all_posts


# ── Public API ────────────────────────────────────────────────────────────────

def fetch_reddit_posts(ticker: str, company: str, year: int, quarter: int) -> List[Dict]:
    """
    Returns deduplicated Reddit posts for the given ticker and quarter.
    Routes to Arctic Shift for historical quarters, Reddit .json for recent.
    """
    if not REQUESTS_AVAILABLE:
        return []

    start_ts, end_ts = _quarter_unix_bounds(year, quarter)

    if _is_recent_quarter(year, quarter):
        posts = _reddit_json_search(ticker, company, start_ts, end_ts)
    else:
        posts = _arctic_shift_search(ticker, company, year, quarter)

    posts.sort(key=lambda p: p.get("score", 0), reverse=True)
    return posts[:50]


def score_social(posts: List[Dict]) -> float:
    """
    Social score in [0, 100].
    Weights each post by log(upvotes+1) * sentiment_value, then normalises to base-50.
    """
    if not posts:
        return 50.0

    total_weight = 0.0
    weighted_sentiment = 0.0

    for p in posts:
        raw_score = max(0, int(p.get("score", 0)))
        weight = math.log(raw_score + 1) + 1.0
        sent = p.get("sentiment", "neutral")
        sent_val = 1.0 if sent == "pos" else (-1.0 if sent == "neg" else 0.0)
        weighted_sentiment += weight * sent_val
        total_weight += weight

    if total_weight == 0:
        return 50.0

    sentiment_index = weighted_sentiment / total_weight   # [-1, 1]
    presence_bonus = min(5.0, len(posts) * 0.3)
    score = 50.0 + 35.0 * sentiment_index + presence_bonus
    return round(max(0.0, min(100.0, score)), 2)


def compute_mention_velocity(posts: List[Dict], start_ts: int, end_ts: int) -> float:
    """Posts per week over the quarter."""
    if not posts:
        return 0.0
    weeks = max(1.0, (end_ts - start_ts) / (7 * 24 * 3600))
    return round(len(posts) / weeks, 2)


def compute_first_mention_date(posts: List[Dict]) -> Optional[str]:
    """ISO date of the earliest post."""
    if not posts:
        return None
    earliest = min(posts, key=lambda p: p.get("created_utc", float("inf")))
    return earliest.get("date") or None


# ── CLI test ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import json, sys
    ticker = sys.argv[1] if len(sys.argv) > 1 else "GME"
    company = sys.argv[2] if len(sys.argv) > 2 else "GameStop"
    year = int(sys.argv[3]) if len(sys.argv) > 3 else 2021
    quarter = int(sys.argv[4]) if len(sys.argv) > 4 else 1
    posts = fetch_reddit_posts(ticker, company, year, quarter)
    start_ts, end_ts = _quarter_unix_bounds(year, quarter)
    print(json.dumps({
        "posts_found": len(posts),
        "social_score": score_social(posts),
        "mention_velocity": compute_mention_velocity(posts, start_ts, end_ts),
        "first_mention_date": compute_first_mention_date(posts),
        "top_3": posts[:3],
    }, indent=2))
