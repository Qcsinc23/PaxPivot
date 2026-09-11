"""One deterministic pass over the registered sources, through the observation pipeline.

    for each source, in registry order:
        authorize_processing(RETRIEVE)          → skipped (gate's message key, provider not called)
        provider identity vs registry adapter   → skipped (provider not called)
        record_observation(source, provider, …) → recorded | rejected | provider_failure

Why every source yields exactly one outcome: PRD §9.3 requires that an attempt produces an
observation or a health event, never silence. A source that was not read has to say so, or the
absence of a row looks like a source that was read and found nothing.

The distinction between the four outcomes is the whole point of this module:

* ``recorded`` — an observation was appended. A retrieval *failure* is a normal observation and is
  recorded as its own failure state (``source_unreachable`` / ``source_missing``), never as an
  absence and never as ``no_departures_published``. ``apply`` proves that.
* ``skipped`` — policy, approval, enablement or a kill switch forbade the attempt, so **the
  provider was never invoked and nothing was stored**. A skip is a decision made before retrieval,
  which is why the gate is consulted here rather than being discovered part-way through.
* ``rejected`` — the provider ran and returned an observation that violates the registry or the
  policy (wrong identity, stale policy version, a payload reference the policy denies, an
  interpretation the policy did not approve, a credentialed URL). Nothing is stored.
* ``provider_failure`` — the provider itself could not do its job and returned ``Failure``
  (misconfiguration, transport). Nothing is stored.

What this module deliberately does not do: no scheduler, no cadence enforcement, no retries, no
worker registration and no network. It is a synchronous pass the caller drives, so it can be run
against fixtures, against a temporary database, and later behind a real adapter without changing.
``now`` is injected for the same reason every read service takes it — a run has to be reproducible.
"""

from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from paxpivot.application.ports.repositories import (
    KillSwitchRepository,
    SourceObservationRepository,
    SourceRepository,
)
from paxpivot.application.ports.source_provider import SourceProvider
from paxpivot.application.source_gate import authorize_processing
from paxpivot.application.source_pipeline import record_observation
from paxpivot.domain.base import Contract, Identifier
from paxpivot.domain.source import KillSwitch, ProcessingMode, Source, SourceState

CheckOutcome = Literal["recorded", "skipped", "rejected", "provider_failure"]


class SourceCheckOutcome(Contract):
    """What happened to one source in one run. Exactly one of these exists per source."""

    source_id: UUID
    outcome: CheckOutcome
    # The static catalog key explaining a non-recorded outcome. Never provider text.
    message_key: Identifier | None = None
    # The state that was recorded. Set only for `recorded`.
    state: SourceState | None = None


class SourceCheckRun(Contract):
    started_at: datetime
    outcomes: tuple[SourceCheckOutcome, ...]

    @property
    def recorded(self) -> tuple[SourceCheckOutcome, ...]:
        return tuple(o for o in self.outcomes if o.outcome == "recorded")

    @property
    def skipped(self) -> tuple[SourceCheckOutcome, ...]:
        return tuple(o for o in self.outcomes if o.outcome == "skipped")

    @property
    def rejected(self) -> tuple[SourceCheckOutcome, ...]:
        return tuple(o for o in self.outcomes if o.outcome == "rejected")

    @property
    def provider_failures(self) -> tuple[SourceCheckOutcome, ...]:
        return tuple(o for o in self.outcomes if o.outcome == "provider_failure")


def _outcome(
    source: Source,
    outcome: CheckOutcome,
    *,
    message_key: str | None = None,
    state: SourceState | None = None,
) -> SourceCheckOutcome:
    return SourceCheckOutcome(
        source_id=source.identity.source_id,
        outcome=outcome,
        message_key=message_key,
        state=state,
    )


def _identity_mismatch(source: Source, provider: SourceProvider) -> bool:
    """Whether this provider is the adapter the source is registered against.

    Mirrors the identity check `record_observation` performs, so the run can classify a mismatch as
    a skip *before* invoking anything. A source with no configured adapter is inert: nothing is
    wired to it, so nothing may observe it.
    """
    return source.adapter_id is None or provider.provider_id != source.adapter_id


async def check_source(
    source: Source,
    provider: SourceProvider,
    observations: SourceObservationRepository,
    switches: Sequence[KillSwitch],
) -> SourceCheckOutcome:
    """Run one source through the pipeline and classify the result. Never raises on a refusal."""
    # The gate first, so a forbidden source is never even parsed by the provider. This is the same
    # call `record_observation` makes, repeated here only to classify the refusal as a skip.
    authorization = authorize_processing(source, ProcessingMode.RETRIEVE, switches)
    if not authorization.ok:
        return _outcome(source, "skipped", message_key=authorization.error.message_key)
    if _identity_mismatch(source, provider):
        # The configured adapter is not this provider, so there is nothing to ask. Reported as a
        # skip because no retrieval was permitted, not because the provider misbehaved.
        return _outcome(source, "skipped", message_key="source_provider.identity_mismatch")

    result = await record_observation(source, provider, observations, switches)
    if result.ok:
        return _outcome(source, "recorded", state=result.value.state)

    # The gate already approved, so a `forbidden` or `invalid_input` code here came from
    # `validate_against_policy` refusing what the provider returned: a policy violation. Anything
    # else is the provider failing to do its job. Both store nothing, and the codes are the
    # contract's own (`_reject` in source_pipeline), not a guess at provider wording.
    if result.error.code in {"forbidden", "invalid_input"}:
        return _outcome(source, "rejected", message_key=result.error.message_key)
    return _outcome(source, "provider_failure", message_key=result.error.message_key)


async def run_source_checks(
    sources: SourceRepository,
    observations: SourceObservationRepository,
    kill_switches: KillSwitchRepository,
    provider: SourceProvider,
    *,
    now: datetime | None = None,
) -> SourceCheckRun:
    """Check every registered source exactly once, in registry order.

    One pass, one provider, no concurrency and no retries: the same inputs produce the same run,
    and each source's outcome is independent of the others. Appending is all this does to history —
    running it twice appends again and never updates.
    """
    started_at = now or datetime.now(UTC)
    switches = kill_switches.list_engaged()
    outcomes: list[SourceCheckOutcome] = []
    # Sequential by construction: each source is checked only after the previous one settled, so
    # one source's outcome can never depend on another's in-flight state.
    for source in sources.list_sources():
        outcomes.append(await check_source(source, provider, observations, switches))
    return SourceCheckRun(started_at=started_at, outcomes=tuple(outcomes))
