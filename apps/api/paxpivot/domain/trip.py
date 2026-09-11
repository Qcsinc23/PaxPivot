"""Trip request: what the traveler asked for (PRD §4.1, §15 TripRequest). TASK-034.

A request is a question, not a plan: it names an origin terminal from the registry, a
destination as the traveler typed it (resolution is a later task), a travel window and a
party size. It carries no eligibility, no route and no probability.
"""

from datetime import timedelta
from typing import Annotated, Self
from uuid import UUID

from pydantic import AwareDatetime, Field, StringConstraints, model_validator

from paxpivot.domain.base import Contract

DestinationText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)
]
MAX_WINDOW = timedelta(days=30)


class NewTripRequest(Contract):
    """What the traveler submits. Validated at the boundary; nothing derived."""

    origin_terminal_id: UUID
    destination_text: DestinationText
    window_start: AwareDatetime
    window_end: AwareDatetime
    party_size: int = Field(ge=1, le=9)

    @model_validator(mode="after")
    def window_is_sane(self) -> Self:
        if self.window_end <= self.window_start:
            raise ValueError("The travel window must end after it starts")
        if self.window_end - self.window_start > MAX_WINDOW:
            raise ValueError("The travel window may span at most 30 days")
        return self


class TripRequest(NewTripRequest):
    trip_id: UUID
    created_at: AwareDatetime
