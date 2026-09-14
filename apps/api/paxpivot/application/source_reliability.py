"""Source reliability over a window: the pilot's source-health gate, computed (TASK-042).

The pilot baseline's gate (paxpivot.md, source health): a source passes with at least 95 % of
scheduled checks completed and p95 material-change detection within 6.5 hours; below 90 %, or a
gap beyond policy by more than 12 hours, stops automatic use of that source. Everything here is
a pure function over observations and registry rows that already exist: nothing is fetched or
written.

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
from paxpivot.application.source_checks import skip_reason
from paxpivot.domain.source import KillSwitch, RetrievalState, Source, SourceObservation

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
    hashed: bool  # every successful read carried a content hash, so detection is measurable
    changes: int
    detection_p95: timedelta | None
    verdict: Verdict


def report_scope(
    sources: Sequence[Source], switches: Sequence[KillSwitch], provider_id: str
) -> tuple[list[Source], list[tuple[Source, str]]]:
    """The sources the report measures, and every other source with the reason it is not.

    A source is measured only while a check-sources run with ``provider_id`` would read it
    (`source_checks.skip_reason`, the same function the run uses). A disabled, paused,
    restricted, kill-switched or unwired source is never read, so its silence is a decision or a
    configuration fact and must never be printed as an outage or as "not yet observed".
    """
    measured: list[Source] = []
    not_measured: list[tuple[Source, str]] = []
    for source in sources:
        reason = skip_reason(source, provider_id, switches)
        if reason is None:
            measured.append(source)
        else:
            not_measured.append((source, reason))
    return measured, not_measured


def reliability(
    observations: Sequence[SourceObservation],
    cadence_minutes: int | None,
    start: datetime,
    now: datetime,
) -> SourceReliability:
    """Measure one source's observations over ``[start, now]``.

    A source first observed inside the window is measured from that first observation and can
    at best WATCH, so a newly registered source is neither reported as an outage nor passed on a
    window shorter than the one asked for. Change detection is measurable only when every
    successful read in the window carried a content hash; a source with no or partial hash
    coverage (for example one whose policy started hashing mid-window) can at best WATCH too.
    """
    history = sorted(observations, key=lambda o: o.provenance.observed_at)
    inside = [o for o in history if start <= o.provenance.observed_at <= now]
    clipped = bool(inside) and history[0].provenance.observed_at >= start
    begin = inside[0].provenance.observed_at if clipped else start
    reads = [o for o in inside if o.retrieval == RetrievalState.SUCCEEDED]
    hashed = bool(reads) and all(o.content_hash for o in reads)

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
            hashed=hashed,
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
    # Full hash coverage is a precondition, not a tie-breaker: a quick change seen in a few hashed
    # reads says nothing about the unhashed rest of the window.
    detection_ok = hashed and (p95 is None or p95 <= FRESHNESS_WINDOW)

    if (completion is not None and completion < STOP_COMPLETION) or longest > STOP_GAP:
        verdict = Verdict.STOP
    elif not clipped and completion is not None and completion >= PASS_COMPLETION and detection_ok:
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
        hashed=hashed,
        changes=len(latencies),
        detection_p95=p95,
        verdict=verdict,
    )


def report_exit_code(results: Sequence[SourceReliability]) -> int:
    """What a person or scheduler acts on after a report.

    1 when any measured source must stop — checked first, so a source that went silent and
    recorded nothing still stops rather than reading as "no data"; 2 when no measured source
    recorded a single observation in the window, including when every source was skipped;
    0 otherwise (pass, watch or unknown).
    """
    if any(result.verdict == Verdict.STOP for result in results):
        return 1
    return 0 if any(result.recorded for result in results) else 2
