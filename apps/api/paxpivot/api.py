"""HTTP composition root. Framework code stops here; use cases live in ``application``.

Every ``/api/v1`` route requires a principal from the ``Authenticator`` port (ADR-001: no
private endpoint without auth composition). Responses are the application read models, which
carry no raw source payloads, payload references or provider exception text.
"""

import logging
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Response
from fastapi.responses import JSONResponse
from sqlalchemy import Connection, Engine

from paxpivot.application.ports.auth import Authenticator, Principal
from paxpivot.application.ports.repositories import (
    KillSwitchReader,
    ObservationReader,
    SourceReader,
    TerminalReader,
    TripReader,
)
from paxpivot.application.read_models import (
    SourceHealthRead,
    TerminalDetailRead,
    TerminalNetworkRead,
)
from paxpivot.application.read_services import (
    get_terminal_detail,
    list_source_health,
    list_terminal_network,
)
from paxpivot.application.trip_service import (
    TripListRead,
    TripRead,
    create_trip_request,
    get_trip_request,
    list_trip_requests,
)
from paxpivot.domain.base import Contract
from paxpivot.domain.trip import NewTripRequest
from paxpivot.infrastructure.audit import audit_event
from paxpivot.infrastructure.auth import authenticator_from_env
from paxpivot.infrastructure.database import (
    database_ready,
    engine_from_env,
    read_snapshot,
    transaction,
)
from paxpivot.infrastructure.repositories import (
    SqlKillSwitchRepository,
    SqlSourceObservationRepository,
    SqlSourceRepository,
    SqlTerminalRepository,
    SqlTripRepository,
)

logger = logging.getLogger("paxpivot.api")
app = FastAPI(title="PaxPivot", docs_url=None, redoc_url=None, openapi_url=None)


class HealthResponse(Contract):
    status: Literal["ok"] = "ok"


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Liveness only; does not imply database/provider or production readiness."""
    return HealthResponse()


# ── composition seams (overridable in tests) ────────────────────────────


def get_authenticator() -> Authenticator:
    return authenticator_from_env()


def get_engine() -> Engine:
    return engine_from_env()


def get_connection(engine: Annotated[Engine, Depends(get_engine)]) -> Iterator[Connection]:
    """One read-only snapshot per request (ADR-004 "Read and write seams").

    The read use cases compose several statements; one REPEATABLE READ snapshot keeps a
    concurrent write from being half-visible, and READ ONLY makes any write fail at the database.
    """
    with read_snapshot(engine) as connection:
        yield connection


@dataclass(frozen=True)
class Repositories:
    """Reader ports only: a GET route cannot name a write, and the snapshot refuses one anyway."""

    terminals: TerminalReader
    sources: SourceReader
    observations: ObservationReader
    kill_switches: KillSwitchReader
    trips: TripReader


def get_repositories(
    connection: Annotated[Connection, Depends(get_connection)],
) -> Repositories:
    return Repositories(
        terminals=SqlTerminalRepository(connection),
        sources=SqlSourceRepository(connection),
        observations=SqlSourceObservationRepository(connection),
        kill_switches=SqlKillSwitchRepository(connection),
        trips=SqlTripRepository(connection),
    )


def get_write_connection(engine: Annotated[Engine, Depends(get_engine)]) -> Iterator[Connection]:
    """One write transaction per mutating request: commit on success, roll back on error."""
    with transaction(engine) as connection:
        yield connection


@dataclass(frozen=True)
class WriteRepositories:
    terminals: TerminalReader
    trips: SqlTripRepository


def get_write_repositories(
    connection: Annotated[Connection, Depends(get_write_connection)],
) -> WriteRepositories:
    return WriteRepositories(
        terminals=SqlTerminalRepository(connection), trips=SqlTripRepository(connection)
    )


async def require_principal(
    authenticator: Annotated[Authenticator, Depends(get_authenticator)],
    authorization: Annotated[str | None, Header()] = None,
) -> Principal:
    credential = None
    if authorization is not None and authorization.startswith("Bearer "):
        credential = authorization.removeprefix("Bearer ").strip() or None
    result = await authenticator.authenticate(credential)
    if not result.ok:
        audit_event(logger, "authorization_denied", uuid4())
        raise HTTPException(
            status_code=401,
            detail={"message_key": result.error.message_key},
            headers={"WWW-Authenticate": "Bearer"},
        )
    return result.value


Repos = Annotated[Repositories, Depends(get_repositories)]
Authorized = Depends(require_principal)


@app.get("/api/v1/terminals", response_model=TerminalNetworkRead, dependencies=[Authorized])
def terminal_network(repos: Repos) -> TerminalNetworkRead:
    return list_terminal_network(repos.terminals, repos.sources, repos.observations)


@app.get(
    "/api/v1/terminals/{terminal_id}",
    response_model=TerminalDetailRead,
    dependencies=[Authorized],
)
def terminal_detail(terminal_id: UUID, repos: Repos) -> TerminalDetailRead:
    result = get_terminal_detail(terminal_id, repos.terminals, repos.sources, repos.observations)
    if not result.ok:
        raise HTTPException(status_code=404, detail={"message_key": result.error.message_key})
    return result.value


@app.get("/api/v1/sources/health", response_model=SourceHealthRead, dependencies=[Authorized])
def source_health(repos: Repos) -> SourceHealthRead:
    return list_source_health(repos.sources, repos.observations, repos.kill_switches)


@app.get("/api/v1/trips", response_model=TripListRead, dependencies=[Authorized])
def trips(repos: Repos) -> TripListRead:
    return list_trip_requests(repos.trips, repos.terminals)


@app.get("/api/v1/trips/{trip_id}", response_model=TripRead, dependencies=[Authorized])
def trip(trip_id: UUID, repos: Repos) -> TripRead:
    result = get_trip_request(trip_id, repos.trips, repos.terminals)
    if not result.ok:
        raise HTTPException(status_code=404, detail={"message_key": result.error.message_key})
    return result.value


@app.post("/api/v1/trips", response_model=TripRead, status_code=201, dependencies=[Authorized])
def create_trip(
    request: NewTripRequest,
    repos: Annotated[WriteRepositories, Depends(get_write_repositories)],
) -> TripRead:
    result = create_trip_request(request, repos.terminals, repos.trips)
    if not result.ok:
        raise HTTPException(status_code=422, detail={"message_key": result.error.message_key})
    return result.value


class ReadyResponse(Contract):
    status: Literal["ready", "unavailable"]


@app.get("/ready", response_model=ReadyResponse, responses={503: {"model": ReadyResponse}})
def ready(engine: Annotated[Engine, Depends(get_engine)]) -> Response:
    """Readiness for orchestrators: the database answers and is at the migration head.

    Says only ready/unavailable; no error text, host or schema detail leaves the process.
    """
    if database_ready(engine):
        return JSONResponse(ReadyResponse(status="ready").model_dump())
    return JSONResponse(
        ReadyResponse(status="unavailable").model_dump(),
        status_code=503,
        headers={"Cache-Control": "no-store"},
    )
