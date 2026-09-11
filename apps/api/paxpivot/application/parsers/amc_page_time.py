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
_MONTH_NAMES = (
    "january february march april may june july august september october november december"
).split()
# Full names, three-letter forms, and "sept"; nothing else ("Junk" is not June).
_MONTHS = {m: i for i, m in enumerate(_MONTH_NAMES, 1)}
_MONTHS.update({m[:3]: i for i, m in enumerate(_MONTH_NAMES, 1)})
_MONTHS["sept"] = 9
_MONTH_TOKEN = "|".join(sorted(_MONTHS, key=len, reverse=True))
# The time needs the page's own "at" or trailing "L" so a following count is never read as a
# clock; a comma or period after the month or year is tolerated.
_STAMP = re.compile(
    rf"current\s+as\s+(?:of\s+)?(\d{{1,2}})\s+({_MONTH_TOKEN})\.?,?\s+(\d{{4}}),?"
    rf"(?:\s*(?:at\s+(\d{{2}})(\d{{2}})\s*l?|(\d{{2}})(\d{{2}})\s*l))?\b",
    re.IGNORECASE,
)
_YEAR_MIN, _YEAR_MAX = 2020, 2100


@dataclass(frozen=True)
class PageTime:
    """The page's own stamp in the terminal's local clock; ``has_time`` is False for a bare date."""

    local: datetime
    has_time: bool
    text: str  # The matched stamp, page wording, for provenance and labeling.


def parse_page_time(document: str) -> PageTime | None:
    text = html.unescape(_TAGS.sub(" ", document))
    text = re.sub(r"\s+", " ", text)
    # The first stamp on the page is the schedule's header; a mangled one means the template
    # changed, and searching further would only find older notices, so it decides alone.
    match = _STAMP.search(text)
    if match is None:
        return None
    day, month, year, hour_at, minute_at, hour_l, minute_l = match.groups()
    hour, minute = (hour_at, minute_at) if hour_at is not None else (hour_l, minute_l)
    if not _YEAR_MIN <= int(year) <= _YEAR_MAX:
        return None
    try:
        local = datetime(
            int(year), _MONTHS[month.lower()], int(day), int(hour or 0), int(minute or 0)
        )
    except ValueError:
        return None  # An impossible date or time is not a stamp.
    return PageTime(local=local, has_time=hour is not None, text=match.group(0).strip())
