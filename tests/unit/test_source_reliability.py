"""The pilot's source-health gate computed over synthetic check histories (TASK-042)."""

from collections.abc import Collection
from datetime import datetime, timedelta

from paxpivot.application.source_reliability import Verdict, reliability
from paxpivot.domain.source import RetrievalState, SourceObservation, SourceState
from support_sources import NOW, SOURCE_A, observation

CADENCE = 360
SIX_HOURS = timedelta(hours=6)
START = NOW - timedelta(days=30)


def checks(
    first: datetime,
    *,
    skip: Collection[int] = (),
    failed: Collection[int] = (),
    change_every: int = 4,
) -> list[SourceObservation]:
    """A 6-hourly check history from ``first`` through NOW.

    Run ``i`` never happened when ``i`` is in ``skip`` and failed to read when it is in ``failed``;
    the page's content hash changes every ``change_every`` runs.
    """
    history = []
    for i in range(int((NOW - first) / SIX_HOURS) + 1):
        if i in skip:
            continue
        ok = i not in failed
        history.append(
            observation(
                SOURCE_A,
                f"check-{first.isoformat()}-{i}",
                state=SourceState.FRESH if ok else SourceState.UNREACHABLE,
                observed_at=first + i * SIX_HOURS,
                retrieval=RetrievalState.SUCCEEDED if ok else RetrievalState.FAILED,
                content_hash=f"hash-{i // change_every}",
            )
        )
    return history


def test_a_complete_history_passes_the_gate() -> None:
    result = reliability(checks(START - SIX_HOURS), CADENCE, START, NOW)
    assert result.verdict == Verdict.PASS
    assert not result.clipped and result.start == START
    assert result.expected == 120 and result.recorded == 121 and result.successful == 121
    assert result.completion == 100.0
    assert result.longest_gap == SIX_HOURS and result.gaps_over_window == 0
    assert result.changes == 30 and result.detection_p95 == SIX_HOURS


def test_one_missed_run_is_counted_but_does_not_fail_the_gate() -> None:
    result = reliability(checks(START - SIX_HOURS, skip={61}), CADENCE, START, NOW)
    assert result.longest_gap == timedelta(hours=12) and result.gaps_over_window == 1
    assert result.verdict == Verdict.PASS


def test_a_gap_beyond_policy_by_more_than_twelve_hours_stops_the_source() -> None:
    result = reliability(checks(START - SIX_HOURS, skip={60, 61, 62}), CADENCE, START, NOW)
    assert result.longest_gap == timedelta(hours=24)
    assert result.completion is not None and result.completion >= 95
    assert result.verdict == Verdict.STOP


def test_failed_reads_are_recorded_but_not_successful_and_low_completion_stops() -> None:
    failed = set(range(1, 121, 7))  # 18 of 121 runs fail, never two in a row
    result = reliability(checks(START - SIX_HOURS, failed=failed), CADENCE, START, NOW)
    assert result.recorded == 121 and result.successful == 121 - len(failed)
    assert result.completion is not None and result.completion < 90
    assert result.longest_gap == timedelta(hours=12)
    assert result.verdict == Verdict.STOP


def test_slow_change_detection_keeps_a_source_from_passing() -> None:
    # Ten changes, one of them only seen 12 h late: the nearest-rank p95 is that slow one.
    result = reliability(checks(START - SIX_HOURS, skip={60}, change_every=12), CADENCE, START, NOW)
    assert result.changes == 10 and result.detection_p95 == timedelta(hours=12)
    assert result.verdict == Verdict.WATCH


def test_a_newly_registered_source_is_measured_from_its_first_check_and_cannot_pass() -> None:
    first = NOW - timedelta(days=3)
    result = reliability(checks(first), CADENCE, START, NOW)
    assert result.clipped and result.start == first
    assert result.expected == 12 and result.completion == 100.0
    assert result.verdict == Verdict.WATCH


def test_nothing_to_measure_is_unknown_not_an_outage() -> None:
    assert reliability([], CADENCE, START, NOW).verdict == Verdict.UNKNOWN
    no_cadence = reliability(checks(START - SIX_HOURS), None, START, NOW)
    assert no_cadence.verdict == Verdict.UNKNOWN and no_cadence.completion is None


def test_a_source_observed_before_the_window_but_silent_in_it_stops() -> None:
    silent = checks(START - timedelta(days=2))[:4]  # four reads, all before the window
    result = reliability(silent, CADENCE, START, NOW)
    assert result.recorded == 0 and result.successful == 0 and result.completion == 0.0
    assert result.longest_gap == NOW - START
    assert result.verdict == Verdict.STOP
