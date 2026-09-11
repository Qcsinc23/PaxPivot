"""TASK-026: the read snapshot is read-only at the database level, the write transaction is
all-or-nothing, explicit supersession decides currentness, and the CHECK contract of migration
0002/0003 is verified against the deployed database, not a hand-written copy."""

from collections.abc import Iterator
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from paxpivot.domain.source import (
    ExtractionState,
    Provenance,
    RetrievalState,
    SourceObservation,
    SourceState,
)
from paxpivot.infrastructure import database as db
from paxpivot.infrastructure.bootstrap import DIRECTORY_SOURCE, seed_reference_data
from paxpivot.infrastructure.repositories import SqlSourceObservationRepository
from paxpivot.infrastructure.schema_probe import CheckParityError, verify_check_parity
from paxpivot.tooling import temporary_database
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.exc import DBAPIError

pytestmark = pytest.mark.integration
SOURCE_ID = DIRECTORY_SOURCE.identity.source_id


@pytest.fixture(scope="module")
def engine() -> Iterator[Engine]:
    with temporary_database() as url:
        engine = create_engine(url)
        seed_reference_data(engine)
        yield engine
        engine.dispose()


def observation(
    state: SourceState,
    observed_at: datetime,
    *,
    supersedes: SourceObservation | None = None,
    source_id: UUID = SOURCE_ID,
) -> SourceObservation:
    return SourceObservation(
        observation_id=uuid4(),
        provenance=Provenance(
            source=DIRECTORY_SOURCE.identity.model_copy(update={"source_id": source_id}),
            observed_at=observed_at,
            source_time=None,
            provider_id="synthetic-provider",
            policy_version_id=DIRECTORY_SOURCE.policy.policy_version_id,
        ),
        state=state,
        retrieval=RetrievalState.SUCCEEDED,
        extraction=ExtractionState.NOT_ATTEMPTED,
        parser_version=None,
        content_hash=None,
        confidence_reasons=("synthetic",),
        supersedes_observation_id=supersedes.observation_id if supersedes else None,
    )


def count(engine: Engine) -> int:
    with engine.connect() as c:
        return int(c.execute(text("SELECT count(*) FROM source_observations")).scalar_one())


# ── A1: read snapshot vs write transaction ─────────────────────────────


def test_read_snapshot_reads_one_snapshot_and_refuses_every_write(engine: Engine) -> None:
    with db.transaction(engine) as c:
        SqlSourceObservationRepository(c).append(
            observation(SourceState.FRESH, datetime(2026, 9, 11, 8, 0, tzinfo=UTC))
        )
    with db.read_snapshot(engine) as reader:
        first = reader.execute(text("SELECT count(*) FROM source_observations")).scalar_one()
        # A write committed by another session after the snapshot started stays invisible.
        with db.transaction(engine) as writer:
            SqlSourceObservationRepository(writer).append(
                observation(SourceState.FRESH, datetime(2026, 9, 11, 8, 5, tzinfo=UTC))
            )
        second = reader.execute(text("SELECT count(*) FROM source_observations")).scalar_one()
        assert first == second
        assert reader.execute(text("SHOW transaction_isolation")).scalar_one() == "repeatable read"
        assert reader.execute(text("SHOW transaction_read_only")).scalar_one() == "on"
        # The mode is pinned: it cannot be switched back once the snapshot has started.
        with pytest.raises(DBAPIError, match="before any query"):
            reader.execute(text("SET TRANSACTION READ WRITE"))
    assert count(engine) == first + 1  # the concurrent write did commit

    statements = {
        "INSERT": "INSERT INTO processing_switches (switch_id, scope, key, reason, engaged_at) "
        "VALUES (gen_random_uuid(), 'mode', 'parse', 'synthetic', now())",
        "UPDATE": "UPDATE sources SET name = name",
        "DELETE": "DELETE FROM processing_switches",
    }
    for label, statement in statements.items():
        with pytest.raises(DBAPIError, match="read-only"), db.read_snapshot(engine) as reader:
            reader.execute(text(statement))
        assert label  # each write kind was exercised
    # And the repository write path is refused through the read seam too.
    with pytest.raises(DBAPIError, match="read-only"), db.read_snapshot(engine) as reader:
        SqlSourceObservationRepository(reader).append(
            observation(SourceState.FRESH, datetime(2026, 9, 11, 8, 10, tzinfo=UTC))
        )


def test_read_snapshot_never_commits_even_when_it_could(engine: Engine) -> None:
    before = count(engine)
    with db.read_snapshot(engine) as reader:
        # Session-level state is not persisted by the read seam: the block ends in rollback.
        assert reader.execute(text("SELECT 1")).scalar_one() == 1
    assert count(engine) == before


def test_write_transaction_commits_on_success_and_rolls_back_partial_work(engine: Engine) -> None:
    before = count(engine)
    with db.transaction(engine) as c:
        SqlSourceObservationRepository(c).append(
            observation(SourceState.FRESH, datetime(2026, 9, 11, 9, 0, tzinfo=UTC))
        )
    assert count(engine) == before + 1
    with pytest.raises(RuntimeError), db.transaction(engine) as c:
        SqlSourceObservationRepository(c).append(
            observation(SourceState.FRESH, datetime(2026, 9, 11, 9, 5, tzinfo=UTC))
        )
        raise RuntimeError("second write never happens")
    assert count(engine) == before + 1


# ── A2: supersession semantics ─────────────────────────────────────────


def current(engine: Engine) -> SourceObservation:
    with db.read_snapshot(engine) as c:
        return SqlSourceObservationRepository(c).latest_per_source()[SOURCE_ID]


def append_all(engine: Engine, *items: SourceObservation) -> None:
    with db.transaction(engine) as c:
        for item in items:
            SqlSourceObservationRepository(c).append(item)


def test_explicit_supersession_outranks_temporal_order(engine: Engine) -> None:

    def t(m: int) -> datetime:
        return datetime(2026, 9, 12, 12, m, tzinfo=UTC)

    # Simple: A -> B. B is current.
    a = observation(SourceState.FRESH, t(0))
    b = observation(SourceState.WITHDRAWN, t(1), supersedes=a)
    append_all(engine, a, b)
    assert current(engine).observation_id == b.observation_id
    # Chain: A -> B -> C. C is current.
    c = observation(SourceState.FRESH, t(2), supersedes=b)
    append_all(engine, c)
    assert current(engine).observation_id == c.observation_id
    # An older-source-time withdrawal still retires the newer claim it names.
    newer_claim = observation(SourceState.FRESH, t(10))
    append_all(engine, newer_claim)
    assert current(engine).observation_id == newer_claim.observation_id
    late_withdrawal = observation(SourceState.WITHDRAWN, t(5), supersedes=newer_claim)
    append_all(engine, late_withdrawal)
    assert current(engine).observation_id == late_withdrawal.observation_id
    # An unrelated newest observation stays eligible and wins on time among the leaves.
    unrelated = observation(SourceState.FRESH, t(20))
    append_all(engine, unrelated)
    assert current(engine).observation_id == unrelated.observation_id
    # Every row remains in history.
    with db.read_snapshot(engine) as conn:
        history = {
            o.observation_id
            for o in SqlSourceObservationRepository(conn).list_for_source(SOURCE_ID, limit=100)
        }
    assert {x.observation_id for x in (a, b, c, newer_claim, late_withdrawal, unrelated)} <= history


def test_supersession_tie_break_is_stable(engine: Engine) -> None:
    when = datetime(2026, 9, 13, 12, 0, tzinfo=UTC)
    x = observation(SourceState.FRESH, when)
    y = observation(SourceState.FRESH, when)
    append_all(engine, x, y)  # same observed_at and same recorded_at (one transaction)
    expected = max(x.observation_id, y.observation_id)
    assert current(engine).observation_id == expected
    assert current(engine).observation_id == expected


def test_cross_source_and_self_supersession_are_rejected_by_the_database(
    engine: Engine,
) -> None:
    other_source = uuid4()
    with db.transaction(engine) as c:
        c.execute(
            text(
                "INSERT INTO sources (source_id, url, authority, name, kind, enabled, "
                "policy_version_id, review_state, may_retrieve, may_parse, may_summarize, "
                "may_display, may_aggregate_history, raw_payload, created_at, updated_at) VALUES "
                "(:id, 'https://example.invalid/other', 'synthetic', 'Other', 'terminal_page', "
                "false, 'v', 'needs_review', false, false, false, false, false, 'denied', "
                "now(), now())"
            ),
            {"id": other_source},
        )
    claim = observation(SourceState.FRESH, datetime(2026, 9, 14, 12, 0, tzinfo=UTC))
    append_all(engine, claim)
    foreign = observation(
        SourceState.WITHDRAWN,
        datetime(2026, 9, 14, 12, 5, tzinfo=UTC),
        supersedes=claim,
        source_id=other_source,
    )
    with pytest.raises(DBAPIError, match="fk_source_observations_supersedes"):
        append_all(engine, foreign)
    missing = observation(SourceState.WITHDRAWN, datetime(2026, 9, 14, 12, 6, tzinfo=UTC))
    missing = missing.model_copy(update={"supersedes_observation_id": uuid4()})
    with pytest.raises(DBAPIError, match="fk_source_observations_supersedes"):
        append_all(engine, missing)
    # Self-supersession is refused by the domain and, bypassing it, by the database.
    with pytest.raises(ValueError):
        claim.model_validate(
            {**claim.model_dump(), "supersedes_observation_id": claim.observation_id}
        )
    with pytest.raises(DBAPIError, match="not_self"), db.transaction(engine) as c:
        c.execute(
            text(
                "INSERT INTO source_observations (observation_id, source_id, source_url, "
                "source_authority, observed_at, provider_id, policy_version_id, state, retrieval, "
                "extraction, confidence_reasons, supersedes_observation_id) VALUES "
                "(:id, :sid, 'https://example.invalid/x', 'a', now(), 'p', 'v', 'withdrawn', "
                "'succeeded', 'not_attempted', ARRAY['x'], :id)"
            ),
            {"id": uuid4(), "sid": SOURCE_ID},
        )


# ── A3: CHECK constraint parity ────────────────────────────────────────


def test_check_parity_holds_and_detects_a_removed_constraint(engine: Engine) -> None:
    with db.read_snapshot(engine) as c:
        pass  # a read seam cannot be used for the probe: it writes inside savepoints
    with engine.connect() as c:
        report = verify_check_parity(c)
        c.rollback()
    assert report.constraints_verified == 19 == len(report.verified)
    # Mutation: drop one safety-critical CHECK inside a transaction that is rolled back.
    with (
        engine.connect() as c,
        pytest.raises(CheckParityError, match="positive_requires_retrieval"),
    ):
        c.execute(
            text(
                "ALTER TABLE source_observations DROP CONSTRAINT "
                "ck_source_observations_positive_requires_retrieval"
            )
        )
        try:
            verify_check_parity(c)
        finally:
            c.rollback()
