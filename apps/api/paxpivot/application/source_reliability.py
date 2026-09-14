"""Source reliability over a window: the pilot's source-health gate, computed (TASK-042).

The pilot baseline's gate (paxpivot.md, source health): a source passes with at least 95 % of
scheduled checks completed and p95 material-change detection within 6.5 hours; below 90 %, or a
gap beyond policy by more than 12 hours, stops automatic use of that source. Everything here is
a pure function over observations that already exist: nothing is fetched or written.

Limits, stated rather than hidden: expected checks assume the scheduler runs at the source's
registered cadence (true today: one host cron every 6 hours), and detection is an upper bound —
a change is only known to have happened somewhere between two successful reads.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum
from itertools import pairwise
from math import ceil

from paxpivot.application.read_services import FRESHNESS_WINDOW
from paxpivot.domain.source import RetrievalState, SourceObservation

PASS_COMPLETION = 95.0
STOP_COMPLETION = 90.0
STOP_GAP = FRESHNESS_WINDOW + timedelta(hours=12)


class Verdict(StrEnum):
    PASS = "pass"
    WATCH = "watch"  # no gate failed, but not every pass condition holds (incl. a short window)
    STOP = "stop"
    UNKNOWN = "unknown"  # no cadence or never observed: nothing to measure against


@dataclass(frozen=True)
class SourceReliability:
    start: datetime  # the start actually measured: clipped to a source's first observation
    clipped: bool
    expected: int
    recorded: int
    successful: int
    completion: float | None  # percent of expected checks that read the source
    longest_gap: timedelta | None  # between successful reads, window edges included
    gaps_over_window: int
    changes: int
    detection_p95: timedelta | None
    verdict: Verdict


def reliability(
    observations: Sequence[SourceObservation],
    cadence_minutes: int | None,
    start: datetime,
    now: datetime,
) -> SourceReliability:
    """Measure one source's observations over ``[start, now]``.

    A source first observed inside the window is measured from that first observation and can
    at best WATCH, so a newly registered source is neither reported as an outage nor passed on a
    window shorter than the one asked for.
    """
    history = sorted(observations, key=lambda o: o.provenance.observed_at)
    inside = [o for o in history if start <= o.provenance.observed_at <= now]
    clipped = bool(inside) and history[0].provenance.observed_at >= start
    begin = inside[0].provenance.observed_at if clipped else start
    reads = [o for o in inside if o.retrieval == RetrievalState.SUCCEEDED]

    if cadence_minutes is None or not history:
        return SourceReliability(
            start=begin,
            clipped=clipped,
            expected=0,
            recorded=len(inside),
            successful=len(reads),
            completion=None,
            longest_gap=None,
            gaps_over_window=0,
            changes=0,
            detection_p95=None,
            verdict=Verdict.UNKNOWN,
        )

    expected = int((now - begin) / timedelta(minutes=cadence_minutes))
    completion = min(100.0, 100 * len(reads) / expected) if expected else None
    gaps = [
        later - earlier
        for earlier, later in pairwise([begin, *(o.provenance.observed_at for o in reads), now])
    ]
    latencies = sorted(
        later.provenance.observed_at - earlier.provenance.observed_at
        for earlier, later in pairwise(reads)
        if earlier.content_hash
        and later.content_hash
        and earlier.content_hash != later.content_hash
    )
    # Nearest-rank percentile: with fewer than 20 changes this is the slowest one.
    p95 = latencies[ceil(0.95 * len(latencies)) - 1] if latencies else None
    longest = max(gaps)

    if (completion is not None and completion < STOP_COMPLETION) or longest > STOP_GAP:
        verdict = Verdict.STOP
    elif (
        not clipped
        and completion is not None
        and completion >= PASS_COMPLETION
        and (p95 is None or p95 <= FRESHNESS_WINDOW)
    ):
        verdict = Verdict.PASS
    else:
        verdict = Verdict.WATCH

    return SourceReliability(
        start=begin,
        clipped=clipped,
        expected=expected,
        recorded=len(inside),
        successful=len(reads),
        completion=completion,
        longest_gap=longest,
        gaps_over_window=sum(1 for gap in gaps if gap > FRESHNESS_WINDOW),
        changes=len(latencies),
        detection_p95=p95,
        verdict=verdict,
    )
