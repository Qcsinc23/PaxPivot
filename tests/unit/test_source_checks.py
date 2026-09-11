"""The source-check runner: one deterministic pass, four honest outcomes, no network.

Every provider here is a fixture. Nothing resolves a hostname or opens a socket, and the module-wide
guard below proves that rather than asserting it.
"""

import asyncio
import socket
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import datetime
from functools import partial
from uuid import UUID, uuid4

import pytest
from paxpivot.application.ports.source_provider import SourceProvider
from paxpivot.application.result import ApplicationError, Failure, Result, Success
from paxpivot.application.source_checks import SourceCheckRun, run_source_checks
from paxpivot.domain.source import (
    KillSwitch,
    KillSwitchScope,
    PolicyReviewState,
    ProcessingMode,
    RetrievalState,
    Source,
    SourceIdentity,
    SourceObservation,
    SourceProcessingPolicy,
    SourceState,
)
from support_sources import (
    ADAPTER_ID,
    APPROVED,
    DIRECTORY,
    NEEDS_REVIEW,
    NOW,
    RESTRICTED,
    SOURCE_A,
    SOURCE_B,
    SWITCHES,
    T0,
    FakeObservations,
    FakeSources,
    FakeSwitches,
    observation,
    provenance_with_url,
    source,
)


class NetworkAccessAttemptedError(AssertionError):
    """Raised when a runner test tries to resolve or connect to anything."""


@pytest.fixture(autouse=True)
def no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    """Refuse DNS and TCP connects for every test in this module.

    The runner is offline by design. Without this, "no network" would be a comment rather than a
    property the suite actually enforces.
    """

    def refuse(*args: object, **kwargs: object) -> None:
        raise NetworkAccessAttemptedError("the source-check runner must not perform network I/O")

    monkeypatch.setattr(socket, "getaddrinfo", refuse)
    monkeypatch.setattr(socket, "create_connection", refuse)


@dataclass
class ScriptedProvider:
    """Returns one fixed result and counts how often it was asked."""

    result: Result[SourceObservation]
    provider_id: str = ADAPTER_ID
    calls: int = 0

    async def observe(self, source: SourceIdentity) -> Result[SourceObservation]:
        del source  # The scripted result is already fixed; no I/O and no re-derivation.
        self.calls += 1
        return self.result


@dataclass
class MappingProvider:
    """A per-source result, so one run can exercise every outcome at once.

    A `callable` result is invoked per check, which is how a real provider behaves: each check
    yields a *new* observation with its own id. Returning a stored object instead would replay one
    observation id and collide on the primary key, which is a property of the fixture rather than
    of the runner.
    """

    results: Mapping[UUID, Result[SourceObservation] | Callable[[], Result[SourceObservation]]]
    provider_id: str = ADAPTER_ID
    calls: list[UUID] = field(default_factory=list)

    async def observe(self, source: SourceIdentity) -> Result[SourceObservation]:
        self.calls.append(source.source_id)
        result = self.results[source.source_id]
        return result() if callable(result) else result


def fresh(src: Source, observed_at: datetime = NOW) -> SourceObservation:
    """A fresh observation with a unique id, as a real check would produce each time."""
    return observation(src, f"fresh:{uuid4()}", state=SourceState.FRESH, observed_at=observed_at)


def _fresh_result(src: Source) -> Result[SourceObservation]:
    """One fresh observation for `src`. Used through `partial` so every check gets a new id."""
    return Success(value=fresh(src))


def run(
    sources: FakeSources,
    observations: FakeObservations,
    provider: SourceProvider,
    switches: Sequence[KillSwitch] = (),
) -> SourceCheckRun:
    return asyncio.run(
        run_source_checks(sources, observations, FakeSwitches(switches), provider, now=NOW)
    )


# ── skipped: the provider is never invoked ──────────────────────────────


def test_a_disabled_source_is_skipped_without_calling_the_provider() -> None:
    disabled = source("disabled", enabled=False)
    provider = ScriptedProvider(Success(value=fresh(disabled)))
    observations = FakeObservations([])
    result = run(FakeSources([disabled]), observations, provider)

    (outcome,) = result.outcomes
    assert outcome.outcome == "skipped"
    assert outcome.message_key == "source.disabled"
    assert outcome.state is None
    assert provider.calls == 0
    assert observations.items == []


@pytest.mark.parametrize(
    ("policy", "message_key"),
    [
        (
            APPROVED.model_copy(update={"review_state": PolicyReviewState.PAUSED}),
            "source.paused",
        ),
        (RESTRICTED, "source.restricted"),
        (NEEDS_REVIEW.model_copy(update={"may_retrieve": False}), "source.not_approved"),
    ],
    ids=["paused", "restricted", "unreviewed-without-retrieve"],
)
def test_policy_refusals_are_skipped_with_the_gates_own_key(
    policy: SourceProcessingPolicy, message_key: str
) -> None:
    src = source("policed", policy=policy)
    provider = ScriptedProvider(Success(value=fresh(src)))
    observations = FakeObservations([])
    result = run(FakeSources([src]), observations, provider)

    (outcome,) = result.outcomes
    assert outcome.outcome == "skipped"
    assert outcome.message_key == message_key
    assert provider.calls == 0
    assert observations.items == []


@pytest.mark.parametrize(
    ("scope", "key"),
    [
        (KillSwitchScope.SOURCE, str(SOURCE_A.identity.source_id)),
        (KillSwitchScope.ADAPTER, ADAPTER_ID),
        (KillSwitchScope.MODE, ProcessingMode.RETRIEVE.value),
    ],
    ids=["source", "adapter", "mode"],
)
def test_every_kill_switch_scope_skips_before_retrieval(scope: KillSwitchScope, key: str) -> None:
    provider = ScriptedProvider(Success(value=fresh(SOURCE_A)))
    observations = FakeObservations([])
    switch = KillSwitch(
        switch_id=UUID("77777777-7777-4777-8777-777777777777"),
        scope=scope,
        key=key,
        reason="synthetic_incident",
        engaged_at=T0,
        released_at=None,
    )
    result = run(FakeSources([SOURCE_A]), observations, provider, [switch])

    (outcome,) = result.outcomes
    assert outcome.outcome == "skipped"
    assert outcome.message_key == "source.kill_switch_engaged"
    assert provider.calls == 0
    assert observations.items == []


def test_a_source_with_no_configured_adapter_is_skipped() -> None:
    # Nothing is wired to it, so nothing may observe it — and the provider must not be asked.
    provider = ScriptedProvider(Success(value=fresh(DIRECTORY)))
    observations = FakeObservations([])
    result = run(FakeSources([DIRECTORY]), observations, provider)

    (outcome,) = result.outcomes
    assert outcome.outcome == "skipped"
    assert outcome.message_key == "source_provider.identity_mismatch"
    assert provider.calls == 0


def test_a_provider_that_is_not_the_registered_adapter_is_skipped() -> None:
    provider = ScriptedProvider(Success(value=fresh(SOURCE_A)), provider_id="some-other-adapter")
    observations = FakeObservations([])
    result = run(FakeSources([SOURCE_A]), observations, provider)

    (outcome,) = result.outcomes
    assert outcome.outcome == "skipped"
    assert outcome.message_key == "source_provider.identity_mismatch"
    assert provider.calls == 0
    assert observations.items == []


# ── recorded: a retrieval failure is an observation, never an absence ────


@pytest.mark.parametrize(
    "state", [SourceState.UNREACHABLE, SourceState.MISSING], ids=["unreachable", "missing"]
)
def test_retrieval_failure_is_recorded_as_that_exact_failure_state(state: SourceState) -> None:
    failed = observation(
        SOURCE_A,
        f"failed:{state}",
        state=state,
        observed_at=NOW,
        retrieval=RetrievalState.FAILED,
        reasons=("retrieval_failed",),
    )
    provider = ScriptedProvider(Success(value=failed))
    observations = FakeObservations([])
    result = run(FakeSources([SOURCE_A]), observations, provider)

    (outcome,) = result.outcomes
    assert outcome.outcome == "recorded"
    assert outcome.state == state
    assert provider.calls == 1
    # Stored as the failure it is, and emphatically not as an absence of departures.
    assert [o.state for o in observations.items] == [state]
    assert observations.items[0].state != SourceState.NO_DEPARTURES


def test_a_successful_observation_is_recorded_once() -> None:
    good = fresh(SOURCE_A)
    provider = ScriptedProvider(Success(value=good))
    observations = FakeObservations([])
    result = run(FakeSources([SOURCE_A]), observations, provider)

    (outcome,) = result.outcomes
    assert outcome.outcome == "recorded" and outcome.state == SourceState.FRESH
    assert observations.items == [good]


# ── rejected and provider_failure: nothing is stored ────────────────────


def test_a_provider_failure_is_reported_and_stores_nothing() -> None:
    failure = Failure(
        error=ApplicationError(
            code="unavailable", message_key="source_provider.not_configured", retryable=True
        )
    )
    provider = ScriptedProvider(failure)
    observations = FakeObservations([])
    result = run(FakeSources([SOURCE_A]), observations, provider)

    (outcome,) = result.outcomes
    assert outcome.outcome == "provider_failure"
    assert outcome.message_key == "source_provider.not_configured"
    assert outcome.state is None
    assert provider.calls == 1
    assert observations.items == []


def test_a_policy_violation_is_rejected_and_stores_nothing() -> None:
    # The provider ran and returned an observation carrying a credentialed URL, which the policy
    # forbids outright.
    credentialed = observation(SOURCE_A, "creds", state=SourceState.FRESH, observed_at=NOW)
    credentialed = credentialed.model_copy(
        update={
            "provenance": provenance_with_url(
                SOURCE_A, "https://example.invalid/page?api_key=SUPERSECRET"
            )
        }
    )
    provider = ScriptedProvider(Success(value=credentialed))
    observations = FakeObservations([])
    result = run(FakeSources([SOURCE_A]), observations, provider)

    (outcome,) = result.outcomes
    assert outcome.outcome == "rejected"
    assert outcome.message_key == "source.url_carries_credentials"
    assert provider.calls == 1
    assert observations.items == []


def test_a_payload_reference_the_policy_denies_is_rejected() -> None:
    approved = source("approved", policy=APPROVED)
    with_payload = observation(approved, "payload", state=SourceState.FRESH, observed_at=NOW)
    with_payload = with_payload.model_copy(update={"payload_ref": "blob://synthetic"})
    provider = ScriptedProvider(Success(value=with_payload))
    observations = FakeObservations([])
    result = run(FakeSources([approved]), observations, provider)

    (outcome,) = result.outcomes
    assert outcome.outcome == "rejected"
    assert outcome.message_key == "source.raw_payload_denied"
    assert observations.items == []


# ── the run as a whole ──────────────────────────────────────────────────


def test_every_source_yields_exactly_one_outcome_and_running_twice_appends_again() -> None:
    sources = FakeSources()
    observations = FakeObservations([])
    provider = MappingProvider(
        {s.identity.source_id: partial(_fresh_result, s) for s in sources.list_sources()}
    )

    first = run(sources, observations, provider)
    assert len(first.outcomes) == len(sources.list_sources())
    assert len({o.source_id for o in first.outcomes}) == len(first.outcomes)
    recorded_first = len(first.recorded)
    assert len(observations.items) == recorded_first

    second = run(sources, observations, provider)
    assert len(second.outcomes) == len(first.outcomes)
    # History grows; nothing is updated or replaced.
    assert len(observations.items) == recorded_first * 2
    assert len(first.recorded) == recorded_first < len(observations.items)
    assert [o.outcome for o in first.outcomes] == [o.outcome for o in second.outcomes]


def test_one_sources_refusal_does_not_affect_the_others() -> None:
    sources = FakeSources([SOURCE_A, SOURCE_B, DIRECTORY])
    observations = FakeObservations([])
    provider = MappingProvider(
        {
            SOURCE_A.identity.source_id: Success(value=fresh(SOURCE_A)),
            SOURCE_B.identity.source_id: Failure(
                error=ApplicationError(
                    code="unavailable", message_key="source_provider.not_configured", retryable=True
                )
            ),
            DIRECTORY.identity.source_id: Success(value=fresh(DIRECTORY)),
        }
    )
    result = run(sources, observations, provider)

    by_id = {o.source_id: o for o in result.outcomes}
    assert by_id[SOURCE_A.identity.source_id].outcome == "recorded"
    assert by_id[SOURCE_B.identity.source_id].outcome == "provider_failure"
    # DIRECTORY has no adapter, so it is skipped even though the provider could have answered.
    assert by_id[DIRECTORY.identity.source_id].outcome == "skipped"
    assert [o.state for o in observations.items] == [SourceState.FRESH]


def test_outcomes_are_grouped_and_carry_no_free_text() -> None:
    sources = FakeSources([SOURCE_A, DIRECTORY])
    observations = FakeObservations([])
    provider = MappingProvider({SOURCE_A.identity.source_id: Success(value=fresh(SOURCE_A))})
    result = run(sources, observations, provider)

    assert [o.source_id for o in result.recorded] == [SOURCE_A.identity.source_id]
    assert [o.source_id for o in result.skipped] == [DIRECTORY.identity.source_id]
    assert result.rejected == () and result.provider_failures == ()
    assert result.started_at == NOW
    # Message keys are static catalog keys: no URL, UUID or provider wording leaks through.
    payload = result.model_dump_json()
    for prohibited in ("http", "example.invalid", "Traceback"):
        assert prohibited not in payload


def test_the_runner_is_deterministic_across_runs() -> None:
    def once() -> str:
        sources = FakeSources([SOURCE_A, SOURCE_B, DIRECTORY])
        observations = FakeObservations([])
        provider = MappingProvider(
            {s.identity.source_id: Success(value=fresh(s)) for s in sources.list_sources()}
        )
        dumped: str = run(sources, observations, provider).model_dump_json()
        return dumped

    assert once() == once()


def test_the_network_guard_is_actually_armed() -> None:
    # Without this, the module-wide "no network" claim would be vacuous.
    with pytest.raises(NetworkAccessAttemptedError):
        socket.getaddrinfo("example.invalid", 443)
    with pytest.raises(NetworkAccessAttemptedError):
        socket.create_connection(("example.invalid", 443))


def test_the_runner_module_imports_no_network_client() -> None:
    """Belt and braces with the runtime guard: the runner must not gain an HTTP client."""
    import ast
    import pathlib

    import paxpivot.application.source_checks as module

    tree = ast.parse(pathlib.Path(module.__file__).read_text())
    imported: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module.split(".")[0])
    forbidden = {"httpx", "requests", "urllib", "aiohttp", "http", "ssl", "firecrawl", "socket"}
    assert imported & forbidden == set()
    assert imported  # the parse found real imports, so the check is not vacuous


def test_the_fixture_world_covers_the_states_this_suite_relies_on() -> None:
    # A canary on the shared fixtures: if these change, the parametrised cases above stop meaning
    # what their names say.
    assert DIRECTORY.adapter_id is None  # enabled, but nothing is wired to it
    assert SOURCE_A.policy.allows(ProcessingMode.RETRIEVE)
    assert any(s.scope == KillSwitchScope.SOURCE for s in SWITCHES)


def test_started_at_must_be_timezone_aware() -> None:
    """A4: the run's clock is an aware datetime, UTC or not; naive is refused up front."""
    from datetime import UTC, timedelta, timezone

    from paxpivot.application.source_checks import SourceCheckRun

    utc = SourceCheckRun(started_at=datetime(2026, 9, 11, 12, 0, tzinfo=UTC), outcomes=())
    assert utc.started_at.tzinfo is not None
    offset = SourceCheckRun(
        started_at=datetime(2026, 9, 11, 8, 0, tzinfo=timezone(timedelta(hours=-4))), outcomes=()
    )
    assert offset.started_at.utcoffset() == timedelta(hours=-4)
    with pytest.raises(ValueError):
        SourceCheckRun(started_at=datetime(2026, 9, 11, 12, 0), outcomes=())
    with pytest.raises(ValueError, match="aware"):
        asyncio.run(
            run_source_checks(
                FakeSources([]),
                FakeObservations([]),
                FakeSwitches([]),
                ScriptedProvider(
                    Failure(
                        error=ApplicationError(code="unavailable", message_key="x", retryable=False)
                    )
                ),
                now=datetime(2026, 9, 11, 12, 0),
            )
        )


def test_exit_code_contract_for_schedulers() -> None:
    """TASK-025: cron acts on these codes; pin them independently of the tooling wiring."""
    from datetime import UTC

    from paxpivot.application.source_checks import SourceCheckOutcome, SourceCheckRun, exit_code

    when = datetime(2026, 9, 11, 12, 0, tzinfo=UTC)
    ok = SourceCheckRun(
        started_at=when,
        outcomes=(
            SourceCheckOutcome(source_id=uuid4(), outcome="recorded", state=SourceState.FRESH),
        ),
    )
    failed = SourceCheckRun(
        started_at=when,
        outcomes=(
            SourceCheckOutcome(source_id=uuid4(), outcome="recorded", state=SourceState.FRESH),
            SourceCheckOutcome(
                source_id=uuid4(), outcome="provider_failure", message_key="source_provider.x"
            ),
        ),
    )
    assert exit_code(None) == 2
    assert exit_code(ok) == 0
    assert exit_code(failed) == 3
