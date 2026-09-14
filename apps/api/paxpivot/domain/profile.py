"""Private traveler/party profile (TASK-050, PRV-001, ADR-009).

The pilot's single party: a sponsor plus zero or more dependents. This module stores exactly
what eligibility needs — a traveler id, a sponsor/dependent role, a category attestation, an
age band, and a dependent's sponsor reference — and nothing else. There is no field here (and
none may be added without a task/ADR) for a name, an SSN/DoD ID or other credential number, a
disability rating or other medical evidence, a document or image, a full birth date, or free
text.

`to_party_facts()` is the seam TASK-035 (the eligibility engine, blocked on policy) will consume:
it builds a genuine `paxpivot.domain.eligibility.PartyFacts`, reusing that contract's own
cross-reference validation, and fills the two fields `TravelerFacts` carries that this profile
never collects — `traveler_class` and `accompanied` — with an explicit placeholder/`None` rather
than a guess. See ADR-009 for why.
"""

from typing import Literal, Self
from uuid import UUID

from pydantic import Field, model_validator

from paxpivot.domain.base import Contract
from paxpivot.domain.eligibility import PartyFacts, TravelerFacts

Role = Literal["sponsor", "dependent"]
CategoryAttestation = Literal["I", "II", "III", "IV", "V", "VI", "unknown"]
AgeBand = Literal["under_14", "minor_14_or_older", "adult", "unknown"]

ROLES: tuple[Role, ...] = ("sponsor", "dependent")
CATEGORY_ATTESTATIONS: tuple[CategoryAttestation, ...] = (
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "unknown",
)
AGE_BANDS: tuple[AgeBand, ...] = ("under_14", "minor_14_or_older", "adult", "unknown")

# Matches the trip request's party_size bound (`domain/trip.py`); the same pilot-scale cap.
MAX_PARTY_SIZE = 9

# No versioned policy class exists until TASK-035 assigns one; this profile never guesses.
UNASSIGNED_TRAVELER_CLASS = "unassigned"


class ProfileTraveler(Contract):
    """One traveler as stored: the minimum PRV-001 allows. `sponsor_id` is set only for a
    dependent, and only ever names another traveler in this same submission (the pilot has one
    party, so there is no other party a reference could name)."""

    traveler_id: UUID
    role: Role
    category_attestation: CategoryAttestation
    age_band: AgeBand
    sponsor_id: UUID | None


class NewParty(Contract):
    """What `PUT /api/v1/profile` accepts. Validated at the boundary; nothing derived.

    The cross-traveler rule below mirrors `PartyFacts.references` exactly (unique ids, a
    sponsor has no sponsor, a dependent references a party sponsor). It is intentionally
    duplicated rather than imported: `ProfileTraveler` is this task's own minimal contract, not
    `TravelerFacts`, and this task does not modify `domain/eligibility.py` (owned by TASK-035).
    `to_party_facts()` reuses `PartyFacts`'s validator as a second, independent pass.
    """

    travelers: tuple[ProfileTraveler, ...] = Field(min_length=1, max_length=MAX_PARTY_SIZE)

    @model_validator(mode="after")
    def references(self) -> Self:
        ids = {t.traveler_id for t in self.travelers}
        if len(ids) != len(self.travelers):
            raise ValueError("Traveler IDs must be unique")
        sponsors = {t.traveler_id for t in self.travelers if t.role == "sponsor"}
        for t in self.travelers:
            if t.role == "sponsor" and t.sponsor_id is not None:
                raise ValueError("Sponsor cannot reference another sponsor")
            if t.role == "dependent" and t.sponsor_id not in sponsors:
                raise ValueError("Dependent must reference a party sponsor")
        return self

    def to_party_facts(self) -> PartyFacts:
        """A genuine, cross-referenced `PartyFacts`.

        `self.references` above already proved the party is internally consistent; handing the
        mapped travelers to `PartyFacts` re-runs that contract's own equivalent validator as an
        independent second pass, so an invalid party is still refused even if this method were
        ever reached with an unvalidated `NewParty` (e.g. built via `model_construct`).
        """
        return PartyFacts(
            travelers=tuple(
                TravelerFacts(
                    traveler_id=t.traveler_id,
                    role=t.role,
                    traveler_class=UNASSIGNED_TRAVELER_CLASS,
                    category_attestation=t.category_attestation,
                    age_band=t.age_band,
                    sponsor_id=t.sponsor_id,
                    accompanied=None,
                )
                for t in self.travelers
            )
        )
