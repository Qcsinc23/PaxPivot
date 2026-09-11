"""Read API composition: auth gate, response contracts, and the JSON examples the web adapters
consume (apps/web/lib/api/examples). Set PAXPIVOT_WRITE_EXAMPLES=1 to regenerate them."""

import json
import os
from collections.abc import Iterator
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from paxpivot.api import Repositories, app, get_authenticator, get_repositories
from paxpivot.application.read_services import (
    get_terminal_detail,
    list_source_health,
    list_terminal_network,
)
from paxpivot.infrastructure.auth import (
    LOCAL_PRINCIPAL_ID,
    BearerTokenAuthenticator,
    DenyAllAuthenticator,
    authenticator_from_env,
)
from support_sources import (
    NOW,
    TERMINAL_A,
    FakeObservations,
    FakeSources,
    FakeSwitches,
    FakeTerminals,
)

TOKEN = "synthetic-token-with-at-least-32-characters"
EXAMPLES = Path(__file__).resolve().parents[2] / "apps/web/lib/api/examples"


@pytest.fixture
def client() -> Iterator[TestClient]:
    app.dependency_overrides[get_authenticator] = lambda: BearerTokenAuthenticator(TOKEN)
    app.dependency_overrides[get_repositories] = lambda: Repositories(
        terminals=FakeTerminals(),
        sources=FakeSources(),
        observations=FakeObservations(),
        kill_switches=FakeSwitches(),
    )
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


AUTH = {"Authorization": f"Bearer {TOKEN}"}


@pytest.mark.parametrize(
    "path", ["/api/v1/terminals", f"/api/v1/terminals/{uuid4()}", "/api/v1/sources/health"]
)
def test_every_read_route_requires_a_principal(client: TestClient, path: str) -> None:
    for headers in (
        {},
        {"Authorization": "Bearer wrong"},
        {"Authorization": "Basic x"},
        # A non-ASCII credential must be denied, not turned into a 500 (and it must still
        # reach the denial audit event). Raw bytes are what an attacker actually sends;
        # Starlette decodes them as latin-1, producing a non-ASCII str.
        {"Authorization": "Bearer caf\u00e9".encode()},
    ):
        response = client.get(path, headers=headers)
        assert response.status_code == 401, headers
        assert response.headers["WWW-Authenticate"] == "Bearer"
        assert response.json() == {"detail": {"message_key": "auth.invalid_credential"}}
        assert TOKEN not in response.text


def test_deny_all_is_the_default_without_a_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("PAXPIVOT_API_TOKEN", raising=False)
    assert isinstance(authenticator_from_env(), DenyAllAuthenticator)
    monkeypatch.setenv("PAXPIVOT_API_TOKEN", TOKEN)
    assert isinstance(authenticator_from_env(), BearerTokenAuthenticator)
    with pytest.raises(ValueError):
        BearerTokenAuthenticator("short")
    app.dependency_overrides[get_authenticator] = DenyAllAuthenticator
    try:
        assert TestClient(app).get("/api/v1/terminals", headers=AUTH).status_code == 401
    finally:
        app.dependency_overrides.clear()


def test_terminal_routes_return_read_models(client: TestClient) -> None:
    network = client.get("/api/v1/terminals", headers=AUTH)
    assert network.status_code == 200
    body = network.json()
    assert len(body["terminals"]) == 4
    never_observed = [t for t in body["terminals"] if t["latest"] is None]
    assert len(never_observed) == 2  # No state invented for unobserved terminals.

    detail = client.get(f"/api/v1/terminals/{TERMINAL_A.terminal_id}", headers=AUTH)
    assert detail.status_code == 200
    assert detail.json()["summary"]["entrance_kind"] == "passenger_terminal"
    assert "base_" not in detail.text and "payload_ref" not in detail.text

    missing = client.get(f"/api/v1/terminals/{uuid4()}", headers=AUTH)
    assert missing.status_code == 404
    assert missing.json() == {"detail": {"message_key": "terminal.not_found"}}
    assert client.get("/api/v1/terminals/not-a-uuid", headers=AUTH).status_code == 422


def test_source_health_route_exposes_no_raw_payload_or_hash(client: TestClient) -> None:
    response = client.get("/api/v1/sources/health", headers=AUTH)
    assert response.status_code == 200
    body = response.json()
    assert body["never_observed"] == 3
    assert {row["kill_switched"] for row in body["rows"]} == {True, False}
    for forbidden in ["payload_ref", "content_hash", "api_key", "token"]:
        assert forbidden not in response.text
    assert LOCAL_PRINCIPAL_ID is not None


def test_json_examples_match_the_read_models() -> None:
    """The checked-in examples are the contract the web adapters are tested against."""
    terminals, sources, observations, switches = (
        FakeTerminals(),
        FakeSources(),
        FakeObservations(),
        FakeSwitches(),
    )
    detail = get_terminal_detail(TERMINAL_A.terminal_id, terminals, sources, observations, now=NOW)
    assert detail.ok
    expected = {
        "terminal-network.json": list_terminal_network(terminals, sources, observations, now=NOW),
        "terminal-detail.json": detail.value,
        "source-health.json": list_source_health(sources, observations, switches, now=NOW),
    }
    for name, model in expected.items():
        rendered = json.dumps(json.loads(model.model_dump_json()), indent=2) + "\n"
        path = EXAMPLES / name
        if os.environ.get("PAXPIVOT_WRITE_EXAMPLES") == "1":
            path.write_text(rendered)
        assert path.read_text() == rendered, (
            f"{name} is stale; regenerate with PAXPIVOT_WRITE_EXAMPLES=1"
        )


def test_every_api_v1_route_is_behind_the_principal_gate() -> None:
    """A new unauthenticated /api/v1 route must fail here, not in production."""
    guarded: list[str] = []
    for route in app.routes:
        path = getattr(route, "path", "")
        if not path.startswith("/api/v1"):
            continue
        dependant = getattr(route, "dependant", None)
        names = {d.call.__name__ for d in (dependant.dependencies if dependant else [])}
        assert "require_principal" in names, f"{path} is not behind require_principal"
        guarded.append(path)
    assert len(guarded) == 3, guarded


@pytest.mark.anyio
async def test_a_non_ascii_credential_is_denied_not_raised() -> None:
    """`hmac.compare_digest` raises TypeError on a non-ASCII str; that must become a denial."""
    authenticator = BearerTokenAuthenticator(TOKEN)
    for credential in ("caf\u00e9", "\u4e2d\u6587", "\U0001f600"):
        result = await authenticator.authenticate(credential)
        assert not result.ok and result.error.message_key == "auth.invalid_credential"
    assert (await authenticator.authenticate(TOKEN)).ok
    assert not (await authenticator.authenticate(None)).ok


def test_ready_is_unavailable_without_a_database_and_says_nothing_else() -> None:
    from paxpivot.api import get_engine
    from sqlalchemy import create_engine

    # A port nothing listens on: the probe must report unavailable quickly and silently.
    app.dependency_overrides[get_engine] = lambda: create_engine(
        "postgresql+psycopg://x:y@127.0.0.1:1/z", connect_args={"connect_timeout": 1}
    )
    try:
        response = TestClient(app).get("/ready")
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}
    assert "127.0.0.1" not in response.text and "psycopg" not in response.text
