"""The provider attach point: policy gate → provider → validation → immutable append."""

import asyncio
from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import uuid4

from paxpivot.application.ports.repositories import SourceObservationRepository
from paxpivot.application.ports.source_provider import SourceProvider
from paxpivot.application.result import ApplicationError, Failure, Result, Success
from paxpivot.application.source_pipeline import record_observation
from paxpivot.domain.source import (
    ExtractionState,
    KillSwitch,
    KillSwitchScope,
    RetrievalState,
    Source,
    SourceIdentity,
    SourceObservation,
    SourceState,
)
from support_sources import (
    NEEDS_REVIEW,
    NOW,
    SOURCE_A,
    T0,
    FakeObservations,
    observation,
    provenance_with_url,
    source,
)


class ScriptedProvider:
    """Returns exactly what it was given; records that it was called."""

    def __init__(self, result: Result[SourceObservation]) -> None:
        self.result = result
        self.calls = 0

    async def observe(self, source: SourceIdentity) -> Result[SourceObservation]:
        self.calls += 1
        return self.result


def run(
    src: Source,
    provider: SourceProvider,
    repo: SourceObservationRepository,
    switches: Sequence[KillSwitch],
) -> Result[SourceObservation]:
    return asyncio.run(record_observation(src, provider, repo, switches))


def test_failed_retrieval_is_stored_as_a_failure_observation() -> None:
    failed = observation(
        SOURCE_A,
        "f",
        state=SourceState.UNREACHABLE,
        observed_at=NOW,
        retrieval=RetrievalState.FAILED,
        reasons=("retrieval_failed",),
    )
    repo = FakeObservations([])
    result = run(SOURCE_A, ScriptedProvider(Success(value=failed)), repo, [])
    assert result.ok and repo.items == [failed]
    assert repo.items[0].state == SourceState.UNREACHABLE  # never "no departures"


def test_kill_switch_prevents_the_provider_call_entirely() -> None:
    provider = ScriptedProvider(
        Success(value=observation(SOURCE_A, "x", state=SourceState.FRESH, observed_at=NOW))
    )
    repo = FakeObservations([])
    switch = KillSwitch(
        switch_id=uuid4(),
        scope=KillSwitchScope.SOURCE,
        key=str(SOURCE_A.identity.source_id),
        reason="synthetic_incident",
        engaged_at=NOW,
        released_at=None,
    )
    result = run(SOURCE_A, provider, repo, [switch])
    assert not result.ok and result.error.message_key == "source.kill_switch_engaged"
    assert provider.calls == 0 and repo.items == []


def test_provider_configuration_failure_passes_through_without_storing() -> None:
    failure = Failure(
        error=ApplicationError(
            code="unavailable", message_key="source_provider.not_configured", retryable=True
        )
    )
    repo = FakeObservations([])
    result = run(SOURCE_A, ScriptedProvider(failure), repo, [])
    assert not result.ok and result.error.message_key == "source_provider.not_configured"
    assert repo.items == []


def test_provider_output_is_validated_against_registry_and_policy() -> None:
    repo = FakeObservations([])
    other = source("other")
    foreign = observation(other, "foreign", state=SourceState.FRESH, observed_at=NOW)
    result = run(SOURCE_A, ScriptedProvider(Success(value=foreign)), repo, [])
    assert not result.ok and result.error.message_key == "source.observation_identity_mismatch"

    stale_policy = observation(SOURCE_A, "sp", state=SourceState.FRESH, observed_at=NOW)
    stale_policy = stale_policy.model_copy(
        update={
            "provenance": stale_policy.provenance.model_copy(update={"policy_version_id": "old"})
        }
    )
    result = run(SOURCE_A, ScriptedProvider(Success(value=stale_policy)), repo, [])
    assert not result.ok and result.error.message_key == "source.observation_policy_mismatch"

    with_payload = observation(SOURCE_A, "wp", state=SourceState.FRESH, observed_at=NOW).model_copy(
        update={"payload_ref": "blob://synthetic"}
    )
    result = run(SOURCE_A, ScriptedProvider(Success(value=with_payload)), repo, [])
    assert not result.ok and result.error.message_key == "source.raw_payload_denied"

    unreviewed = source("u", policy=NEEDS_REVIEW)
    parsed = observation(
        unreviewed,
        "parsed",
        state=SourceState.FRESH,
        observed_at=NOW,
        extraction=ExtractionState.EXACT,
        parser_version="synthetic-parser-v1",
    )
    result = run(unreviewed, ScriptedProvider(Success(value=parsed)), repo, [])
    assert not result.ok and result.error.message_key == "source.parse_denied"
    # Metadata-only retrieval of an unreviewed source is allowed and stored.
    metadata_only = observation(unreviewed, "meta", state=SourceState.FRESH, observed_at=NOW)
    result = run(unreviewed, ScriptedProvider(Success(value=metadata_only)), repo, [])
    assert result.ok and repo.items == [metadata_only]
    assert datetime.now(UTC) > T0

    # `denied` keeps neither the body nor a hash of it, even for metadata-only retrieval.
    with_hash = observation(
        unreviewed,
        "hash",
        state=SourceState.FRESH,
        observed_at=NOW,
        content_hash="hash-synthetic",
    )
    result = run(unreviewed, ScriptedProvider(Success(value=with_hash)), repo, [])
    assert not result.ok and result.error.message_key == "source.raw_hash_denied"
    assert repo.items == [metadata_only]

    # A credentialed URL must never enter an observation.
    credentialed = observation(
        SOURCE_A, "creds", state=SourceState.FRESH, observed_at=NOW
    ).model_copy(
        update={
            "provenance": provenance_with_url(
                SOURCE_A, "https://example.invalid/page?api_key=SUPERSECRET"
            )
        }
    )
    result = run(SOURCE_A, ScriptedProvider(Success(value=credentialed)), repo, [])
    assert not result.ok and result.error.message_key == "source.url_carries_credentials"
    assert repo.items == [metadata_only]

    # A MODE-scope switch stops that mode's effect, not only retrieval.
    parse_switch = KillSwitch(
        switch_id=uuid4(),
        scope=KillSwitchScope.MODE,
        key="parse",
        reason="synthetic_incident",
        engaged_at=NOW,
        released_at=None,
    )
    approved = source("approved")
    parsed_approved = observation(
        approved,
        "parsed-approved",
        state=SourceState.FRESH,
        observed_at=NOW,
        extraction=ExtractionState.EXACT,
        parser_version="synthetic-parser-v1",
    )
    repo2 = FakeObservations([])
    result = run(approved, ScriptedProvider(Success(value=parsed_approved)), repo2, [parse_switch])
    assert not result.ok and result.error.message_key == "source.kill_switch_engaged"
    assert repo2.items == []

    store_switch = KillSwitch(
        switch_id=uuid4(),
        scope=KillSwitchScope.MODE,
        key="store_raw",
        reason="synthetic_incident",
        engaged_at=NOW,
        released_at=None,
    )
    with_payload_ref = observation(
        approved, "payload", state=SourceState.FRESH, observed_at=NOW
    ).model_copy(update={"payload_ref": "blob://synthetic"})
    repo3 = FakeObservations([])
    result = run(approved, ScriptedProvider(Success(value=with_payload_ref)), repo3, [store_switch])
    assert not result.ok and result.error.message_key == "source.kill_switch_engaged"
    assert repo3.items == []
