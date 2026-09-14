"""Persistence proof for the private traveler/party profile (TASK-050) against a real migrated
database: migration 0006 reaches head, the singleton/CHECK/FK rules hold, the party-size-cap
trigger rejects a bulk violation, replace is atomic, and the table carries no sensitive column."""

from collections.abc import Iterator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from paxpivot.api import app, get_authenticator, get_engine
from paxpivot.domain.eligibility import PartyFacts, TravelerFacts
from paxpivot.domain.profile import UNASSIGNED_TRAVELER_CLASS
from paxpivot.infrastructure import database as db
from paxpivot.infrastructure.auth import BearerTokenAuthenticator
from paxpivot.infrastructure.database import migration_head
from paxpivot.infrastructure.repositories import SqlProfileRepository
from paxpivot.tooling import temporary_database
from sqlalchemy import Engine, create_engine, inspect, text
from sqlalchemy.exc import IntegrityError

pytestmark = pytest.mark.integration
TOKEN = "synthetic-token-with-at-least-32-characters"


@pytest.fixture
def engine() -> Iterator[Engine]:
    with temporary_database() as url:
        engine = create_engine(url)
        yield engine
        engine.dispose()


def sponsor(**overrides: object) -> TravelerFacts:
    data: dict[str, object] = {
        "traveler_id": uuid4(),
        "role": "sponsor",
        "traveler_class": UNASSIGNED_TRAVELER_CLASS,
        "category_attestation": "VI",
        "age_band": "adult",
        "sponsor_id": None,
        "accompanied": None,
    }
    return TravelerFacts.model_validate({**data, **overrides})


def dependent(sponsor_id: object, **overrides: object) -> TravelerFacts:
    data: dict[str, object] = {
        "traveler_id": uuid4(),
        "role": "dependent",
        "traveler_class": UNASSIGNED_TRAVELER_CLASS,
        "category_attestation": "unknown",
        "age_band": "under_14",
        "sponsor_id": sponsor_id,
        "accompanied": None,
    }
    return TravelerFacts.model_validate({**data, **overrides})


def test_migration_reaches_head(engine: Engine) -> None:
    with engine.connect() as connection:
        from alembic.runtime.migration import MigrationContext

        current = set(MigrationContext.configure(connection).get_current_heads())
    assert current == migration_head()


def test_profile_and_profile_travelers_carry_no_sensitive_column(engine: Engine) -> None:
    """PRV-001, enforced by schema: assert the exact column set, not just docs."""
    inspector = inspect(engine)
    profile_columns = {c["name"] for c in inspector.get_columns("profile")}
    assert profile_columns == {"profile_id", "singleton", "created_at", "updated_at"}
    traveler_columns = {c["name"] for c in inspector.get_columns("profile_travelers")}
    assert traveler_columns == {
        "traveler_id",
        "profile_id",
        "role",
        "category_attestation",
        "age_band",
        "sponsor_id",
    }
    forbidden = {"name", "ssn", "dod_id", "disability", "birth", "document", "image", "notes"}
    assert forbidden.isdisjoint(profile_columns | traveler_columns)


def test_get_party_is_unset_until_a_replace(engine: Engine) -> None:
    with db.read_snapshot(engine) as c:
        assert SqlProfileRepository(c).get_party() is None


def test_replace_then_get_round_trips_and_reconstructs_the_explicit_placeholders(
    engine: Engine,
) -> None:
    s = sponsor()
    d = dependent(s.traveler_id)
    party = PartyFacts(travelers=(s, d))
    with db.transaction(engine) as c:
        SqlProfileRepository(c).replace(party)
    with db.read_snapshot(engine) as c:
        read = SqlProfileRepository(c).get_party()
    assert read is not None
    by_id = {t.traveler_id: t for t in read.travelers}
    assert by_id[s.traveler_id].category_attestation == "VI"
    assert by_id[d.traveler_id].sponsor_id == s.traveler_id
    assert by_id[d.traveler_id].age_band == "under_14"
    # Neither field this table stores is guessed; both come back as the same explicit markers.
    for traveler in by_id.values():
        assert traveler.traveler_class == UNASSIGNED_TRAVELER_CLASS
        assert traveler.accompanied is None

    # A second replace is a true whole-party swap: the old dependent is gone.
    s2 = sponsor()
    with db.transaction(engine) as c:
        SqlProfileRepository(c).replace(PartyFacts(travelers=(s2,)))
    with db.read_snapshot(engine) as c:
        after = SqlProfileRepository(c).get_party()
    assert after is not None
    assert {t.traveler_id for t in after.travelers} == {s2.traveler_id}
    # The singleton profile row itself is reused, not duplicated, across replaces.
    with engine.connect() as c:
        assert c.execute(text("SELECT count(*) FROM profile")).scalar_one() == 1


def test_replace_is_atomic_and_the_party_size_cap_trigger_rejects_a_bulk_violation(
    engine: Engine,
) -> None:
    s = sponsor()
    d = dependent(s.traveler_id)
    baseline = PartyFacts(travelers=(s, d))
    with db.transaction(engine) as c:
        SqlProfileRepository(c).replace(baseline)

    # PartyFacts itself has no upper bound (only NewParty does); ten cross-reference-valid
    # travelers exercise the database's own backstop directly, bypassing the API layer.
    oversized = PartyFacts(
        travelers=(s, *(dependent(s.traveler_id) for _ in range(9))),
    )
    with pytest.raises(IntegrityError, match="maximum of 9"):
        with db.transaction(engine) as c:
            SqlProfileRepository(c).replace(oversized)

    # Nothing from the failed replace survived: the delete and the insert both rolled back.
    with db.read_snapshot(engine) as c:
        after = SqlProfileRepository(c).get_party()
    assert after is not None
    assert {t.traveler_id for t in after.travelers} == {s.traveler_id, d.traveler_id}


def test_database_checks_reject_invalid_rows_directly(engine: Engine) -> None:
    profile_id = uuid4()
    with db.transaction(engine) as c:
        c.execute(
            text(
                "INSERT INTO profile (profile_id, created_at, updated_at) "
                "VALUES (:id, now(), now())"
            ),
            {"id": profile_id},
        )
    sponsor_id = uuid4()
    with db.transaction(engine) as c:
        c.execute(
            text(
                "INSERT INTO profile_travelers "
                "(traveler_id, profile_id, role, category_attestation, age_band, sponsor_id) "
                "VALUES (:tid, :pid, 'sponsor', 'VI', 'adult', NULL)"
            ),
            {"tid": sponsor_id, "pid": profile_id},
        )

    def insert_traveler(**cols: object) -> None:
        base = {
            "traveler_id": uuid4(),
            "profile_id": profile_id,
            "role": "dependent",
            "category_attestation": "unknown",
            "age_band": "under_14",
            "sponsor_id": sponsor_id,
        }
        row = {**base, **cols}
        with db.transaction(engine) as c:
            c.execute(
                text(
                    "INSERT INTO profile_travelers "
                    "(traveler_id, profile_id, role, category_attestation, age_band, sponsor_id) "
                    "VALUES (:traveler_id, :profile_id, :role, :category_attestation, "
                    ":age_band, :sponsor_id)"
                ),
                row,
            )

    with pytest.raises(IntegrityError, match="ck_profile_travelers_role"):
        insert_traveler(role="guardian")
    with pytest.raises(IntegrityError, match="ck_profile_travelers_category_attestation"):
        insert_traveler(category_attestation="VII")
    with pytest.raises(IntegrityError, match="ck_profile_travelers_age_band"):
        insert_traveler(age_band="teen")
    with pytest.raises(IntegrityError, match="ck_profile_travelers_sponsor_null_pairing"):
        insert_traveler(role="sponsor", sponsor_id=sponsor_id)
    with pytest.raises(IntegrityError, match="ck_profile_travelers_sponsor_null_pairing"):
        insert_traveler(sponsor_id=None)
    with pytest.raises(IntegrityError, match="fk_profile_travelers_sponsor_id"):
        insert_traveler(sponsor_id=uuid4())
    with pytest.raises(IntegrityError, match="fk_profile_travelers_profile_id"):
        insert_traveler(profile_id=uuid4())
    self_id = uuid4()
    with pytest.raises(IntegrityError, match="ck_profile_travelers_no_self_sponsor"):
        insert_traveler(traveler_id=self_id, sponsor_id=self_id)


def test_the_profile_table_is_a_database_enforced_singleton(engine: Engine) -> None:
    with db.transaction(engine) as c:
        c.execute(
            text(
                "INSERT INTO profile (profile_id, created_at, updated_at) "
                "VALUES (:id, now(), now())"
            ),
            {"id": uuid4()},
        )
    with pytest.raises(IntegrityError, match="uq_profile_singleton"):
        with db.transaction(engine) as c:
            c.execute(
                text(
                    "INSERT INTO profile (profile_id, created_at, updated_at) "
                    "VALUES (:id, now(), now())"
                ),
                {"id": uuid4()},
            )
    with pytest.raises(IntegrityError, match="ck_profile_singleton"):
        with db.transaction(engine) as c:
            c.execute(
                text(
                    "INSERT INTO profile (profile_id, singleton, created_at, updated_at) "
                    "VALUES (:id, false, now(), now())"
                ),
                {"id": uuid4()},
            )


def test_api_over_the_real_composition_root_roundtrips_and_writes_nothing_on_422(
    engine: Engine,
) -> None:
    app.dependency_overrides[get_engine] = lambda: engine
    app.dependency_overrides[get_authenticator] = lambda: BearerTokenAuthenticator(TOKEN)
    try:
        client = TestClient(app)
        headers = {"Authorization": f"Bearer {TOKEN}"}
        assert client.get("/api/v1/profile").status_code == 401
        assert client.get("/api/v1/profile", headers=headers).json() == {
            "status": "unset",
            "party": None,
        }

        sponsor_id, dependent_id = str(uuid4()), str(uuid4())
        sponsor: dict[str, object] = {
            "traveler_id": sponsor_id,
            "role": "sponsor",
            "category_attestation": "VI",
            "age_band": "adult",
            "sponsor_id": None,
        }
        dependent: dict[str, object] = {
            "traveler_id": dependent_id,
            "role": "dependent",
            "category_attestation": "unknown",
            "age_band": "under_14",
            "sponsor_id": sponsor_id,
        }
        body = {"travelers": [sponsor, dependent]}
        put = client.put("/api/v1/profile", json=body, headers=headers)
        assert put.status_code == 200, put.text
        read = client.get("/api/v1/profile", headers=headers)
        assert read.json()["status"] == "set"
        assert len(read.json()["party"]["travelers"]) == 2

        rejected = client.put(
            "/api/v1/profile",
            json={"travelers": [{**dependent, "sponsor_id": None}]},
            headers=headers,
        )
        assert rejected.status_code == 422
        assert rejected.json() == {"detail": {"message_key": "profile.invalid_party"}}
        assert client.get("/api/v1/profile", headers=headers).json() == read.json()
    finally:
        app.dependency_overrides.clear()
