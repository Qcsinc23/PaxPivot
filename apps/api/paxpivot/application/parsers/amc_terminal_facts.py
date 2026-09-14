"""AMC terminal-page operating-facts parser (TASK-048; PRD §9.2, pilot TML-006).

The official terminal pages are rendered by one shared content-management template: a
predictable "Contact Information" block (terminal name and street address, then labelled phone
numbers under a "Service Counter" heading, an "Email:"/"E-Mail:" label, and an
"Hours of operation:" label) plus free-text "Local Travel Information" content that varies per
terminal (a USO section, a parking notice, an access/payment note). This parser reads only those
static-ish operating facts, deterministically, and never a departure row, a roll-call time or a
check-in window — those change every few hours with the flight schedule and are not a stable
operating fact. A page that does not carry a given kind of fact yields nothing for that kind; a
page whose labelled content does not match the expected shape yields nothing at all, never a
guess. It is pure and versioned, modelled on ``amc_page_time.py``.
"""

import html
import re
from dataclasses import dataclass

from paxpivot.domain.terminal import TerminalFactKind

PARSER_VERSION = "amc-terminal-facts-v1"

# A "short text span", well under FactText's 2000-character ceiling (domain/terminal.py): long
# enough for real contact/parking/USO wording, short enough that a mis-anchored match cannot
# quietly swallow an unrelated paragraph.
MAX_FACT_LENGTH = 500

_MAX_ADDRESS_LINES = 4
_MAX_USO_LINES = 4

_BLOCK_BREAK = re.compile(r"</?(?:p|div|br|li|h[1-6]|tr|td|table|ul|ol)\b[^>]*>", re.IGNORECASE)
_TAG = re.compile(r"<[^>]+>")

# Known template headings/labels used only to bound an open-ended collection (e.g. USO
# information) so it never bleeds into the next module's unrelated content. These are the
# page's own navigation/section labels, not quoted body text.
_KNOWN_HEADING = re.compile(
    r"^(quick links|contact information|local travel information|flight delays|"
    r"welcome to|uso information|frequently asked questions)\b",
    re.IGNORECASE,
)
_CONTACT_HEADING = re.compile(r"^contact information$", re.IGNORECASE)
_ADDRESS_STOP = re.compile(
    r"^(service counter|lost\s*&\s*found|\d+\s*hour\b|e-?mail:?|hours? of operation:?)",
    re.IGNORECASE,
)
_SERVICE_COUNTER = re.compile(r"^service counter$", re.IGNORECASE)
_PHONE_LINE = re.compile(r"^(comm|dsn|fax|commercial)\b", re.IGNORECASE)
_EMAIL_LABEL = re.compile(r"^e-?mail:?\s*(.*)$", re.IGNORECASE)
_EMAIL_TOKEN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
# The colon is mandatory and the captured content must start with a non-space character: an
# optional colon here would let the regex engine backtrack into treating a bare trailing colon
# as "content" when nothing follows it (e.g. a label with nothing after it at all).
_HOURS_LABEL = re.compile(r"^hours? of operation\s*:\s*(\S.*)$", re.IGNORECASE)
_USO_HEADING = re.compile(r"^uso information$", re.IGNORECASE)
_CARD_ONLY = re.compile(r"\bcard[- ]only\b", re.IGNORECASE)
_PARKING_WORD = re.compile(r"\bparking\b", re.IGNORECASE)


@dataclass(frozen=True)
class ParsedFact:
    """One candidate operating fact: an already-bounded, verbatim span. Never invented."""

    kind: TerminalFactKind
    value: str


def _lines(document: str) -> list[str]:
    """The page as short, block-bounded lines: a ``<br>``/``<p>``/heading/list item each end one.

    Flattening the whole document into one string first, the way ``amc_page_time`` does to find
    a single stamp, would merge a fact's value into the next paragraph or module once inline tags
    are stripped. Splitting on block-level tags before stripping inline ones keeps each label
    beside only its own value. The document's own whitespace (including any line breaks the
    source happens to contain purely for human readability, unrelated to any tag) is collapsed
    away *before* inserting line breaks, so only an actual block-level boundary ever starts a
    new line here — never an incidental newline inside one inline run of text.
    """
    collapsed = re.sub(r"\s+", " ", document)
    marked = _BLOCK_BREAK.sub("\n", collapsed)
    stripped = _TAG.sub(" ", marked)
    text = html.unescape(stripped)
    out: list[str] = []
    for raw_line in text.split("\n"):
        line = re.sub(r"\s+", " ", raw_line).strip()
        if line:
            out.append(line)
    return out


def _bounded(value: str) -> str | None:
    value = value.strip()
    if not value or len(value) > MAX_FACT_LENGTH:
        return None
    return value


def _parse_address(lines: list[str]) -> ParsedFact | None:
    for i, line in enumerate(lines):
        if not _CONTACT_HEADING.match(line):
            continue
        collected: list[str] = []
        for candidate in lines[i + 1 : i + 1 + _MAX_ADDRESS_LINES]:
            if _ADDRESS_STOP.match(candidate) or _KNOWN_HEADING.match(candidate):
                break
            collected.append(candidate)
        if not collected:
            return None
        value = _bounded(", ".join(collected))
        return ParsedFact(TerminalFactKind.PASSENGER_TERMINAL_NOTE, value) if value else None
    return None


def _parse_phone(lines: list[str]) -> ParsedFact | None:
    for i, line in enumerate(lines):
        if not _SERVICE_COUNTER.match(line):
            continue
        collected = []
        for candidate in lines[i + 1 :]:
            if not _PHONE_LINE.match(candidate):
                break
            collected.append(candidate)
        if not collected:
            return None
        value = _bounded("; ".join(collected))
        return ParsedFact(TerminalFactKind.PHONE, value) if value else None
    return None


def _parse_email(lines: list[str]) -> ParsedFact | None:
    for i, line in enumerate(lines):
        m = _EMAIL_LABEL.match(line)
        if not m:
            continue
        candidates = [m.group(1)] if m.group(1) else []
        candidates += lines[i + 1 : i + 3]
        for candidate in candidates:
            token = candidate.strip()
            if _EMAIL_TOKEN.match(token):
                value = _bounded(token)
                return ParsedFact(TerminalFactKind.EMAIL, value) if value else None
        return None  # The label was found with no recognisable address nearby: ambiguous.
    return None


def _parse_hours(lines: list[str]) -> ParsedFact | None:
    for line in lines:
        m = _HOURS_LABEL.match(line)
        if m:
            value = _bounded(m.group(1))
            return ParsedFact(TerminalFactKind.COUNTER_HOURS, value) if value else None
    return None


def _parse_uso(lines: list[str]) -> ParsedFact | None:
    for i, line in enumerate(lines):
        if not _USO_HEADING.match(line):
            continue
        collected = []
        for candidate in lines[i + 1 : i + 1 + _MAX_USO_LINES]:
            if _KNOWN_HEADING.match(candidate):
                break
            collected.append(candidate)
        if not collected:
            return None
        value = _bounded(" ".join(collected))
        return ParsedFact(TerminalFactKind.USO_AVAILABILITY, value) if value else None
    return None


def _parse_parking(lines: list[str]) -> ParsedFact | None:
    """The page's first contiguous run of lines mentioning "parking" decides.

    A later, unrelated mention (e.g. a different section) is not appended to it — the same
    "first on the page decides" discipline ``amc_page_time`` uses for its stamp.
    """
    run: list[str] = []
    for line in lines:
        if _PARKING_WORD.search(line):
            run.append(line)
            continue
        if run:
            break
    if not run:
        return None
    value = _bounded(" ".join(run))
    while value is None and len(run) > 1:
        run = run[:-1]
        value = _bounded(" ".join(run))
    return ParsedFact(TerminalFactKind.PARKING, value) if value else None


def _parse_access_note(lines: list[str]) -> ParsedFact | None:
    for line in lines:
        if _CARD_ONLY.search(line):
            value = _bounded(line)
            return ParsedFact(TerminalFactKind.ACCESS_NOTE, value) if value else None
    return None


_EXTRACTORS = (
    _parse_address,
    _parse_phone,
    _parse_email,
    _parse_hours,
    _parse_uso,
    _parse_parking,
    _parse_access_note,
)


def parse_terminal_facts(document: str) -> list[ParsedFact]:
    """Every operating fact this page's own wording supports; an unsupported kind yields nothing.

    Pure and deterministic like ``parse_page_time``: no invented values, no departures, no
    roll-call/check-in timing (schedule content, not a stable operating fact).
    """
    lines = _lines(document)
    return [fact for extractor in _EXTRACTORS if (fact := extractor(lines)) is not None]
