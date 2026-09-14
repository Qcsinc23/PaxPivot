"""Private traveler/party profile (TASK-050): read the pilot's one party, or replace it whole.

No eligibility decision is made here (TASK-035); this module only stores and returns the facts
that engine will need. `replace_profile` is the only write: the whole submitted party is
validated as a genuine `PartyFacts` — reusing that contract's own cross-reference rules — before
anything reaches the repository, so an invalid submission writes nothing.
"""

from typing import Literal

from pydantic import ValidationError

from paxpivot.application.ports.repositories import ProfileReader, ProfileRepository
from paxpivot.application.result import ApplicationError, Failure, Result, Success
from paxpivot.domain.base import Contract
from paxpivot.domain.eligibility import PartyFacts
from paxpivot.domain.profile import NewParty


class ProfileRead(Contract):
    """`GET`/`PUT /api/v1/profile`'s wire shape. `party` is `None` only when the pilot has never
    set one — an explicit unset state, never a fabricated default."""

    status: Literal["set", "unset"]
    party: PartyFacts | None


def _read(party: PartyFacts | None) -> ProfileRead:
    return ProfileRead(status="set" if party is not None else "unset", party=party)


def get_profile(profiles: ProfileReader) -> ProfileRead:
    return _read(profiles.get_party())


def replace_profile(new_party: NewParty, profiles: ProfileRepository) -> Result[ProfileRead]:
    """Validate the whole party, then replace it atomically. Nothing is written on failure."""
    try:
        party = new_party.to_party_facts()
    except ValidationError:
        return Failure(
            error=ApplicationError(
                code="invalid_input", message_key="profile.invalid_party", retryable=False
            )
        )
    profiles.replace(party)
    return Success(value=_read(party))
