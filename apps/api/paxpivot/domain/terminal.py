from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, field_validator

from paxpivot.domain.base import Contract, Identifier
from paxpivot.domain.source import Provenance


class Coordinates(Contract):
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)


class VerifiedEntrance(Contract):
    kind: Literal["passenger_terminal", "visitor_center", "documented_gate"]
    coordinates: Coordinates
    verification: Provenance
    instructions: Identifier


class Terminal(Contract):
    terminal_id: UUID
    name: Identifier
    timezone: Identifier
    operational_state: Literal["verified", "unknown", "conflict", "ended"]
    evidence: Provenance
    entrance: VerifiedEntrance | None
    base_coordinates: Coordinates | None  # Never a substitute for entrance.

    @field_validator("timezone")
    @classmethod
    def iana_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("Expected an IANA timezone") from exc
        return value
