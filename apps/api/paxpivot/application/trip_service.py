"""Trip requests (TASK-034): create and read what the traveler asked for.

No eligibility, routing or ranking happens here. A request is accepted only for a registered
origin terminal; everything else is the traveler's own words and dates, validated at the boundary.
"""

from datetime import UTC, datetime
from uuid import UUID, uuid4

from paxpivot.application.ports.repositories import TerminalReader, TripReader, TripRepository
from paxpivot.application.result import ApplicationError, Failure, Result, Success
from paxpivot.domain.base import Contract, Identifier
from paxpivot.domain.trip import NewTripRequest, TripRequest


class TripRead(Contract):
    trip_id: UUID
    origin_terminal_id: UUID
    origin_terminal_name: Identifier
    destination_text: str
    window_start: datetime
    window_end: datetime
    party_size: int
    created_at: datetime


class TripListRead(Contract):
    trips: tuple[TripRead, ...]


def create_trip_request(
    request: NewTripRequest,
    terminals: TerminalReader,
    trips: TripRepository,
    *,
    now: datetime | None = None,
) -> Result[TripRead]:
    terminal = terminals.get_terminal(request.origin_terminal_id)
    if terminal is None:
        return Failure(
            error=ApplicationError(
                code="invalid_input", message_key="trip.unknown_origin_terminal", retryable=False
            )
        )
    trip = TripRequest(trip_id=uuid4(), created_at=now or datetime.now(UTC), **request.model_dump())
    trips.add(trip)
    return Success(value=_read(trip, terminal.name))


def _read(trip: TripRequest, origin_name: str) -> TripRead:
    return TripRead(
        trip_id=trip.trip_id,
        origin_terminal_id=trip.origin_terminal_id,
        origin_terminal_name=origin_name,
        destination_text=trip.destination_text,
        window_start=trip.window_start,
        window_end=trip.window_end,
        party_size=trip.party_size,
        created_at=trip.created_at,
    )


def _origin_name(terminals: TerminalReader, terminal_id: UUID) -> str:
    terminal = terminals.get_terminal(terminal_id)
    return terminal.name if terminal else "Unknown terminal"


def list_trip_requests(trips: TripReader, terminals: TerminalReader) -> TripListRead:
    return TripListRead(
        trips=tuple(
            _read(t, _origin_name(terminals, t.origin_terminal_id)) for t in trips.list_trips()
        )
    )


def get_trip_request(
    trip_id: UUID, trips: TripReader, terminals: TerminalReader
) -> Result[TripRead]:
    trip = trips.get_trip(trip_id)
    if trip is None:
        return Failure(
            error=ApplicationError(
                code="unavailable", message_key="trip.not_found", retryable=False
            )
        )
    return Success(value=_read(trip, _origin_name(terminals, trip.origin_terminal_id)))
