"""Display formatting shared by the facts sent to the LLM (docs/04-metrics.md, "Display").

Facts are sent to the model already formatted, so it can quote numbers without computing them.
"""

from datetime import date

MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def compact(value: float | None) -> str:
    if value is None:
        return "n/a"
    for threshold, suffix in ((1_000_000_000, "B"), (1_000_000, "M"), (1_000, "K")):
        if abs(value) >= threshold:
            return f"{value / threshold:.1f}{suffix}"
    return f"{value:,.0f}"


def percent(ratio: float | None) -> str:
    return "n/a" if ratio is None else f"{ratio * 100:.1f}%"


def signed_percent(ratio: float | None) -> str:
    return "n/a" if ratio is None else f"{ratio * 100:+.1f}%"


def month_label(month: str | date | None) -> str:
    if month is None:
        return "n/a"
    text = month.strftime("%Y-%m") if isinstance(month, date) else month
    year, number = text.split("-")[:2]
    return f"{MONTH_NAMES[int(number) - 1]} {year}"


def month_key(month: date | None) -> str | None:
    return None if month is None else month.strftime("%Y-%m")
