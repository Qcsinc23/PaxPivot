"""The provider attach point: policy gate → provider → validation → immutable append."""

import asyncio
from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import uuid4

from paxpivot.application.parsers.amc_terminal_facts import ParsedFact
from paxpivot.application.ports.repositories import SourceObservationRepository, TerminalRepository
from paxpivot.application.ports.source_provider import SourceProvider, TerminalFactProvider
from paxpivot.application.result import ApplicationError, Failure, Result, Success
from paxpivot.application.source_pipeline import record_observation, record_terminal_facts
from paxpivot.domain.source import (
    ExtractionState,
    KillSwitch,
    KillSwitchScope,
    RetrievalState,
    Source,
    SourceIdentity,
    SourceKind,
    SourceObservation,
    SourceState,
)
from paxpivot.domain.terminal import TerminalFactKind, TerminalOperationalFact
from support_sources import (
    ADAPTER_ID,
    APPROVED,
    DIRECTORY,
    NEEDS_REVIEW,
    NOW,
    RESTRICTED,
    SOURCE_A,
    T0,
    TERMINAL_A,
    FakeObservations,
    FakeTerminals,
    fact,
    observation,
    provenance_with_url,
    source,
)


class ScriptedProvider:
    """Returns exactly what it was given; records that it was called.

    A real adapter's own identity is the same value it stamps into ``provenance.provider_id``,
    so the scripted double reads it from the observation it was handed rather than taking a
    second, independently wrong default. ``provider_id`` is overridable to exercise mismatches.

    ``provider_id`` is a read-only property, which is how both this class and the frozen-dataclass
    fakes in the conformance suite satisfy the port: an adapter's identity is fixed, never
    reassigned.
    """

    def __init__(
        self, result: Result[SourceObservation], *, provider_id: str | None = None
    ) -> None:
        self.result = result
        self.calls = 0
        self._provider_id = provider_id if provider_id is not None else _declared(result)

    @property
    def provider_id(self) -> str:
        return self._provider_id

    async def observe(self, source: SourceIdentity) -> Result[SourceObservation]:
        self.calls += 1
        return self.result


def _declared(result: Result[SourceObservation]) -> str:
    return result.value.provenance.provider_id if result.ok else ADAPTER_ID


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


def test_provider_that_is_not_the_registered_adapter_is_never_invoked() -> None:
    """An adapter may not answer for a source registered against a different one.

    Called *before* retrieval, so the wrong adapter costs no network call and cannot be
    used to sidestep an ADAPTER-scope kill switch that keys on the configured adapter_id.
    """
    repo = FakeObservations([])
    provider = ScriptedProvider(
        Success(value=observation(SOURCE_A, "x", state=SourceState.FRESH, observed_at=NOW)),
        provider_id="some-other-adapter",
    )
    result = run(SOURCE_A, provider, repo, [])
    assert not result.ok and result.error.message_key == "source_provider.identity_mismatch"
    assert provider.calls == 0 and repo.items == []


def test_source_with_no_configured_adapter_is_never_observed() -> None:
    # DIRECTORY is seeded with adapter=None: nothing is wired to it, so nothing may observe it.
    repo = FakeObservations([])
    provider = ScriptedProvider(
        Success(value=observation(DIRECTORY, "d", state=SourceState.FRESH, observed_at=NOW))
    )
    result = run(DIRECTORY, provider, repo, [])
    assert not result.ok and result.error.message_key == "source_provider.identity_mismatch"
    assert provider.calls == 0 and repo.items == []


def test_observation_may_not_be_attributed_to_another_adapter() -> None:
    """A provider must not run under one identity and stamp results with another."""
    repo = FakeObservations([])
    stamped_by_registered = observation(
        SOURCE_A, "forged", state=SourceState.FRESH, observed_at=NOW
    ).model_copy(
        update={"provenance": provenance_with_url(SOURCE_A, "https://example.invalid/terminal-a")}
    )
    # provenance_with_url stamps ADAPTER_ID; declare a different identity on the provider.
    provider = ScriptedProvider(Success(value=stamped_by_registered), provider_id="other-adapter")
    result = run(SOURCE_A, provider, repo, [])
    assert not result.ok and result.error.message_key == "source_provider.identity_mismatch"
    assert provider.calls == 0 and repo.items == []


def test_identity_is_checked_against_the_registry_before_attribution() -> None:
    # The registered adapter runs (its identity matches the registry) but hands back an
    # observation stamped with someone else's identity: refused on attribution.
    honest = observation(SOURCE_A, "misattributed", state=SourceState.FRESH, observed_at=NOW)
    forged = honest.model_copy(
        update={
            "provenance": honest.provenance.model_copy(
                update={"provider_id": "impersonated-adapter"}
            )
        }
    )
    repo = FakeObservations([])
    provider = ScriptedProvider(Success(value=forged), provider_id=ADAPTER_ID)
    result = run(SOURCE_A, provider, repo, [])
    assert not result.ok
    assert result.error.message_key == "source.observation_provider_mismatch"
    assert provider.calls == 1 and repo.items == []


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


# ---- record_terminal_facts (TASK-048) ----------------------------------------------------------


class ScriptedFactsProvider:
    """Returns exactly what it was given; records how many times it was called."""

    def __init__(
        self, result: Result[tuple[ParsedFact, ...]], *, provider_id: str = ADAPTER_ID
    ) -> None:
        self.result = result
        self.calls = 0
        self._provider_id = provider_id

    @property
    def provider_id(self) -> str:
        return self._provider_id

    async def observe_facts(self, source: SourceIdentity) -> Result[tuple[ParsedFact, ...]]:
        self.calls += 1
        return self.result


def run_facts(
    src: Source,
    facts_provider: TerminalFactProvider,
    terminal_facts: TerminalRepository,
    switches: Sequence[KillSwitch] = (),
    *,
    observed_at: datetime = NOW,
) -> Result[tuple[TerminalOperationalFact, ...]]:
    return asyncio.run(
        record_terminal_facts(
            src, facts_provider, terminal_facts, switches, observed_at=observed_at
        )
    )


def test_a_new_fact_is_appended_with_full_provenance() -> None:
    repo = FakeTerminals(items=[TERMINAL_A], facts=[])
    parsed = ParsedFact(TerminalFactKind.COUNTER_HOURS, "0700-0000")
    provider = ScriptedFactsProvider(Success(value=(parsed,)))
    result = run_facts(SOURCE_A, provider, repo, observed_at=NOW)
    assert result.ok and len(result.value) == 1
    assert provider.calls == 1
    appended = repo.facts[0]
    assert appended.terminal_id == TERMINAL_A.terminal_id
    assert appended.kind == TerminalFactKind.COUNTER_HOURS
    assert appended.value == "0700-0000"
    assert appended.provenance.source == SOURCE_A.identity
    assert appended.provenance.observed_at == NOW
    assert appended.provenance.source_time is None  # Never invented (TASK-038's own rule).
    assert appended.provenance.provider_id == ADAPTER_ID
    assert appended.provenance.policy_version_id == SOURCE_A.policy.policy_version_id
    assert appended.recorded_at == NOW
    assert appended.effective_from is None and appended.effective_to is None


def test_a_repeated_check_with_the_same_value_appends_nothing() -> None:
    existing = fact(TERMINAL_A, SOURCE_A, TerminalFactKind.COUNTER_HOURS, "0700-0000")
    repo = FakeTerminals(items=[TERMINAL_A], facts=[existing])
    parsed = ParsedFact(TerminalFactKind.COUNTER_HOURS, "0700-0000")
    provider = ScriptedFactsProvider(Success(value=(parsed,)))
    result = run_facts(SOURCE_A, provider, repo)
    assert result.ok and result.value == ()
    assert repo.facts == [existing]  # Nothing new appended: the append-only table stays put.


def test_a_changed_value_is_appended_and_the_old_fact_is_kept() -> None:
    existing = fact(TERMINAL_A, SOURCE_A, TerminalFactKind.COUNTER_HOURS, "0700-0000")
    repo = FakeTerminals(items=[TERMINAL_A], facts=[existing])
    parsed = ParsedFact(TerminalFactKind.COUNTER_HOURS, "0800-2359")
    provider = ScriptedFactsProvider(Success(value=(parsed,)))
    result = run_facts(SOURCE_A, provider, repo)
    assert result.ok and len(result.value) == 1
    assert result.value[0].value == "0800-2359"
    assert existing in repo.facts and result.value[0] in repo.facts
    assert len(repo.facts) == 2  # History is appended, never overwritten (append-only table).


def test_facts_are_never_recorded_without_parse_authorization() -> None:
    unreviewed = source("u", terminal="a", policy=NEEDS_REVIEW)  # may_parse is False
    repo = FakeTerminals(items=[TERMINAL_A], facts=[])
    provider = ScriptedFactsProvider(
        Success(value=(ParsedFact(TerminalFactKind.COUNTER_HOURS, "0700-0000"),))
    )
    result = run_facts(unreviewed, provider, repo)
    assert result.ok and result.value == ()
    assert provider.calls == 0 and repo.facts == []


def test_facts_are_never_recorded_without_display_authorization() -> None:
    parse_only = source(
        "parse-only", terminal="a", policy=APPROVED.model_copy(update={"may_display": False})
    )
    repo = FakeTerminals(items=[TERMINAL_A], facts=[])
    provider = ScriptedFactsProvider(
        Success(value=(ParsedFact(TerminalFactKind.COUNTER_HOURS, "0700-0000"),))
    )
    result = run_facts(parse_only, provider, repo)
    assert result.ok and result.value == ()
    assert provider.calls == 0 and repo.facts == []


def test_a_restricted_source_never_gets_a_fact_appended() -> None:
    restricted = source("restricted", terminal="a", policy=RESTRICTED)
    repo = FakeTerminals(items=[TERMINAL_A], facts=[])
    provider = ScriptedFactsProvider(
        Success(value=(ParsedFact(TerminalFactKind.COUNTER_HOURS, "0700-0000"),))
    )
    result = run_facts(restricted, provider, repo)
    assert result.ok and result.value == ()
    assert provider.calls == 0 and repo.facts == []


def test_a_schedule_artifact_source_is_never_asked_for_facts() -> None:
    artifact = source("artifact", kind=SourceKind.SCHEDULE_ARTIFACT, terminal="a")
    repo = FakeTerminals(items=[TERMINAL_A], facts=[])
    provider = ScriptedFactsProvider(
        Success(value=(ParsedFact(TerminalFactKind.COUNTER_HOURS, "0700-0000"),))
    )
    result = run_facts(artifact, provider, repo)
    assert result.ok and result.value == ()
    assert provider.calls == 0 and repo.facts == []


def test_a_source_with_no_terminal_is_never_asked_for_facts() -> None:
    repo = FakeTerminals(items=[TERMINAL_A], facts=[])
    provider = ScriptedFactsProvider(
        Success(value=(ParsedFact(TerminalFactKind.COUNTER_HOURS, "0700-0000"),))
    )
    result = run_facts(DIRECTORY, provider, repo)
    assert result.ok and result.value == ()
    assert provider.calls == 0 and repo.facts == []


def test_a_facts_provider_that_is_not_the_registered_adapter_is_never_invoked() -> None:
    repo = FakeTerminals(items=[TERMINAL_A], facts=[])
    provider = ScriptedFactsProvider(
        Success(value=(ParsedFact(TerminalFactKind.COUNTER_HOURS, "0700-0000"),)),
        provider_id="some-other-adapter",
    )
    result = run_facts(SOURCE_A, provider, repo)
    assert not result.ok and result.error.message_key == "source_provider.identity_mismatch"
    assert provider.calls == 0 and repo.facts == []


def test_a_provider_failure_passes_through_without_appending() -> None:
    repo = FakeTerminals(items=[TERMINAL_A], facts=[])
    failure = Failure(
        error=ApplicationError(
            code="unavailable", message_key="source_provider.firecrawl_unreachable", retryable=True
        )
    )
    provider = ScriptedFactsProvider(failure)
    result = run_facts(SOURCE_A, provider, repo)
    assert not result.ok and result.error.message_key == "source_provider.firecrawl_unreachable"
    assert repo.facts == []


def test_multiple_parsed_kinds_only_append_the_ones_that_are_new_or_changed() -> None:
    existing_hours = fact(TERMINAL_A, SOURCE_A, TerminalFactKind.COUNTER_HOURS, "0700-0000")
    repo = FakeTerminals(items=[TERMINAL_A], facts=[existing_hours])
    parsed = (
        ParsedFact(TerminalFactKind.COUNTER_HOURS, "0700-0000"),  # unchanged: not appended
        ParsedFact(TerminalFactKind.PHONE, "Comm: 555-0100"),  # new: appended
    )
    provider = ScriptedFactsProvider(Success(value=parsed))
    result = run_facts(SOURCE_A, provider, repo)
    assert result.ok and len(result.value) == 1
    assert result.value[0].kind == TerminalFactKind.PHONE
    assert {f.kind for f in repo.facts} == {TerminalFactKind.COUNTER_HOURS, TerminalFactKind.PHONE}
