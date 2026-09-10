from typing import Literal, Self
from uuid import UUID

from pydantic import Field, model_validator

from paxpivot.domain.base import Contract, Identifier
from paxpivot.domain.source import Provenance


class TravelerFacts(Contract):
    traveler_id: UUID
    role: Literal["sponsor", "dependent"]
    traveler_class: Identifier  # Versioned policy class attestation; no medical evidence.
    category_attestation: Literal["I", "II", "III", "IV", "V", "VI", "unknown"]
    age_band: Literal["under_14", "minor_14_or_older", "adult", "unknown"]
    sponsor_id: UUID | None
    accompanied: bool | None


class PartyFacts(Contract):
    travelers: tuple[TravelerFacts, ...] = Field(min_length=1)

    @model_validator(mode="after")
    def references(self) -> Self:
        ids = {person.traveler_id for person in self.travelers}
        if len(ids) != len(self.travelers):
            raise ValueError("Traveler IDs must be unique")
        sponsors = {p.traveler_id for p in self.travelers if p.role == "sponsor"}
        for person in self.travelers:
            if person.role == "sponsor" and person.sponsor_id is not None:
                raise ValueError("Sponsor cannot reference another sponsor")
            if person.role == "dependent" and person.sponsor_id not in sponsors:
                raise ValueError("Dependent must reference a party sponsor")
        return self


class EligibilityDecision(Contract):
    state: Literal["eligible", "ineligible", "unknown", "outside_supported_scope"]
    controlling_policy_id: Identifier
    controlling_policy_version: Identifier
    citations: tuple[Provenance, ...] = Field(min_length=1)
    reasons: tuple[Identifier, ...] = Field(min_length=1)
    unresolved_conditions: tuple[Identifier, ...]
