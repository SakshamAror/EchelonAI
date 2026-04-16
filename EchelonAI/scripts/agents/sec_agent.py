"""
SEC EDGAR agent — fetches 10-Q filing metadata and MD&A highlights for a given ticker/quarter.

Strategy:
  1. GET company Atom feed  →  extract CIK
  2. GET submissions JSON   →  find 10-Q whose reportDate falls in the calendar quarter
  3. Build filing index URL, fetch it  →  find primary document URL
  4. Stream first ~180 KB of document  →  extract MD&A excerpt
"""
from __future__ import annotations

import calendar
import re
from datetime import date
from typing import Dict, List, Optional, Tuple

try:
    import requests as _requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

EDGAR_BASE = "https://www.sec.gov"
EDGAR_HEADERS = {
    "User-Agent": "EchelonAI research@echelonai.com",
    "Accept-Encoding": "gzip, deflate",
    "Accept": "*/*",
}
FETCH_TIMEOUT = 15
DOC_BYTE_LIMIT = 1_600_000


# ── Date helpers ──────────────────────────────────────────────────────────────

def _quarter_date_range(year: int, quarter: int) -> Tuple[date, date]:
    start_month = (quarter - 1) * 3 + 1
    end_month = start_month + 2
    last_day = calendar.monthrange(year, end_month)[1]
    return date(year, start_month, 1), date(year, end_month, last_day)


def _parse_iso_date(s: str) -> Optional[date]:
    try:
        return date.fromisoformat(s[:10].strip())
    except Exception:
        return None


def _report_date_in_quarter(report_date_str: str, year: int, quarter: int) -> bool:
    d = _parse_iso_date(report_date_str)
    if d is None:
        return False
    start, end = _quarter_date_range(year, quarter)
    return start <= d <= end


# ── HTTP helper ───────────────────────────────────────────────────────────────

def _get(url: str, stream: bool = False, timeout: int = FETCH_TIMEOUT):
    return _requests.get(url, headers=EDGAR_HEADERS, timeout=timeout, stream=stream)


# ── Step 1: CIK from ticker via Atom feed ────────────────────────────────────

def _get_cik(ticker: str) -> Optional[str]:
    """Return zero-padded 10-digit CIK string, or None on failure."""
    atom_url = (
        f"{EDGAR_BASE}/cgi-bin/browse-edgar"
        f"?action=getcompany&CIK={ticker}&type=10-Q"
        f"&dateb=&owner=include&count=1&output=atom"
    )
    r = _get(atom_url)
    r.raise_for_status()
    m = re.search(r"<cik>(\d+)</cik>", r.text, re.IGNORECASE)
    if not m:
        return None
    return m.group(1).zfill(10)


# ── Step 2: Find 10-Q via submissions JSON ────────────────────────────────────

def _find_filing_in_submissions(cik10: str, year: int, quarter: int) -> Optional[Dict[str, str]]:
    """
    Returns dict with accessionNumber, reportDate, filingDate, or None if not found.
    The submissions JSON lists up to 40 recent filings; older ones are in extra files.
    """
    url = f"https://data.sec.gov/submissions/CIK{cik10}.json"
    r = _get(url)
    r.raise_for_status()
    data = r.json()

    recent = data.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    report_dates = recent.get("reportDate", [])
    filing_dates = recent.get("filingDate", [])
    accessions = recent.get("accessionNumber", [])

    for i, form in enumerate(forms):
        if form != "10-Q":
            continue
        if _report_date_in_quarter(report_dates[i], year, quarter):
            return {
                "accessionNumber": accessions[i],
                "reportDate": report_dates[i],
                "filingDate": filing_dates[i],
            }

    # Check extra files if not found in recent
    for extra in data.get("filings", {}).get("files", []):
        extra_url = f"https://data.sec.gov/submissions/{extra['name']}"
        try:
            er = _get(extra_url)
            er.raise_for_status()
            edata = er.json()
            e_forms = edata.get("form", [])
            e_reports = edata.get("reportDate", [])
            e_filings = edata.get("filingDate", [])
            e_acc = edata.get("accessionNumber", [])
            for i, form in enumerate(e_forms):
                if form != "10-Q":
                    continue
                if _report_date_in_quarter(e_reports[i], year, quarter):
                    return {
                        "accessionNumber": e_acc[i],
                        "reportDate": e_reports[i],
                        "filingDate": e_filings[i],
                    }
        except Exception:
            continue

    return None


# ── Step 3: Build filing index URL ───────────────────────────────────────────

def _filing_index_url(cik10: str, accession: str) -> str:
    """e.g. 0000320187-25-000097 → .../000032018725000097/0000320187-25-000097-index.htm"""
    cik_plain = str(int(cik10))  # strip leading zeros for path
    acc_nodash = accession.replace("-", "")
    return f"{EDGAR_BASE}/Archives/edgar/data/{cik_plain}/{acc_nodash}/{accession}-index.htm"


# ── Step 4: Primary document URL from filing index ───────────────────────────

def _resolve_edgar_href(href: str) -> str:
    """Strip the /ix?doc= XBRL viewer wrapper if present and return a plain /Archives path."""
    m = re.search(r"/ix\?doc=(/Archives[^\"&\s]+)", href, re.IGNORECASE)
    if m:
        return m.group(1)
    return href


def _find_primary_doc_url(index_html: str) -> Optional[str]:
    """
    EDGAR filing index table columns: Seq | Description | Document (link) | Type | Size.
    We want the row whose Type cell (index 3) is exactly '10-Q'.
    """
    rows = re.findall(r"<tr\b[^>]*>(.*?)</tr>", index_html, re.DOTALL | re.IGNORECASE)
    for row in rows:
        cells = re.findall(r"<td\b[^>]*>(.*?)</td>", row, re.DOTALL | re.IGNORECASE)
        if len(cells) < 4:
            continue
        type_text = re.sub(r"<[^>]+>", "", cells[3]).strip()
        if type_text.upper() != "10-Q":
            continue
        # cells[2] holds the Document link
        link_m = re.search(r'href="([^"]+\.htm(?:l)?)"', cells[2], re.IGNORECASE)
        if link_m:
            path = _resolve_edgar_href(link_m.group(1))
            return EDGAR_BASE + path if path.startswith("/") else path
    # Fallback: first .htm link under /Archives in the whole page
    link_m = re.search(r'href="(/Archives/edgar/data/[^"]+\.htm(?:l)?)"', index_html, re.IGNORECASE)
    return EDGAR_BASE + link_m.group(1) if link_m else None


# ── Step 5: Extract financial bullet highlights ───────────────────────────────

# Patterns that indicate a sentence has real financial content
_FINANCIAL_PATTERN = re.compile(
    r"(\$\s*[\d,]+\.?\d*\s*(?:billion|million|B|M)?|"  # dollar amounts
    r"\d+\.?\d*\s*%|"                                    # percentages
    r"\d+\s*(?:basis points?|bps)|"                      # basis points
    r"(?:increased?|decreased?|grew|declined?|rose|fell|expanded?|compressed?|"
    r"improved?|worsened?|gained?|lost?)\s+(?:by\s+)?[\d\.]+)",  # directional + number
    re.IGNORECASE,
)

# Sections we WANT — ordered by priority
# "COMPARED TO" sub-heading inside Results of Operations is the narrative prose
_TARGET_SECTIONS = [
    re.compile(r"(?:first|second|third|fourth|q[1-4])\s+quarter.{0,60}compared\s+to", re.IGNORECASE),
    re.compile(r"fiscal\s+\d{4}\s+compared\s+to\s+(?:fiscal\s+)?\d{4}", re.IGNORECASE),
    re.compile(r"results?\s+of\s+operations?.{0,60}compared\s+to", re.IGNORECASE),
    re.compile(r"results?\s+of\s+operations?", re.IGNORECASE),
    re.compile(r"overview", re.IGNORECASE),
    re.compile(r"management.{0,30}discussion\s+and\s+analysis", re.IGNORECASE),
]

# Junk patterns — skip sentences matching these
_JUNK_RE = re.compile(
    r"us-gaap:|0000\d{6}|dei:|ifrs-full:|"
    r"item\s+\d|table\s+of\s+contents|forward[- ]looking|"
    r"incorporated\s+by\s+reference|"
    r"certif(?:y|ied|ication)|sarbanes|exchange\s+act|"
    r"pursuant\s+to|exhibit\s+\d|rule\s+\d+[a-z]",
    re.IGNORECASE,
)


def _clean_html(html_bytes: bytes) -> str:
    """Strip HTML/XBRL markup and return readable plain text."""
    text = html_bytes.decode("utf-8", errors="ignore")
    text = re.sub(r"<ix:header\b[^>]*>.*?</ix:header>", " ", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<ix:hidden\b[^>]*>.*?</ix:hidden>",  " ", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<head\b[^>]*>.*?</head>",             " ", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<(?:style|script)\b[^>]*>.*?</(?:style|script)>", " ", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&#\d+;|&[a-z]+;", " ", text)          # HTML entities
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{2,}", "\n", text)
    return text.strip()


def _find_section_text(plain: str, section_res: List[re.Pattern], window: int = 8000) -> str:
    """
    Find the first section heading that has genuine prose after it (not a TOC entry).
    Returns the text window after that heading, or "".
    """
    toc_re = re.compile(r"ITEM\s+[13456]|page\s+\d{1,3}\b|\d{1,3}\s+ITEM", re.IGNORECASE)
    for sec_re in section_res:
        for m in sec_re.finditer(plain):
            after = plain[m.end(): m.end() + 600]
            after_clean = re.sub(r"\s+", " ", after).strip()
            if len(after_clean) > 120 and not toc_re.search(after_clean[:250]):
                return plain[m.end(): m.end() + window]
    return ""


def _score_sentence(s: str) -> int:
    """Higher = more financially informative."""
    score = 0
    fin_hits = len(_FINANCIAL_PATTERN.findall(s))
    score += fin_hits * 10
    # Bonus for key topics
    for kw in ("revenue", "sales", "gross margin", "operating income", "net income",
                "earnings per share", "eps", "cash flow", "gross profit",
                "operating margin", "ebitda", "guidance", "outlook"):
        if kw in s.lower():
            score += 5
    return score


def _extract_highlights(html_bytes: bytes) -> List[str]:
    plain = _clean_html(html_bytes)

    # Try targeted sections first; fall back to broader body text
    section_text = _find_section_text(plain, _TARGET_SECTIONS)
    corpus = section_text if section_text else plain[3000:]

    sentences = re.split(r"(?<=[.!?])\s+", corpus)

    candidates: List[tuple] = []  # (score, text)
    for s in sentences:
        s = re.sub(r"\s+", " ", s).strip()
        if len(s) < 60 or len(s) > 500:
            continue
        if _JUNK_RE.search(s):
            continue
        if re.match(r"^[\d\s\.\-\$%,\(\)]+$", s):
            continue
        # Skip table-fragment sentences: multiple standalone $ amounts = table row
        dollar_hits = len(re.findall(r"\$\s*[\d,]+", s))
        if dollar_hits >= 3:
            continue
        # Skip if it looks like a financial table row (lots of bare numbers)
        bare_numbers = len(re.findall(r"(?<!\$)\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:%|million|billion)?\b", s))
        word_count = len(re.findall(r"[A-Za-z]{3,}", s))
        if bare_numbers >= 6 or word_count < 7:
            continue
        # Skip sentences that start with a line-item label + number pattern (table rows)
        if re.match(r"^[A-Z][A-Za-z ]{2,30}\s+\$?\s*[\d,]", s):
            continue
        score = _score_sentence(s)
        if score > 0:
            candidates.append((score, s))

    # Sort by score descending; keep top 5 but preserve original order for final output
    top = sorted(candidates, key=lambda x: -x[0])[:5]
    # Re-order by position in original sentence list
    top_texts = {t for _, t in top}
    ordered = [s for s in sentences
               if re.sub(r"\s+", " ", s).strip() in top_texts][:5]

    return ordered


# ── Public API ────────────────────────────────────────────────────────────────

def find_10q_filing(ticker: str, year: int, quarter: int) -> Dict:
    """
    Returns:
        filing_url, document_url, filing_date, period_of_report,
        company_name, highlights, error
    """
    if not REQUESTS_AVAILABLE:
        return {"error": "requests library not available"}

    # Step 1 — CIK
    try:
        cik10 = _get_cik(ticker)
    except Exception as exc:
        return {"error": f"CIK lookup failed: {exc}"}
    if not cik10:
        return {"error": f"Could not find CIK for ticker {ticker}"}

    # Step 2 — Find 10-Q
    try:
        filing_meta = _find_filing_in_submissions(cik10, year, quarter)
    except Exception as exc:
        return {"error": f"EDGAR submissions lookup failed: {exc}"}
    if not filing_meta:
        return {"error": f"No 10-Q found for {ticker} Q{quarter} {year} on EDGAR"}

    accession = filing_meta["accessionNumber"]
    filing_url = _filing_index_url(cik10, accession)

    result: Dict = {
        "filing_url": filing_url,
        "document_url": filing_url,
        "filing_date": filing_meta["filingDate"],
        "period_of_report": filing_meta["reportDate"],
        "company_name": ticker.upper(),
        "highlights": [],
        "error": None,
    }

    # Step 3 — Get primary document URL
    try:
        idx_r = _get(filing_url)
        idx_r.raise_for_status()
        # Also grab company name from index page
        name_m = re.search(r"<span[^>]*class=\"companyName\"[^>]*>([^<]+)", idx_r.text, re.IGNORECASE)
        if not name_m:
            name_m = re.search(r"<b>([A-Z][A-Za-z ,\.]+(?:Inc|Corp|Ltd|LLC|Co)\.?)</b>", idx_r.text)
        if name_m:
            result["company_name"] = re.sub(r"\s+", " ", name_m.group(1)).strip()
        doc_url = _find_primary_doc_url(idx_r.text)
        if doc_url:
            result["document_url"] = doc_url
    except Exception:
        return result

    # Step 4 — Extract MD&A highlights
    try:
        doc_r = _get(result["document_url"], stream=True, timeout=25)
        doc_r.raise_for_status()
        chunks: List[bytes] = []
        total = 0
        for chunk in doc_r.iter_content(chunk_size=8192):
            chunks.append(chunk)
            total += len(chunk)
            if total >= DOC_BYTE_LIMIT:
                break
        result["highlights"] = _extract_highlights(b"".join(chunks))
    except Exception:
        pass

    return result


# ── CLI test ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import json, sys
    ticker = sys.argv[1] if len(sys.argv) > 1 else "NKE"
    year = int(sys.argv[2]) if len(sys.argv) > 2 else 2025
    quarter = int(sys.argv[3]) if len(sys.argv) > 3 else 3
    print(json.dumps(find_10q_filing(ticker, year, quarter), indent=2))
