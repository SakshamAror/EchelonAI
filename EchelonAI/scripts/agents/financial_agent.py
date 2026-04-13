"""
Financial agent for pulling key metrics via yfinance and FMP.
"""

from __future__ import annotations

import calendar
import json
from datetime import date, datetime
from typing import Any, Dict, List, Optional

import yfinance as yf
from dotenv import load_dotenv


def _month_start(year: int, month: int) -> date:
    return date(year, month, 1)


def _safe_get(info: Dict[str, Any], key: str) -> Optional[float]:
    val = info.get(key)
    if val is None:
        return None
    try:
        return float(val)
    except Exception:
        return None


def _is_nan(val: Any) -> bool:
    try:
        return isinstance(val, float) and val != val
    except Exception:
        return False


def _sanitize_value(val: Any) -> Any:
    if _is_nan(val):
        return None
    return val


def _drop_null_fields(data: Dict[str, Any]) -> Dict[str, Any]:
    cleaned = {}
    for k, v in data.items():
        v = _sanitize_value(v)
        if v is not None:
            cleaned[k] = v
    return cleaned


def _dividend_change(ticker: yf.Ticker, cutoff: date) -> Optional[float]:
    try:
        divs = ticker.dividends
    except Exception:
        return None

    if divs is None or getattr(divs, "empty", False):
        return None

    try:
        series = divs[divs.index.date < cutoff]
        if series is None or len(series) < 2:
            return None
        last = float(series.iloc[-1])
        prev = float(series.iloc[-2])
        return last - prev
    except Exception:
        return None


def _latest_cashflow_value(df: Any, labels: List[str]) -> Optional[float]:
    try:
        if df is None or getattr(df, "empty", False):
            return None
        for label in labels:
            if label in df.index:
                series = df.loc[label]
                if hasattr(series, "iloc") and len(series) > 0:
                    return float(series.iloc[0])
    except Exception:
        return None
    return None


def _nearest_period_row(df: Any, target: date) -> Optional[Dict[str, Any]]:
    try:
        if df is None or getattr(df, "empty", False):
            return None
        cols = list(df.columns)
        if not cols:
            return None
        best_col = None
        best_diff = None
        for c in cols:
            try:
                d = c.date()
            except Exception:
                continue
            diff = abs((d - target).days)
            if best_diff is None or diff < best_diff:
                best_diff = diff
                best_col = c
        if best_col is None:
            return None
        series = df[best_col]
        return series.to_dict() if hasattr(series, "to_dict") else None
    except Exception:
        return None


def _column_date(col: Any) -> Optional[date]:
    try:
        if hasattr(col, "date"):
            return col.date()
        if isinstance(col, date):
            return col
        if isinstance(col, str):
            return datetime.strptime(col, "%Y-%m-%d").date()
    except Exception:
        return None
    return None


def _series_to_dict(df: Any, col: Any) -> Optional[Dict[str, Any]]:
    try:
        if df is None or getattr(df, "empty", False) or col is None:
            return None
        series = df[col]
        if not hasattr(series, "to_dict"):
            return None
        raw = series.to_dict()
        return {k: _sanitize_value(v) for k, v in raw.items()}
    except Exception:
        return None


def _select_year_columns(df: Any, year: int) -> List[Any]:
    try:
        if df is None or getattr(df, "empty", False):
            return []
        cols = list(df.columns)
        selected = []
        for c in cols:
            d = _column_date(c)
            if d and d.year == year:
                selected.append(c)
        return selected
    except Exception:
        return []


def _average_year_metrics(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not rows:
        return {}
    sums: Dict[str, float] = {}
    counts: Dict[str, int] = {}
    for row in rows:
        for k, v in row.items():
            if v is None:
                continue
            try:
                fv = float(v)
            except Exception:
                continue
            sums[k] = sums.get(k, 0.0) + fv
            counts[k] = counts.get(k, 0) + 1
    avg = {k: (sums[k] / counts[k]) for k in sums if counts[k] > 0}
    return _drop_null_fields(avg)


def _get_quarterly_df(ticker: yf.Ticker, stmt: str) -> Any:
    """
    Best-effort quarterly statement fetch with fallbacks across yfinance APIs.
    stmt: 'income', 'cashflow', 'balance'
    """
    try:
        if stmt == "income":
            df = ticker.quarterly_financials
            if df is not None and not getattr(df, "empty", False):
                return df
            if hasattr(ticker, "get_income_stmt"):
                return ticker.get_income_stmt(freq="quarterly")
        elif stmt == "cashflow":
            df = ticker.quarterly_cashflow
            if df is not None and not getattr(df, "empty", False):
                return df
            if hasattr(ticker, "get_cash_flow"):
                return ticker.get_cash_flow(freq="quarterly")
        elif stmt == "balance":
            df = ticker.quarterly_balance_sheet
            if df is not None and not getattr(df, "empty", False):
                return df
            if hasattr(ticker, "get_balance_sheet"):
                return ticker.get_balance_sheet(freq="quarterly")
    except Exception:
        return None
    return None


def _build_quarter_metrics(
    income: Optional[Dict[str, Any]],
    cashflow: Optional[Dict[str, Any]],
    balance: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    metrics: Dict[str, Any] = {}
    if income:
        metrics["totalRevenue"] = income.get("Total Revenue")
        metrics["grossProfit"] = income.get("Gross Profit")
        metrics["operatingIncome"] = income.get("Operating Income")
        metrics["netIncome"] = income.get("Net Income")
        revenue = income.get("Total Revenue")
        if revenue:
            if income.get("Gross Profit") is not None:
                metrics["grossMargin"] = income.get("Gross Profit") / revenue
            if income.get("Operating Income") is not None:
                metrics["operatingMargin"] = income.get("Operating Income") / revenue
            if income.get("Net Income") is not None:
                metrics["profitMargin"] = income.get("Net Income") / revenue

    if cashflow:
        metrics["operatingCashflow"] = cashflow.get("Operating Cash Flow")
        metrics["capitalExpenditures"] = cashflow.get("Capital Expenditure")
        metrics["freeCashflow"] = cashflow.get("Free Cash Flow")
        if (
            metrics.get("operatingCashflow") is not None
            and metrics.get("capitalExpenditures") is not None
        ):
            metrics["fcf_change"] = (
                metrics["operatingCashflow"] - metrics["capitalExpenditures"]
            )

    if balance:
        metrics["totalAssets"] = balance.get("Total Assets")
        metrics["totalEquity"] = balance.get("Total Stockholder Equity")
        metrics["totalDebt"] = balance.get("Total Debt") or balance.get("Long Term Debt")
        metrics["totalCash"] = balance.get("Cash And Cash Equivalents")
        metrics["currentAssets"] = balance.get("Total Current Assets")
        metrics["currentLiabilities"] = balance.get("Total Current Liabilities")
        metrics["inventory"] = balance.get("Inventory")

        if metrics.get("totalAssets") and metrics.get("netIncome") is not None:
            metrics["returnOnAssets"] = metrics["netIncome"] / metrics["totalAssets"]
        if metrics.get("totalEquity") and metrics.get("netIncome") is not None:
            metrics["returnOnEquity"] = metrics["netIncome"] / metrics["totalEquity"]
        if metrics.get("totalEquity") and metrics.get("totalDebt") is not None:
            metrics["debtToEquity"] = metrics["totalDebt"] / metrics["totalEquity"]
        if metrics.get("currentAssets") and metrics.get("currentLiabilities"):
            metrics["currentRatio"] = (
                metrics["currentAssets"] / metrics["currentLiabilities"]
            )
            quick_assets = metrics["currentAssets"] - (metrics.get("inventory") or 0)
            metrics["quickRatio"] = quick_assets / metrics["currentLiabilities"]

    return _drop_null_fields(metrics)


def _closest_col(df: Any, t: date) -> Optional[Any]:
    if df is None or getattr(df, "empty", False):
        return None
    cols = [c for c in df.columns if _column_date(c)]
    if not cols:
        return None
    return min(cols, key=lambda c: abs((_column_date(c) - t).days))


def get_quarterly_metrics(
    ticker: str, year: int, month: int
) -> Dict[str, Any]:
    load_dotenv()
    if not ticker or not isinstance(ticker, str):
        return {"error": "ticker must be a non-empty string"}
    try:
        yf_ticker = yf.Ticker(ticker)
        _ = yf_ticker.info
    except Exception:
        return {"error": f"ticker not found: {ticker}"}

    target = _month_start(year, month)

    income_df = _get_quarterly_df(yf_ticker, "income")
    cash_df = _get_quarterly_df(yf_ticker, "cashflow")
    bal_df = _get_quarterly_df(yf_ticker, "balance")

    income_col = _closest_col(income_df, target)
    cash_col = _closest_col(cash_df, target)
    bal_col = _closest_col(bal_df, target)

    income = _series_to_dict(income_df, income_col)
    cash = _series_to_dict(cash_df, cash_col)
    bal = _series_to_dict(bal_df, bal_col)

    period = ""
    for col in (income_col, cash_col, bal_col):
        if col is not None:
            d = _column_date(col)
            if d:
                period = d.isoformat()
                break

    return {
        "ticker": ticker,
        "period": period,
        "metrics": _build_quarter_metrics(income, cash, bal),
    }


def get_financial_metrics(ticker: str, year: int, month: int) -> Dict[str, Any]:
    load_dotenv()

    if not ticker or not isinstance(ticker, str):
        return {"error": "ticker must be a non-empty string"}

    try:
        yf_ticker = yf.Ticker(ticker)
        info = yf_ticker.info
    except Exception:
        return {"error": f"ticker not found: {ticker}"}

    if not info:
        return {"error": f"ticker not found: {ticker}"}

    start = _month_start(year, month)

    metrics: Dict[str, Any] = {
        "trailingPE": _safe_get(info, "trailingPE"),
        "forwardPE": _safe_get(info, "forwardPE"),
        "pegRatio": _safe_get(info, "pegRatio"),
        "freeCashflow": None,
        "operatingCashflow": None,
        "capitalExpenditures": None,
        "totalRevenue": None,
        "dividendRate": _safe_get(info, "dividendRate"),
        "dividendYield": _safe_get(info, "dividendYield"),
        "priceToBook": _safe_get(info, "priceToBook"),
        "enterpriseToEbitda": _safe_get(info, "enterpriseToEbitda"),
        "returnOnEquity": None,
        "debtToEquity": None,
        "marketCap": _safe_get(info, "marketCap"),
        "totalCash": None,
        "totalDebt": None,
        "currentRatio": None,
        "quickRatio": None,
        "profitMargins": None,
        "grossMargins": None,
        "operatingMargins": None,
        "ebitdaMargins": _safe_get(info, "ebitdaMargins"),
        "revenueGrowth": None,
        "earningsGrowth": None,
        "returnOnAssets": None,
        "payoutRatio": _safe_get(info, "payoutRatio"),
        "beta": _safe_get(info, "beta"),
    }

    # Fallbacks from cashflow statement if missing
    # Use quarterly statements closest to target month
    income_q = _nearest_period_row(yf_ticker.quarterly_financials, start)
    cashflow_q = _nearest_period_row(yf_ticker.quarterly_cashflow, start)
    balance_q = _nearest_period_row(yf_ticker.quarterly_balance_sheet, start)

    if income_q:
        metrics["totalRevenue"] = _sanitize_value(income_q.get("Total Revenue"))
        revenue = _sanitize_value(income_q.get("Total Revenue"))
        gross_profit = _sanitize_value(income_q.get("Gross Profit"))
        operating_income = _sanitize_value(income_q.get("Operating Income"))
        net_income = _sanitize_value(income_q.get("Net Income"))
        if revenue:
            if gross_profit is not None:
                metrics["grossMargins"] = gross_profit / revenue
            if operating_income is not None:
                metrics["operatingMargins"] = operating_income / revenue
            if net_income is not None:
                metrics["profitMargins"] = net_income / revenue

    if cashflow_q:
        metrics["operatingCashflow"] = _sanitize_value(cashflow_q.get("Operating Cash Flow"))
        metrics["capitalExpenditures"] = _sanitize_value(cashflow_q.get("Capital Expenditure"))
        metrics["freeCashflow"] = _sanitize_value(cashflow_q.get("Free Cash Flow"))

    if balance_q:
        total_assets = _sanitize_value(balance_q.get("Total Assets"))
        total_equity = _sanitize_value(balance_q.get("Total Stockholder Equity"))
        total_debt = _sanitize_value(balance_q.get("Total Debt")) or _sanitize_value(
            balance_q.get("Long Term Debt")
        )
        total_cash = _sanitize_value(balance_q.get("Cash And Cash Equivalents"))
        current_assets = _sanitize_value(balance_q.get("Total Current Assets"))
        current_liab = _sanitize_value(balance_q.get("Total Current Liabilities"))
        inventory = _sanitize_value(balance_q.get("Inventory"))
        net_income = None
        if income_q:
            net_income = income_q.get("Net Income")

        metrics["totalCash"] = total_cash
        metrics["totalDebt"] = total_debt
        if total_assets and net_income is not None:
            metrics["returnOnAssets"] = net_income / total_assets
        if total_equity and net_income is not None:
            metrics["returnOnEquity"] = net_income / total_equity
        if total_equity and total_debt is not None:
            metrics["debtToEquity"] = total_debt / total_equity
        if current_assets and current_liab:
            metrics["currentRatio"] = current_assets / current_liab
            quick_assets = current_assets - (inventory or 0)
            metrics["quickRatio"] = quick_assets / current_liab

    if metrics["operatingCashflow"] is not None and metrics["capitalExpenditures"] is not None:
        metrics["fcf_change"] = metrics["operatingCashflow"] - metrics["capitalExpenditures"]
    else:
        metrics["fcf_change"] = None

    metrics["dividend_change"] = _dividend_change(yf_ticker, start)

    # FMP removed per request; yfinance-only metrics.

    return _drop_null_fields(metrics)


def format_financials_for_llm(metrics: Dict[str, Any]) -> str:
    lines: List[str] = []
    if not metrics:
        return ""
    if "error" in metrics:
        return f"error: {metrics['error']}"

    ordered_keys = [
        "trailingPE",
        "forwardPE",
        "pegRatio",
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

    for key in ordered_keys:
        if key in metrics:
            lines.append(f"{key}: {metrics[key]}")

    return "\n".join(lines)


def format_quarter_comparison(result: Dict[str, Any]) -> str:
    if not result or "error" in result:
        return f"error: {result.get('error', 'unknown error')}"
    metrics = result.get("metrics", {})
    lines: List[str] = []
    lines.append(f"ticker: {result.get('ticker','')}")
    lines.append(f"period: {result.get('period','')}")
    for k in sorted(metrics.keys()):
        lines.append(f"{k}: {metrics[k]}")
    return "\n".join(lines)


def save_financials_to_json(
    metrics: Dict[str, Any], output_path: str = "financial_metrics.json"
) -> str:
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)
    return output_path


if __name__ == "__main__":
    test_ticker = "AAPL"
    test_year = 2024
    test_month = 8
    data = get_financial_metrics(test_ticker, test_year, test_month)
    output_file = save_financials_to_json(data)
    print(data)
    print(f"Saved to: {output_file}")
    print(format_financials_for_llm(data))

    quarter = get_quarterly_metrics(test_ticker, test_year, test_month)
    print(format_quarter_comparison(quarter))
