"""Persistence proof for the Sources + Terminals slice against a real migrated database:
seed idempotence, append-only observations (trigger), unknown source time, failed
retrieval, latest-per-source, current facts, kill switches, and the API over the real
composition root."""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from paxpivot.api import app, get_authenticator, get_engine
from paxpivot.application.read_services import list_source_health, list_terminal_network
from paxpivot.application.source_gate import authorize_processing
from paxpivot.domain.source import (
    ExtractionState,
    KillSwitch,
    KillSwitchScope,
    ProcessingMode,
    Provenance,
    RetrievalState,
    SourceObservation,
    SourceState,
)
from paxpivot.domain.terminal import TerminalFactKind, TerminalOperationalFact
from paxpivot.infrastructure import database as db
from paxpivot.infrastructure.auth import BearerTokenAuthenticator
from paxpivot.infrastructure.bootstrap import (
    DIRECTORY_SOURCE,
    REFERENCE_TERMINALS,
    seed_reference_data,
)
from paxpivot.infrastructure.repositories import (
    SqlKillSwitchRepository,
    SqlSourceObservationRepository,
    SqlSourceRepository,
    SqlTerminalRepository,
)
from paxpivot.tooling import temporary_database
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.exc import DBAPIError

pytestmark = pytest.mark.integration
TOKEN = "synthetic-token-with-at-least-32-characters"


def _observation_count(engine: Engine) -> int:
    with engine.connect() as connection:
        return connection.execute(text("SELECT count(*) FROM source_observations")).scalar_one()


def _fact_count(engine: Engine) -> int:
    with engine.connect() as connection:
        return connection.execute(text("SELECT count(*) FROM terminal_facts")).scalar_one()


@pytest.fixture(scope="module")
def engine() -> Iterator[Engine]:
    with temporary_database() as url:
        engine = create_engine(url)
        assert seed_reference_data(engine) == {"sources": 1, "terminals": 4}
        assert seed_reference_data(engine) == {"sources": 0, "terminals": 0}
        yield engine
        engine.dispose()


def observation(
    state: SourceState,
    observed_at: datetime,
    *,
    source_time: datetime | None = None,
    retrieval: RetrievalState = RetrievalState.SUCCEEDED,
) -> SourceObservation:
    return SourceObservation(
        observation_id=uuid4(),
        provenance=Provenance(
            source=DIRECTORY_SOURCE.identity,
            observed_at=observed_at,
            source_time=source_time,
            provider_id="synthetic-provider",
            policy_version_id=DIRECTORY_SOURCE.policy.policy_version_id,
        ),
        state=state,
        retrieval=retrieval,
        extraction=ExtractionState.NOT_ATTEMPTED,
        parser_version=None,
        content_hash="hash" if retrieval == RetrievalState.SUCCEEDED else None,
        confidence_reasons=("synthetic",),
    )


def test_seed_is_metadata_only_and_not_fresh(engine: Engine) -> None:
    with engine.connect() as connection:
        terminals = SqlTerminalRepository(connection).list_terminals()
        sources = SqlSourceRepository(connection).list_sources()
        assert len(terminals) == 4 and len(sources) == 1
        for terminal in terminals:
            assert terminal.entrance is None and terminal.base_coordinates is None
            assert terminal.operational_state == "unknown"
            assert terminal.evidence.source_time is None
        source = sources[0]
        assert source.policy.review_state == "needs_review" and not source.enabled
        for mode in ProcessingMode:
            assert not authorize_processing(source, mode, []).ok
        network = list_terminal_network(
            SqlTerminalRepository(connection),
            SqlSourceRepository(connection),
            SqlSourceObservationRepository(connection),
        )
        assert all(t.latest is None and t.entrance is None for t in network.terminals)


def test_observations_are_append_only_and_keep_unknowns(engine: Engine) -> None:
    t1 = datetime(2026, 9, 10, 10, 0, tzinfo=UTC)
    older = observation(SourceState.FRESH, t1, source_time=None)
    failed = observation(
        SourceState.UNREACHABLE, t1 + timedelta(hours=1), retrieval=RetrievalState.FAILED
    )
    newest = observation(
        SourceState.FRESH, t1 + timedelta(hours=2), source_time=t1 + timedelta(hours=1)
    )
    with engine.begin() as connection:
        repo = SqlSourceObservationRepository(connection)
        for item in (older, failed, newest):
            repo.append(item)
    with engine.connect() as connection:
        repo = SqlSourceObservationRepository(connection)
        history = repo.list_for_source(DIRECTORY_SOURCE.identity.source_id, limit=10)
        assert [o.observation_id for o in history] == [
            newest.observation_id,
            failed.observation_id,
            older.observation_id,
        ]
        assert history[2].provenance.source_time is None  # Unknown was not backfilled.
        assert history[1].retrieval == RetrievalState.FAILED
        assert history[1].state == SourceState.UNREACHABLE
        latest = repo.latest_per_source()[DIRECTORY_SOURCE.identity.source_id]
        assert latest == newest
        health = list_source_health(
            SqlSourceRepository(connection), repo, SqlKillSwitchRepository(connection)
        )
        assert health.counts[0].state == SourceState.FRESH and health.never_observed == 0
    # The database itself refuses rewrites of history, whatever the caller.
    for statement in (
        "UPDATE source_observations SET state = 'no_departures_published'",
        "DELETE FROM source_observations",
    ):
        with pytest.raises(DBAPIError, match="append-only"), engine.begin() as connection:
            connection.execute(text(statement))
    with engine.connect() as connection:
        assert (
            len(
                SqlSourceObservationRepository(connection).list_for_source(
                    DIRECTORY_SOURCE.identity.source_id, limit=10
                )
            )
            == 3
        )
    # Constraints: a positive state without successful retrieval is rejected by the database.
    with pytest.raises(DBAPIError), engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO source_observations (observation_id, source_id, source_url, "
                "source_authority, observed_at, provider_id, policy_version_id, state, "
                "retrieval, extraction, confidence_reasons) VALUES (:id, :sid, 'u', 'a', now(), "
                "'p', 'v', 'fresh', 'failed', 'not_attempted', ARRAY['x'])"
            ),
            {"id": uuid4(), "sid": DIRECTORY_SOURCE.identity.source_id},
        )


def test_terminal_facts_keep_history_and_report_the_current_one(engine: Engine) -> None:
    terminal = REFERENCE_TERMINALS[0]
    t1 = datetime(2026, 9, 10, 10, 0, tzinfo=UTC)

    def fact(
        value: str, recorded_at: datetime, effective_to: datetime | None = None
    ) -> TerminalOperationalFact:
        return TerminalOperationalFact(
            fact_id=uuid4(),
            terminal_id=terminal.terminal_id,
            kind=TerminalFactKind.COUNTER_HOURS,
            value=value,
            provenance=Provenance(
                source=DIRECTORY_SOURCE.identity,
                observed_at=recorded_at,
                source_time=None,
                provider_id="synthetic-provider",
                policy_version_id="v",
            ),
            effective_from=None,
            effective_to=effective_to,
            recorded_at=recorded_at,
        )

    with engine.begin() as connection:
        repo = SqlTerminalRepository(connection)
        repo.append_fact(fact("synthetic hours v1", t1))
        repo.append_fact(fact("synthetic hours v2", t1 + timedelta(days=1)))
        repo.append_fact(
            fact("closed window", t1 + timedelta(days=2), effective_to=t1 + timedelta(days=3))
        )
    with engine.connect() as connection:
        current = SqlTerminalRepository(connection).list_current_facts(terminal.terminal_id)
        assert [f.value for f in current] == ["synthetic hours v2"]
        assert connection.execute(text("SELECT count(*) FROM terminal_facts")).scalar() == 3
    with pytest.raises(DBAPIError, match="append-only"), engine.begin() as connection:
        connection.execute(text("DELETE FROM terminal_facts"))


def test_kill_switch_blocks_processing_without_touching_history(engine: Engine) -> None:
    with engine.begin() as connection:
        SqlKillSwitchRepository(connection).engage(
            KillSwitch(
                switch_id=uuid4(),
                scope=KillSwitchScope.MODE,
                key="retrieve",
                reason="synthetic_incident",
                engaged_at=datetime.now(UTC),
                released_at=None,
            )
        )
    with engine.connect() as connection:
        switches = SqlKillSwitchRepository(connection).list_engaged()
        source = SqlSourceRepository(connection).list_sources()[0]
        denied = authorize_processing(source, ProcessingMode.RETRIEVE, switches)
        assert not denied.ok and denied.error.message_key == "source.kill_switch_engaged"
        health = list_source_health(
            SqlSourceRepository(connection),
            SqlSourceObservationRepository(connection),
            SqlKillSwitchRepository(connection),
        )
        assert health.rows[0].kill_switched is True
        assert health.rows[0].latest is not None  # History untouched.


def test_api_over_the_real_composition_root(engine: Engine) -> None:
    app.dependency_overrides[get_engine] = lambda: engine
    app.dependency_overrides[get_authenticator] = lambda: BearerTokenAuthenticator(TOKEN)
    try:
        client = TestClient(app)
        assert client.get("/api/v1/terminals").status_code == 401
        headers = {"Authorization": f"Bearer {TOKEN}"}
        network = client.get("/api/v1/terminals", headers=headers)
        assert network.status_code == 200 and len(network.json()["terminals"]) == 4
        terminal_id = network.json()["terminals"][0]["terminal_id"]
        detail = client.get(f"/api/v1/terminals/{terminal_id}", headers=headers)
        assert detail.status_code == 200 and detail.json()["summary"]["entrance"] is None
        health = client.get("/api/v1/sources/health", headers=headers)
        assert health.status_code == 200 and health.json()["rows"][0]["kill_switched"] is True
        assert "content_hash" not in health.text and "payload_ref" not in health.text
    finally:
        app.dependency_overrides.clear()


def test_superseded_observation_is_not_current(engine: Engine) -> None:
    """Supersession precedence (ADR-004): a retraction retires the claim it names.

    ``stale`` is a claim; ``withdrawal`` is recorded after it and names it in
    ``supersedes_observation_id``; ``original`` arrives later still. The current row is the
    newest claim, and the retracted one is never it — the retirement is recorded at or after the
    claim it names, so it already outranks that claim in the order ``latest_per_source`` uses.
    An out-of-order withdrawal (one carrying an older ``observed_at`` than the claim it names) is
    deliberately inert: a source cannot retract a claim it had not yet made. Every row stays
    stored, because supersession is history, not mutation.
    """
    source_id = DIRECTORY_SOURCE.identity.source_id
    stale = observation(SourceState.FRESH, datetime(2026, 9, 11, 12, 0, tzinfo=UTC))
    # Recorded before the newer claim that follows, and older than it.
    withdrawal = observation(
        SourceState.WITHDRAWN, datetime(2026, 9, 11, 12, 30, tzinfo=UTC)
    ).model_copy(update={"supersedes_observation_id": stale.observation_id})
    original = observation(SourceState.FRESH, datetime(2026, 9, 11, 12, 50, tzinfo=UTC))

    with engine.begin() as connection:
        repo = SqlSourceObservationRepository(connection)
        for item in (stale, withdrawal, original):
            repo.append(item)

    with engine.connect() as connection:
        repo = SqlSourceObservationRepository(connection)
        history = repo.list_for_source(source_id, limit=10)
        assert {o.observation_id for o in history} >= {
            stale.observation_id,
            withdrawal.observation_id,
            original.observation_id,
        }

        latest = repo.latest_per_source()[source_id]
        # Not the retracted claim; the surviving claim is the one that is current.
        assert latest.observation_id != stale.observation_id
        assert latest.observation_id == original.observation_id

        health = list_source_health(
            SqlSourceRepository(connection), repo, SqlKillSwitchRepository(connection)
        )
        assert health.rows[0].latest is not None
        assert health.rows[0].latest.state == SourceState.FRESH


def test_a_withdrawal_retires_only_the_claim_it_names(engine: Engine) -> None:
    """Supersession is per-claim: an unnamed claim keeps its place in the ordering."""
    source_id = DIRECTORY_SOURCE.identity.source_id
    retired = observation(SourceState.FRESH, datetime(2026, 9, 11, 14, 0, tzinfo=UTC))
    unnamed = observation(SourceState.FRESH, datetime(2026, 9, 11, 14, 30, tzinfo=UTC))
    withdrawal = observation(
        SourceState.WITHDRAWN, datetime(2026, 9, 11, 14, 10, tzinfo=UTC)
    ).model_copy(update={"supersedes_observation_id": retired.observation_id})

    with engine.begin() as connection:
        repo = SqlSourceObservationRepository(connection)
        for item in (retired, unnamed, withdrawal):
            repo.append(item)

    with engine.connect() as connection:
        repo = SqlSourceObservationRepository(connection)
        rows = repo.list_for_source(source_id, limit=10)
        by_id = {o.observation_id: o for o in rows}
        # The named claim is retired; the claim the withdrawal does not name keeps its standing.
        assert by_id[retired.observation_id].state == SourceState.FRESH
        assert by_id[unnamed.observation_id].state == SourceState.FRESH
        latest = repo.latest_per_source()[source_id]
        assert latest.observation_id == unnamed.observation_id


def test_write_transaction_commits_only_when_the_unit_of_work_succeeds(engine: Engine) -> None:
    """The write seam (ADR-004): commit on success, roll back on failure, no partial row."""
    before = _observation_count(engine)
    committed = observation(SourceState.FRESH, datetime(2026, 9, 11, 14, 0, tzinfo=UTC))
    with db.transaction(engine) as connection:
        SqlSourceObservationRepository(connection).append(committed)
    assert _observation_count(engine) == before + 1
    with engine.connect() as connection:
        repo = SqlSourceObservationRepository(connection)
        assert committed.observation_id in {
            o.observation_id
            for o in repo.list_for_source(DIRECTORY_SOURCE.identity.source_id, limit=50)
        }


def test_write_transaction_rolls_back_the_whole_unit_of_work(engine: Engine) -> None:
    """A failure partway through leaves nothing behind: no partial observation or fact."""
    before_observations = _observation_count(engine)
    before_facts = _fact_count(engine)
    rolled_back = observation(SourceState.FRESH, datetime(2026, 9, 11, 15, 0, tzinfo=UTC))
    with pytest.raises(RuntimeError, match="synthetic write failure"):
        with db.transaction(engine) as connection:
            SqlSourceObservationRepository(connection).append(rolled_back)
            SqlTerminalRepository(connection).append_fact(
                TerminalOperationalFact(
                    fact_id=uuid4(),
                    terminal_id=REFERENCE_TERMINALS[0].terminal_id,
                    kind=TerminalFactKind.COUNTER_HOURS,
                    value="Synthetic hours",
                    provenance=Provenance(
                        source=DIRECTORY_SOURCE.identity,
                        observed_at=datetime(2026, 9, 11, 15, 0, tzinfo=UTC),
                        source_time=None,
                        provider_id="synthetic-provider",
                        policy_version_id=DIRECTORY_SOURCE.policy.policy_version_id,
                    ),
                    effective_from=None,
                    effective_to=None,
                    recorded_at=datetime(2026, 9, 11, 15, 0, tzinfo=UTC),
                )
            )
            raise RuntimeError("synthetic write failure")
    # Both writes in the failed unit of work are gone; nothing partial survived.
    assert _observation_count(engine) == before_observations
    assert _fact_count(engine) == before_facts
    with engine.connect() as connection:
        repo = SqlSourceObservationRepository(connection)
        stored = repo.list_for_source(DIRECTORY_SOURCE.identity.source_id, limit=50)
        assert rolled_back.observation_id not in {o.observation_id for o in stored}


def test_append_only_triggers_still_reject_update_and_delete(engine: Engine) -> None:
    """The rollback above is Python-side; the database still refuses history rewrites."""
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO source_observations (observation_id, source_id, source_url, "
                "source_authority, observed_at, provider_id, policy_version_id, state, "
                "retrieval, extraction, confidence_reasons) VALUES "
                "(:oid, :sid, 'https://example.invalid/x', 'synthetic', now(), "
                "'synthetic-provider', :pv, 'fresh', 'succeeded', 'not_attempted', "
                "ARRAY['synthetic'])"
            ),
            {
                "oid": uuid4(),
                "sid": DIRECTORY_SOURCE.identity.source_id,
                "pv": DIRECTORY_SOURCE.policy.policy_version_id,
            },
        )
    for statement in (
        "UPDATE source_observations SET state = 'withdrawn'",
        "DELETE FROM source_observations",
    ):
        with pytest.raises(DBAPIError, match="append-only"):
            with engine.begin() as connection:
                connection.execute(text(statement))
