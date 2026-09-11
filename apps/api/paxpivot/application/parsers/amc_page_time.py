"""AMC terminal-page time stamp parser (TASK-038; PRD §9.2, pilot SRC-008).

The official terminal pages print when their schedule was last updated, e.g.
``Current as of 11 SEPTEMBER 2026 at 0350`` or ``Current as 11 SEP 2026 0830L``. This parser
reads only that stamp, deterministically, and never anything about departures. It is pure
and versioned; a page with no recognisable stamp yields ``None``, never a guess.
"""

import html
import re
from dataclasses import dataclass
from datetime import datetime

PARSER_VERSION = "amc-page-time-v1"

_TAGS = re.compile(r"<[^>]+>")
_STAMP = re.compile(
    r"current\s+as\s+(?:of\s+)?(\d{1,2})\s+([a-z]{3,9})\.?,?\s+(\d{4})"
    r"(?:\s*(?:at\s+)?(\d{2})(\d{2})\s*l?)?",
    re.IGNORECASE,
)
_MONTHS = {m: i for i, m in enumerate("jan feb mar apr may jun jul aug sep oct nov dec".split(), 1)}


@dataclass(frozen=True)
class PageTime:
    """The page's own stamp in the terminal's local clock; ``has_time`` is False for a bare date."""

    local: datetime
    has_time: bool
    text: str  # The matched stamp, page wording, for provenance and labeling.


def parse_page_time(document: str) -> PageTime | None:
    text = html.unescape(_TAGS.sub(" ", document))
    text = re.sub(r"\s+", " ", text)
    for match in _STAMP.finditer(text):
        day, month, year, hour, minute = match.groups()
        month_number = _MONTHS.get(month[:3].lower())
        if month_number is None:
            continue
        try:
            local = datetime(int(year), month_number, int(day), int(hour or 0), int(minute or 0))
        except ValueError:
            continue  # An impossible date is not a stamp.
        return PageTime(local=local, has_time=hour is not None, text=match.group(0).strip())
    return None
