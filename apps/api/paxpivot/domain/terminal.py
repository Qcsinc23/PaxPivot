from enum import StrEnum
from typing import Annotated, Literal, Self
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import AwareDatetime, Field, StringConstraints, field_validator, model_validator

from paxpivot.domain.base import Contract, Identifier
from paxpivot.domain.source import Provenance

FactText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


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
    installation: Identifier | None = None  # Host installation/airport, for context only.
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


class TerminalFactKind(StrEnum):
    COUNTER_HOURS = "counter_hours"
    PHONE = "phone"
    EMAIL = "email"
    PARKING = "parking"
    PASSENGER_TERMINAL_NOTE = "passenger_terminal_note"
    USO_AVAILABILITY = "uso_availability"
    ACCESS_NOTE = "access_note"


class TerminalOperationalFact(Contract):
    """A changeable public fact about a terminal, with its own provenance and validity.

    Facts are appended, never edited: a newer fact of the same kind supersedes by
    `recorded_at`, and an `effective_to` closes one without deleting it.
    """

    fact_id: UUID
    terminal_id: UUID
    kind: TerminalFactKind
    value: FactText
    provenance: Provenance
    effective_from: AwareDatetime | None
    effective_to: AwareDatetime | None
    recorded_at: AwareDatetime

    @model_validator(mode="after")
    def validity_window(self) -> Self:
        if (
            self.effective_from is not None
            and self.effective_to is not None
            and self.effective_to <= self.effective_from
        ):
            raise ValueError("A validity window must end after it starts")
        return self
