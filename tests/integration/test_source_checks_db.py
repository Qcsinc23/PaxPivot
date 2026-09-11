"""The source-check runner against a real migrated database, in one write transaction per run.

This is where the pipeline is proved end to end rather than in fakes: the gate, the provider attach
point, the policy validation, the append and the read that reports it all run against PostgreSQL,
where the append-only triggers and the transaction boundary are real.

Two properties shape how these tests are written.

**Each test gets its own source.** Observations are append-only by database trigger, so a test
cannot clear what an earlier test wrote — and it must not try, because that trigger is a feature.
A unique source id per test therefore gives every assertion a known starting state without
weakening the database.

**Nothing reaches the network.** The runner is offline by design, and the module-wide guard below
makes that enforced rather than merely intended.

The seeded registry is deliberately inert (one `needs_review` directory source, disabled, no
adapter), so the tests add their own approved source — the same thing an operator review would do —
and drive it with a fixture provider.
"""

import asyncio
import json
import socket
from collections.abc import Callable, Iterator
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4, uuid5

import pytest
from paxpivot.application.read_models import SourceHealthRead
from paxpivot.application.read_services import list_source_health
from paxpivot.application.result import ApplicationError, Failure, Result, Success
from paxpivot.application.source_checks import (
    SourceCheckOutcome,
    SourceCheckRun,
    run_source_checks,
)
from paxpivot.application.source_gate import authorize_processing
from paxpivot.application.source_pipeline import record_observation
from paxpivot.domain.source import (
    ExtractionState,
    KillSwitch,
    KillSwitchScope,
    PolicyReviewState,
    ProcessingMode,
    Provenance,
    RawPayloadPolicy,
    RetrievalState,
    Source,
    SourceIdentity,
    SourceKind,
    SourceObservation,
    SourceProcessingPolicy,
    SourceState,
)
from paxpivot.domain.terminal import TerminalFactKind, TerminalOperationalFact
from paxpivot.infrastructure import database as db
from paxpivot.infrastructure.bootstrap import DIRECTORY_SOURCE, seed_reference_data
from paxpivot.infrastructure.repositories import (
    SqlKillSwitchRepository,
    SqlSourceObservationRepository,
    SqlSourceRepository,
    SqlTerminalRepository,
)
from paxpivot.tooling import temporary_database
from pydantic import HttpUrl
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.exc import DBAPIError

pytestmark = pytest.mark.integration

APPROVED_ADAPTER = "synthetic-check-adapter"
POLICY_VERSION = "test-only-approved-v1"
SOURCE_NAMESPACE = UUID("11111111-2222-4333-8444-555555555555")
REVIEWED_AT = datetime(2026, 9, 10, 9, 0, tzinfo=UTC)
EPOCH = datetime(2026, 9, 11, 12, 0, tzinfo=UTC)


class NetworkAccessAttemptedError(AssertionError):
    """Raised when a runner test tries to resolve or connect to anything."""


@pytest.fixture(autouse=True)
def no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    """Refuse DNS and TCP connects while these tests run.

    The runner is offline by design. Arming this here means a future change that reaches for the
    network fails loudly instead of quietly making the suite depend on the outside world.
    """

    def refuse(*args: object, **kwargs: object) -> None:
        raise NetworkAccessAttemptedError("the source-check runner must not perform network I/O")

    monkeypatch.setattr(socket, "getaddrinfo", refuse)
    monkeypatch.setattr(socket, "create_connection", refuse)


@pytest.fixture(scope="module")
def engine() -> Iterator[Engine]:
    with temporary_database() as url:
        engine = create_engine(url)
        assert seed_reference_data(engine) == {"sources": 9, "terminals": 4, "policies_upgraded": 0}
        yield engine
        engine.dispose()


def approved_source(label: str) -> Source:
    """A test-only source an operator review would have approved, wired to a fixture adapter.

    Inserted directly because the application deliberately cannot approve a source: enabling a real
    one requires a human reviewer and a policy version (ADR-004).
    """
    return Source(
        identity=SourceIdentity(
            source_id=uuid5(SOURCE_NAMESPACE, label),
            url=HttpUrl(f"https://example.invalid/test-only/{label}"),
            authority="synthetic-authority",
        ),
        name=f"Test-only approved source ({label})",
        kind=SourceKind.TERMINAL_PAGE,
        terminal_id=None,
        enabled=True,
        cadence_minutes=None,
        adapter_id=APPROVED_ADAPTER,
        adapter_version="v0-synthetic",
        policy=SourceProcessingPolicy(
            policy_version_id=POLICY_VERSION,
            review_state=PolicyReviewState.APPROVED,
            may_retrieve=True,
            may_parse=False,
            may_summarize=False,
            may_display=False,
            may_aggregate_history=False,
            raw_payload=RawPayloadPolicy.HASH_ONLY,
            snapshot_retention_days=None,
            reviewer="synthetic-reviewer",
            reviewed_at=REVIEWED_AT,
        ),
        created_at=REVIEWED_AT,
        updated_at=REVIEWED_AT,
    )


def insert_source(engine: Engine, source: Source) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO sources (source_id, url, authority, name, kind, terminal_id, enabled, "
                "cadence_minutes, adapter_id, adapter_version, policy_version_id, review_state, "
                "may_retrieve, may_parse, may_summarize, may_display, may_aggregate_history, "
                "raw_payload, snapshot_retention_days, reviewer, reviewed_at, created_at, "
                "updated_at) VALUES (:source_id, :url, :authority, :name, :kind, NULL, true, "
                "NULL, :adapter_id, :adapter_version, :policy_version_id, 'approved', true, false, "
                "false, false, false, 'hash_only', NULL, 'synthetic-reviewer', :reviewed_at, "
                ":created_at, :updated_at) ON CONFLICT (source_id) DO NOTHING"
            ),
            {
                "source_id": source.identity.source_id,
                "url": str(source.identity.url),
                "authority": source.identity.authority,
                "name": source.name,
                "kind": source.kind.value,
                "adapter_id": source.adapter_id,
                "adapter_version": source.adapter_version,
                "policy_version_id": source.policy.policy_version_id,
                "reviewed_at": source.policy.reviewed_at,
                "created_at": source.created_at,
                "updated_at": source.updated_at,
            },
        )


@pytest.fixture
def make_approved(engine: Engine) -> Callable[[str], Source]:
    """A factory for approved sources with per-test identities."""

    def make(label: str) -> Source:
        source = approved_source(label)
        insert_source(engine, source)
        return source

    return make


def observation_for(
    source: Source,
    state: SourceState,
    observed_at: datetime,
    *,
    retrieval: RetrievalState = RetrievalState.SUCCEEDED,
    reasons: tuple[str, ...] = ("synthetic",),
) -> SourceObservation:
    return SourceObservation(
        observation_id=uuid4(),
        provenance=Provenance(
            source=source.identity,
            observed_at=observed_at,
            source_time=None,
            provider_id=APPROVED_ADAPTER,
            policy_version_id=source.policy.policy_version_id,
        ),
        state=state,
        retrieval=retrieval,
        extraction=ExtractionState.NOT_ATTEMPTED,
        parser_version=None,
        content_hash="synthetic-hash" if retrieval == RetrievalState.SUCCEEDED else None,
        confidence_reasons=reasons,
    )


class FixtureProvider:
    """Metadata-only fixture provider: deterministic identity, one observation per call, no I/O."""

    def __init__(
        self,
        template: Source,
        state: SourceState = SourceState.FRESH,
        *,
        failing: bool = False,
        credentialed_url: bool = False,
        provider_id: str = APPROVED_ADAPTER,
    ) -> None:
        self.template = template
        self.state = state
        self.failing = failing
        self.credentialed_url = credentialed_url
        self.provider_id = provider_id
        # Which sources this provider was actually asked about. A run walks the whole registry,
        # so a global count would include sources other tests registered; the question these
        # tests ask is always about one specific source.
        self.observed: list[UUID] = []

    @property
    def calls(self) -> int:
        return len(self.observed)

    def asked_about(self, source: Source) -> bool:
        return source.identity.source_id in self.observed

    async def observe(self, source: SourceIdentity) -> Result[SourceObservation]:
        self.observed.append(source.source_id)
        if self.failing:
            return Failure(
                error=ApplicationError(
                    code="unavailable",
                    message_key="source_provider.not_configured",
                    retryable=True,
                )
            )
        retrieval = (
            RetrievalState.SUCCEEDED
            if self.state in {SourceState.FRESH, SourceState.NO_DEPARTURES}
            else RetrievalState.FAILED
        )
        if self.credentialed_url:
            # A page identity carrying a query string, which the policy forbids outright because
            # these URLs are persisted and then served to clients. Built through a validated model
            # so the field really is an HttpUrl: `model_copy` skips validation and would leave a
            # plain string whose `.query` is empty, silently defeating the check under test.
            source = SourceIdentity.model_validate(
                {
                    **source.model_dump(),
                    "url": "https://example.invalid/page?api_key=SUPERSECRET",
                }
            )
        registered = self.template.model_copy(update={"identity": source})
        return Success(
            value=observation_for(registered, self.state, datetime.now(UTC), retrieval=retrieval)
        )


def persisted(engine: Engine, table: str) -> int:
    """How many rows `table` currently holds."""
    with engine.connect() as connection:
        value = connection.execute(text(f"SELECT count(*) FROM {table}")).scalar_one()
    return int(value)


def observations_in(engine: Engine) -> int:
    return persisted(engine, "source_observations")


def facts_in(engine: Engine) -> int:
    return persisted(engine, "terminal_facts")


def observations_for(engine: Engine, source: Source) -> int:
    with engine.connect() as connection:
        value = connection.execute(
            text("SELECT count(*) FROM source_observations WHERE source_id = :i"),
            {"i": source.identity.source_id},
        ).scalar_one()
    return int(value)


def check_once(engine: Engine, provider: FixtureProvider, now: datetime) -> SourceCheckRun:
    """One run, committed through the explicit write seam (ADR-004)."""
    with db.transaction(engine) as connection:
        return asyncio.run(
            run_source_checks(
                SqlSourceRepository(connection),
                SqlSourceObservationRepository(connection),
                SqlKillSwitchRepository(connection),
                provider,
                now=now,
            )
        )


def outcome_for(run: SourceCheckRun, source_id: UUID) -> SourceCheckOutcome:
    return next(o for o in run.outcomes if o.source_id == source_id)


def health_now(engine: Engine) -> SourceHealthRead:
    with engine.connect() as connection:
        return list_source_health(
            SqlSourceRepository(connection),
            SqlSourceObservationRepository(connection),
            SqlKillSwitchRepository(connection),
        )


def stored_for(engine: Engine, source: Source) -> list[SourceObservation]:
    with engine.connect() as connection:
        return list(
            SqlSourceObservationRepository(connection).list_for_source(
                source.identity.source_id, limit=50
            )
        )


def test_seed_then_approved_source_then_run_then_health_reports_it(
    engine: Engine, make_approved: Callable[[str], Source]
) -> None:
    """The whole point of the task: seed → approve a source → check it → see it in source health."""
    approved = make_approved("seed-run-health")

    # The seeded world on its own is honest: the directory source permits nothing.
    with engine.connect() as connection:
        stored = SqlSourceRepository(connection).get_source(DIRECTORY_SOURCE.identity.source_id)
    assert stored is not None
    assert authorize_processing(stored, ProcessingMode.RETRIEVE, []).ok is False
    row_before = next(
        r for r in health_now(engine).rows if r.source_id == approved.identity.source_id
    )
    assert row_before.latest is None  # never observed yet

    provider = FixtureProvider(approved, SourceState.FRESH)
    run = check_once(engine, provider, EPOCH)

    # The directory source is skipped (disabled, needs_review, no adapter); the approved one
    # is read.
    skipped = outcome_for(run, DIRECTORY_SOURCE.identity.source_id)
    assert skipped.outcome == "skipped"
    assert skipped.message_key == "source.disabled"
    recorded = outcome_for(run, approved.identity.source_id)
    assert recorded.outcome == "recorded"
    assert recorded.state == SourceState.FRESH
    assert provider.asked_about(approved)

    # Source health — the same read the /advanced route uses — now reports the new observation.
    health = health_now(engine)
    row = next(r for r in health.rows if r.source_id == approved.identity.source_id)
    assert row.latest is not None
    assert row.latest.state == SourceState.FRESH
    # ...and the never-checked seeded source is still reported as never observed.
    assert any(
        r.source_id == DIRECTORY_SOURCE.identity.source_id and r.latest is None for r in health.rows
    )


def test_running_again_appends_a_second_observation_and_never_updates(
    engine: Engine, make_approved: Callable[[str], Source]
) -> None:
    approved = make_approved("running-again")
    provider = FixtureProvider(approved, SourceState.FRESH)
    before = observations_for(engine, approved)

    check_once(engine, provider, EPOCH + timedelta(hours=1))
    assert observations_for(engine, approved) == before + 1  # exactly one appended

    first_history = stored_for(engine, approved)
    assert len(first_history) == 1

    check_once(engine, provider, EPOCH + timedelta(hours=2))
    assert observations_for(engine, approved) == before + 2

    grown = stored_for(engine, approved)
    # History grew; nothing was replaced. Two checks, two rows, the earlier one still present.
    assert len(grown) == 2
    assert {o.observation_id for o in first_history} <= {o.observation_id for o in grown}
    assert provider.calls >= 2


def test_a_retrieval_failure_is_recorded_as_that_state_not_as_absence(
    engine: Engine, make_approved: Callable[[str], Source]
) -> None:
    approved = make_approved("retrieval-failure")
    provider = FixtureProvider(approved, SourceState.UNREACHABLE)
    run = check_once(engine, provider, EPOCH)
    assert outcome_for(run, approved.identity.source_id).outcome == "recorded"

    with engine.connect() as connection:
        latest = SqlSourceObservationRepository(connection).latest_per_source()[
            approved.identity.source_id
        ]
    assert latest.state == SourceState.UNREACHABLE
    assert latest.state.value == "source_unreachable"  # never "no_departures_published"
    assert latest.retrieval == RetrievalState.FAILED


def test_a_provider_failure_stores_nothing(
    engine: Engine, make_approved: Callable[[str], Source]
) -> None:
    approved = make_approved("provider-failure")
    before = observations_for(engine, approved)
    provider = FixtureProvider(approved, failing=True)
    run = check_once(engine, provider, EPOCH)

    outcome = outcome_for(run, approved.identity.source_id)
    assert outcome.outcome == "provider_failure"
    assert outcome.message_key == "source_provider.not_configured"
    assert outcome.state is None
    assert provider.calls >= 1
    assert observations_for(engine, approved) == before == 0
    assert stored_for(engine, approved) == []


def test_a_policy_violation_is_rejected_and_stores_nothing(
    engine: Engine, make_approved: Callable[[str], Source]
) -> None:
    """The provider ran and returned something the policy forbids: nothing may be stored."""
    approved = make_approved("rejected")
    before = observations_for(engine, approved)
    provider = FixtureProvider(approved, credentialed_url=True)
    run = check_once(engine, provider, EPOCH)

    outcome = outcome_for(run, approved.identity.source_id)
    assert outcome.outcome == "rejected"
    assert outcome.message_key == "source.url_carries_credentials"
    assert outcome.state is None
    # The provider really was invoked (this is a rejection, not a skip)...
    assert provider.asked_about(approved)
    # ...and nothing reached the database, so no credentialed URL was persisted.
    assert observations_for(engine, approved) == before == 0
    assert stored_for(engine, approved) == []


def test_a_kill_switch_skips_before_retrieval_and_keeps_history(
    engine: Engine, make_approved: Callable[[str], Source]
) -> None:
    approved = make_approved("kill-switch")
    provider = FixtureProvider(approved, SourceState.FRESH)
    check_once(engine, provider, EPOCH)
    stored_before = observations_for(engine, approved)

    switch = KillSwitch(
        switch_id=uuid4(),
        scope=KillSwitchScope.SOURCE,
        key=str(approved.identity.source_id),
        reason="synthetic_incident",
        engaged_at=EPOCH + timedelta(minutes=30),
        released_at=None,
    )
    with db.transaction(engine) as connection:
        SqlKillSwitchRepository(connection).engage(switch)

    # Snapshot what the provider had been asked for *before* the switch, so the assertion below
    # is about the post-engagement run only.
    asked_before = list(provider.observed)

    run = check_once(engine, provider, EPOCH + timedelta(hours=1))
    outcome = outcome_for(run, approved.identity.source_id)
    assert outcome.outcome == "skipped"
    assert outcome.message_key == "source.kill_switch_engaged"
    # The kill-switched source was not handed to the provider on this run, nothing was appended,
    # and the observation taken before the switch survives.
    assert approved.identity.source_id not in provider.observed[len(asked_before) :]
    assert observations_for(engine, approved) == stored_before

    health = health_now(engine)
    row = next(r for r in health.rows if r.source_id == approved.identity.source_id)
    assert row.kill_switched is True
    assert row.latest is not None
    assert row.latest.state == SourceState.FRESH

    # Release the switch so the registry is left as the other tests expect. A release must not
    # precede the engagement it releases — the schema enforces that — so it uses a later clock.
    with engine.begin() as connection:
        connection.execute(
            text("UPDATE processing_switches SET released_at = :r WHERE switch_id = :i"),
            {"i": switch.switch_id, "r": EPOCH + timedelta(hours=2)},
        )


def test_a_failure_during_the_write_rolls_back_the_whole_run(
    engine: Engine, make_approved: Callable[[str], Source]
) -> None:
    """Commit on success, roll back on failure: a partial run leaves nothing behind."""
    approved = make_approved("rollback")
    before = (observations_in(engine), facts_in(engine))
    uncommitted = observation_for(approved, SourceState.FRESH, EPOCH)
    with engine.connect() as connection:
        terminal_id = connection.execute(
            text("SELECT terminal_id FROM terminals ORDER BY name LIMIT 1")
        ).scalar_one()
    fact = TerminalOperationalFact(
        fact_id=uuid4(),
        terminal_id=terminal_id,
        kind=TerminalFactKind.COUNTER_HOURS,
        value="Synthetic hours",
        provenance=Provenance(
            source=approved.identity,
            observed_at=EPOCH,
            source_time=None,
            provider_id=APPROVED_ADAPTER,
            policy_version_id=approved.policy.policy_version_id,
        ),
        effective_from=None,
        effective_to=None,
        recorded_at=EPOCH,
    )

    with pytest.raises(RuntimeError, match="synthetic failure after the append"):
        with db.transaction(engine) as connection:
            SqlSourceObservationRepository(connection).append(uncommitted)
            SqlTerminalRepository(connection).append_fact(fact)
            raise RuntimeError("synthetic failure after the append")

    # No partial observation and no partial fact survived the rollback.
    assert (observations_in(engine), facts_in(engine)) == before
    assert uncommitted.observation_id not in {
        o.observation_id for o in stored_for(engine, approved)
    }
    with engine.connect() as connection:
        current = SqlTerminalRepository(connection).list_current_facts(terminal_id)
    assert fact.fact_id not in {f.fact_id for f in current}


def test_the_append_only_triggers_are_untouched(
    engine: Engine, make_approved: Callable[[str], Source]
) -> None:
    """The runner adds rows; the database still refuses to rewrite history from any path."""
    approved = make_approved("append-only")
    provider = FixtureProvider(approved, SourceState.FRESH)
    check_once(engine, provider, EPOCH)

    for statement in (
        "UPDATE source_observations SET state = 'withdrawn'",
        "DELETE FROM source_observations",
    ):
        with pytest.raises(DBAPIError, match="append-only"):
            with engine.begin() as connection:
                connection.execute(text(statement))

    # And the row the runner appended is still there, unchanged.
    with engine.connect() as connection:
        latest = SqlSourceObservationRepository(connection).latest_per_source()[
            approved.identity.source_id
        ]
    assert latest.state == SourceState.FRESH


def test_a_run_reports_one_outcome_per_registered_source(
    engine: Engine, make_approved: Callable[[str], Source]
) -> None:
    approved = make_approved("per-source-outcome")
    provider = FixtureProvider(approved, SourceState.FRESH)
    run = check_once(engine, provider, EPOCH)

    with engine.connect() as connection:
        registered = SqlSourceRepository(connection).list_sources()
    assert len(run.outcomes) == len(registered)
    assert {o.source_id for o in run.outcomes} == {s.identity.source_id for s in registered}
    # Every source is accounted for: nothing is silently omitted from a run.
    allowed = {"recorded", "skipped", "rejected", "provider_failure"}
    assert all(o.outcome in allowed for o in run.outcomes)


def test_record_observation_still_refuses_a_foreign_provider(
    engine: Engine, make_approved: Callable[[str], Source]
) -> None:
    """The identity gate holds through the real repository too, not only in fakes."""
    approved = make_approved("foreign-provider")
    provider = FixtureProvider(approved, provider_id="some-other-adapter")
    before = observations_in(engine)
    with db.transaction(engine) as connection:
        result = asyncio.run(
            record_observation(
                approved,
                provider,
                SqlSourceObservationRepository(connection),
                [],
            )
        )
    assert isinstance(result, Failure)
    assert result.error.message_key == "source_provider.identity_mismatch"
    assert provider.calls == 0
    assert observations_in(engine) == before


def test_the_seeded_registry_is_never_silently_read(
    engine: Engine, make_approved: Callable[[str], Source]
) -> None:
    """A `needs_review`, disabled, adapter-less source stays unread however often the run."""
    approved = make_approved("seeded-registry")
    provider = FixtureProvider(approved, SourceState.FRESH)
    before = observations_for(engine, approved)
    for hour in range(3):
        run = check_once(engine, provider, EPOCH + timedelta(hours=hour))
        assert outcome_for(run, DIRECTORY_SOURCE.identity.source_id).outcome == "skipped"
        # The approved source is read each time; the seeded one never is.
        assert outcome_for(run, approved.identity.source_id).outcome == "recorded"
    # Only the approved source's rows appeared: the seeded registry contributed none.
    assert observations_for(engine, approved) == before + 3
    assert observations_for(engine, DIRECTORY_SOURCE) == 0


def test_latest_per_source_is_the_newest_by_observed_at(
    engine: Engine, make_approved: Callable[[str], Source]
) -> None:
    approved = make_approved("latest-per-source")
    older = EPOCH
    newer = older + timedelta(hours=2)
    with db.transaction(engine) as connection:
        repository = SqlSourceObservationRepository(connection)
        repository.append(observation_for(approved, SourceState.FRESH, newer))
        repository.append(observation_for(approved, SourceState.UNREACHABLE, older))
    with engine.connect() as connection:
        latest = SqlSourceObservationRepository(connection).latest_per_source()[
            approved.identity.source_id
        ]
    assert latest.provenance.observed_at == newer
    assert latest.state == SourceState.FRESH


def test_the_write_seam_runs_at_repeatable_read(engine: Engine) -> None:
    """The isolation decision is real, not just documented."""
    with engine.connect() as connection:
        configured = connection.execution_options(isolation_level="REPEATABLE READ")
        with configured.begin():
            level = configured.execute(text("SHOW transaction_isolation")).scalar_one()
    assert level == "repeatable read"


def test_the_network_guard_is_actually_armed() -> None:
    with pytest.raises(NetworkAccessAttemptedError):
        socket.getaddrinfo("example.invalid", 443)
    with pytest.raises(NetworkAccessAttemptedError):
        socket.create_connection(("example.invalid", 443))


def test_firecrawl_provider_records_fresh_metadata_through_the_runner(engine: Engine) -> None:
    """TASK-025: an approved page becomes a `fresh` metadata observation in source health."""
    import asyncio

    import httpx
    from paxpivot.application.read_services import list_source_health
    from paxpivot.application.source_checks import run_source_checks
    from paxpivot.domain.source import SourceState
    from paxpivot.infrastructure import database as db
    from paxpivot.infrastructure.bootstrap import SCHEDULE_ARTIFACT_SOURCES
    from paxpivot.infrastructure.providers.firecrawl import FirecrawlSourceProvider
    from paxpivot.infrastructure.repositories import (
        SqlKillSwitchRepository,
        SqlSourceObservationRepository,
        SqlSourceRepository,
    )

    # Every terminal page links each terminal's 72-hour artifact; artifacts render as markdown.
    links = "".join(
        f'<a href="{s.identity.url}72HR%20SEP11.pdf?ver=1">72</a>'
        for s in SCHEDULE_ARTIFACT_SOURCES
    )

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        if body["formats"] == ["markdown"]:
            data: dict[str, object] = {"markdown": "| 12 SEP | 0600 | X | 10T |"}
        else:
            data = {"rawHtml": f"<p>BODY-MARKER-9f3a</p>{links}"}
        return httpx.Response(
            200, json={"success": True, "data": {**data, "metadata": {"statusCode": 200}}}
        )

    with db.transaction(engine) as connection:
        sources = SqlSourceRepository(connection)
        registry = {s.identity.source_id: s for s in sources.list_sources()}
        approved = [s for s in registry.values() if s.adapter_id == "firecrawl" and s.enabled]
        assert len(approved) == 8  # four terminal pages (TASK-023) + four artifacts (TASK-037)
        provider = FirecrawlSourceProvider(
            "k-synthetic", registry, transport=httpx.MockTransport(handler)
        )
        run = asyncio.run(
            run_source_checks(
                sources,
                SqlSourceObservationRepository(connection),
                SqlKillSwitchRepository(connection),
                provider,
            )
        )
    recorded = {o.source_id for o in run.recorded}
    assert recorded == {s.identity.source_id for s in approved}
    with db.read_snapshot(engine) as connection:
        health = list_source_health(
            SqlSourceRepository(connection),
            SqlSourceObservationRepository(connection),
            SqlKillSwitchRepository(connection),
        )
    rows = {r.source_id: r for r in health.rows}
    for s in approved:
        latest = rows[s.identity.source_id].latest
        assert latest is not None and latest.state == SourceState.FRESH
        assert latest.source_time is None and latest.parser_version is None
    assert "BODY-MARKER-9f3a" not in health.model_dump_json()
    assert "12 SEP" not in health.model_dump_json()  # the artifact text is hashed, never kept
    with engine.connect() as connection:
        stored = connection.execute(text("SELECT * FROM source_observations")).mappings().all()
    assert "BODY-MARKER-9f3a" not in repr([dict(r) for r in stored])
    assert "12 SEP" not in repr([dict(r) for r in stored])
