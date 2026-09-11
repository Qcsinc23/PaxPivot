"""TASK-038: the page-time parser reads the official stamp and nothing else."""

from datetime import datetime

from paxpivot.application.parsers.amc_page_time import PARSER_VERSION, parse_page_time


def test_reads_the_three_stamp_shapes_seen_on_official_pages() -> None:
    andrews = "<p>***Current as of 11 SEPTEMBER 2026 at 0350***</p>"
    mdl = "<p>*** Current as of 08 SEPTEMBER 2026&nbsp;at 0400L&nbsp;EST ***&nbsp;</p>"
    bwi = "<span>***Current as 11 SEP 2026 0830L***</span>"
    assert parse_page_time(andrews) is not None
    assert parse_page_time(andrews).local == datetime(2026, 9, 11, 3, 50)  # type: ignore[union-attr]
    assert parse_page_time(mdl).local == datetime(2026, 9, 8, 4, 0)  # type: ignore[union-attr]
    stamp = parse_page_time(bwi)
    assert stamp and stamp.local == datetime(2026, 9, 11, 8, 30) and stamp.has_time
    assert stamp.text == "Current as 11 SEP 2026 0830L"
    assert PARSER_VERSION == "amc-page-time-v1"


def test_a_bare_date_is_flagged_and_nothing_else_is_a_stamp() -> None:
    dated = parse_page_time("Current as of 3 Oct 2026")
    assert dated and dated.local == datetime(2026, 10, 3) and not dated.has_time
    assert parse_page_time("<p>No stamp here. Departures at 0600.</p>") is None
    assert parse_page_time("Current as of 31 FEB 2026 at 0100") is None  # impossible date
    assert parse_page_time("Current as of 11 Foo 2026") is None
    assert parse_page_time("Current as of 3 Junk 2026") is None  # a prefix is not a month
    assert parse_page_time("Current as of 11 SEP 3000 at 0000") is None  # implausible year
    # The first stamp decides: a mangled header never falls through to an older notice.
    assert parse_page_time("Current as of 11 SEP 2026 at 2430 ... Current as of 1 JAN 2020") is None
    # A trailing count is not a clock; "Sept." with a comma still reads.
    counted = parse_page_time("Current as of 11 SEP 2026 2100 pax")
    assert counted and not counted.has_time
    sept = parse_page_time("Current as of 11 Sept. 2026, at 0350")
    assert sept and sept.local == datetime(2026, 9, 11, 3, 50) and sept.has_time
    # A schedule row never matches.
    assert parse_page_time("<td>0600</td><td>RAMSTEIN</td>") is None
