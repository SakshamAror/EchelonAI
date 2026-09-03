"""
Cultural divergence utilities.

Computes lead/lag between Reddit social signal and mainstream media coverage,
then classifies the divergence pattern into an interpretable signal type.
"""
from __future__ import annotations

from datetime import datetime
from statistics import median
from typing import Dict, List, Optional


def _parse_iso(date_str: str) -> Optional[datetime]:
    if not date_str or len(date_str) < 10:
        return None
    try:
        return datetime.fromisoformat(date_str[:10])
    except Exception:
        return None


def compute_lead_lag(reddit_posts: List[Dict], mainstream_articles: List[Dict]) -> Optional[float]:
    """
    Returns days Reddit was ahead of mainstream media (positive = Reddit first).

    Method:
      - Take the median date of the top-10 Reddit posts by upvote score.
      - Find the earliest mainstream article date.
      - lead_lag = earliest_mainstream_date - reddit_median_date (in days).

    Returns None if either list is empty or dates cannot be parsed.
    """
    if not reddit_posts or not mainstream_articles:
        return None

    top_posts = sorted(reddit_posts, key=lambda p: p.get("score", 0), reverse=True)[:10]
    post_dates = [_parse_iso(p.get("date", "")) for p in top_posts]
    post_dates_clean = [d for d in post_dates if d is not None]
    if not post_dates_clean:
        return None

    reddit_median_ts = median(d.timestamp() for d in post_dates_clean)
    reddit_median_dt = datetime.utcfromtimestamp(reddit_median_ts)

    article_dates = []
    for a in mainstream_articles:
        raw = a.get("date") or a.get("published_date") or ""
        d = _parse_iso(str(raw))
        if d is not None:
            article_dates.append(d)
    if not article_dates:
        return None

    earliest_mainstream = min(article_dates)

    # Positive = Reddit median was before earliest mainstream article
    lead_lag = (earliest_mainstream - reddit_median_dt).total_seconds() / 86400.0
    return round(lead_lag, 1)


def classify_signal_type(
    lead_lag: Optional[float],
    mainstream_score: Optional[float],
    social_score: Optional[float],
) -> str:
    """
    Classify the relationship between social and mainstream signals.

    Returns one of:
      - "early_signal": Reddit was 7+ days ahead (retail saw it first — GME pattern)
      - "fade":         Mainstream was 7+ days ahead (Reddit came late, possible fade)
      - "split":        Scores diverge > 20 pts (institutions and retail disagree)
      - "aligned":      Sources roughly agree in timing and sentiment
      - "unknown":      Insufficient data to classify
    """
    has_both = mainstream_score is not None and social_score is not None

    if lead_lag is None and not has_both:
        return "unknown"

    # Score divergence takes priority when the gap is very large
    if has_both and abs(mainstream_score - social_score) > 20:  # type: ignore[operator]
        return "split"

    if lead_lag is not None:
        if lead_lag > 7:
            return "early_signal"
        if lead_lag < -7:
            return "fade"

    return "aligned"


def compute_divergence(
    mainstream_score: Optional[float],
    social_score: Optional[float],
    sec_score: Optional[float],  # reserved for future use in classification
    mainstream_articles: List[Dict],
    reddit_posts: List[Dict],
) -> Dict:
    """
    Returns:
    {
      "mainstreamVsSocial": float | None,   -- positive = mainstream more bullish
      "leadLagDays":        float | None,   -- positive = Reddit was ahead
      "signalType":         str,
    }
    """
    lead_lag = compute_lead_lag(reddit_posts, mainstream_articles)
    signal_type = classify_signal_type(lead_lag, mainstream_score, social_score)

    ms_vs_social: Optional[float] = None
    if mainstream_score is not None and social_score is not None:
        ms_vs_social = round(mainstream_score - social_score, 2)

    return {
        "mainstreamVsSocial": ms_vs_social,
        "leadLagDays": lead_lag,
        "signalType": signal_type,
    }
