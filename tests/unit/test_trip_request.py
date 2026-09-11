"""TASK-034: trip requests are validated at the boundary and carry no derived claims."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from paxpivot.api import (
    Repositories,
    WriteRepositories,
    app,
    get_authenticator,
    get_repositories,
    get_write_repositories,
)
from paxpivot.application.trip_service import (
    create_trip_request,
    get_trip_request,
    list_trip_requests,
)
from paxpivot.domain.trip import NewTripRequest
from paxpivot.infrastructure.auth import BearerTokenAuthenticator
from pydantic import ValidationError
from support_sources import (
    NOW,
    TERMINAL_A,
    FakeObservations,
    FakeSources,
    FakeSwitches,
    FakeTerminals,
    FakeTrips,
)

START = datetime(2026, 10, 1, tzinfo=UTC)
TOKEN = "synthetic-token-with-at-least-32-characters"


def new_request(**overrides: object) -> NewTripRequest:
    data: dict[str, object] = {
        "origin_terminal_id": TERMINAL_A.terminal_id,
        "destination_text": "Example destination",
        "window_start": START,
        "window_end": START + timedelta(days=5),
        "party_size": 2,
    }
    return NewTripRequest.model_validate({**data, **overrides})


def test_request_validation_rejects_bad_windows_parties_and_blank_destinations() -> None:
    assert new_request().party_size == 2
    for bad in (
        {"window_end": START},
        {"window_end": START - timedelta(days=1)},
        {"window_end": START + timedelta(days=31)},
        {"party_size": 0},
        {"party_size": 10},
        {"destination_text": "   "},
        {"destination_text": "x" * 201},
        {"window_start": datetime(2026, 10, 1)},  # naive
        {"extra": "field"},
    ):
        with pytest.raises(ValidationError):
            new_request(**bad)


def test_service_creates_lists_and_reads_a_trip_and_refuses_unknown_terminals() -> None:
    trips = FakeTrips()
    created = create_trip_request(new_request(), FakeTerminals(), trips, now=NOW)
    assert created.ok
    read = created.value
    assert read.origin_terminal_name == TERMINAL_A.name and read.created_at == NOW
    assert list_trip_requests(trips, FakeTerminals()).trips == (read,)
    assert get_trip_request(read.trip_id, trips, FakeTerminals()).value == read  # type: ignore[union-attr]
    missing = get_trip_request(uuid4(), trips, FakeTerminals())
    assert not missing.ok and missing.error.message_key == "trip.not_found"
    unknown = create_trip_request(
        new_request(origin_terminal_id=uuid4()), FakeTerminals(), trips, now=NOW
    )
    assert not unknown.ok and unknown.error.message_key == "trip.unknown_origin_terminal"
    assert len(trips.items) == 1
    # The read model carries no eligibility, route or probability field.
    assert set(read.model_dump()) == {
        "trip_id",
        "origin_terminal_id",
        "origin_terminal_name",
        "destination_text",
        "window_start",
        "window_end",
        "party_size",
        "created_at",
    }


def test_api_routes_are_gated_and_round_trip() -> None:
    trips = FakeTrips()
    app.dependency_overrides[get_authenticator] = lambda: BearerTokenAuthenticator(TOKEN)
    app.dependency_overrides[get_repositories] = lambda: Repositories(
        terminals=FakeTerminals(),
        sources=FakeSources(),
        observations=FakeObservations(),
        kill_switches=FakeSwitches(),
        trips=trips,
    )
    app.dependency_overrides[get_write_repositories] = lambda: WriteRepositories(
        terminals=FakeTerminals(),
        trips=trips,  # type: ignore[arg-type]
    )
    try:
        client = TestClient(app)
        body = new_request().model_dump(mode="json")
        assert client.post("/api/v1/trips", json=body).status_code == 401
        auth = {"Authorization": f"Bearer {TOKEN}"}
        created = client.post("/api/v1/trips", json=body, headers=auth)
        assert created.status_code == 201, created.text
        trip_id = created.json()["trip_id"]
        assert client.get("/api/v1/trips", headers=auth).json()["trips"][0]["trip_id"] == trip_id
        assert client.get(f"/api/v1/trips/{trip_id}", headers=auth).status_code == 200
        assert client.get(f"/api/v1/trips/{uuid4()}", headers=auth).status_code == 404
        bad = client.post("/api/v1/trips", json={**body, "party_size": 0}, headers=auth)
        assert bad.status_code == 422
        unknown = client.post(
            "/api/v1/trips", json={**body, "origin_terminal_id": str(uuid4())}, headers=auth
        )
        assert unknown.status_code == 422
        assert unknown.json() == {"detail": {"message_key": "trip.unknown_origin_terminal"}}
    finally:
        app.dependency_overrides.clear()
