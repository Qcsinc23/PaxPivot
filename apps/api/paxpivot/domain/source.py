from enum import StrEnum
from typing import Self
from uuid import UUID

from pydantic import AwareDatetime, HttpUrl, model_validator

from paxpivot.domain.base import Contract, Identifier


class SourceState(StrEnum):
    FRESH = "fresh"
    STALE = "source_stale"
    UNREACHABLE = "source_unreachable"
    CHANGED_UNPARSED = "source_changed_unparsed"
    MISSING = "source_missing"
    CONFLICT = "source_conflict"
    MONITOR_DELAYED = "monitor_delayed"
    NO_DEPARTURES = "no_departures_published"
    NO_COMPATIBLE = "no_compatible_opportunity"
    RESTRICTED = "restricted_user_open_only"
    REVIEW_REQUIRED = "parser_review_required"
    SUPERSEDED = "superseded"
    WITHDRAWN = "withdrawn"


class SourceIdentity(Contract):
    source_id: UUID
    url: HttpUrl
    authority: Identifier


class Provenance(Contract):
    source: SourceIdentity
    observed_at: AwareDatetime
    source_time: AwareDatetime | None  # Required explicit unknown, never substituted.
    provider_id: Identifier
    policy_version_id: Identifier  # Processing register identity, not approval itself.


class RetrievalState(StrEnum):
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    NOT_ATTEMPTED = "not_attempted"


class ExtractionState(StrEnum):
    NOT_ATTEMPTED = "not_attempted"
    EXACT = "exact_text"
    REVIEWED = "human_reviewed"
    FAILED = "failed"


class SourceObservation(Contract):
    observation_id: UUID
    provenance: Provenance
    state: SourceState
    retrieval: RetrievalState
    extraction: ExtractionState
    parser_version: Identifier | None
    content_hash: Identifier | None
    confidence_reasons: tuple[Identifier, ...]

    @model_validator(mode="after")
    def evidence_consistency(self) -> Self:
        positive = {SourceState.FRESH, SourceState.NO_DEPARTURES, SourceState.NO_COMPATIBLE}
        if self.state in positive and self.retrieval != RetrievalState.SUCCEEDED:
            raise ValueError("Positive evidence states require successful retrieval")
        parsed = {ExtractionState.EXACT, ExtractionState.REVIEWED}
        if self.state in {SourceState.NO_DEPARTURES, SourceState.NO_COMPATIBLE}:
            if self.extraction not in parsed:
                raise ValueError("Absence claims require successful interpretation")
        if self.extraction in parsed and (
            self.parser_version is None or self.retrieval != RetrievalState.SUCCEEDED
        ):
            raise ValueError("Interpreted evidence requires parser identity and retrieval success")
        if not self.confidence_reasons:
            raise ValueError("Evidence limitations/reasons must remain visible")
        return self
