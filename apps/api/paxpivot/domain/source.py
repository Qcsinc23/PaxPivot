from enum import StrEnum
from typing import Self
from uuid import UUID

from pydantic import AwareDatetime, Field, HttpUrl, model_validator

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
    # Reference to a raw snapshot held outside the database, only when the source policy
    # permits SNAPSHOT storage. Never the payload itself; None means nothing was retained.
    payload_ref: Identifier | None = None
    # The earlier observation this one revises/withdraws, when the parser established that.
    supersedes_observation_id: UUID | None = None

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
        if self.payload_ref is not None and self.retrieval != RetrievalState.SUCCEEDED:
            raise ValueError("A retained payload requires successful retrieval")
        if self.supersedes_observation_id == self.observation_id:
            raise ValueError("An observation cannot supersede itself")
        return self


# ── Source registry and processing policy (production PRD §9, §15, §17; pilot SRC-002/003) ──


class SourceKind(StrEnum):
    TERMINAL_PAGE = "terminal_page"
    SCHEDULE_ARTIFACT = "schedule_artifact"
    DIRECTORY_PAGE = "directory_page"
    POLICY_DOCUMENT = "policy_document"


class PolicyReviewState(StrEnum):
    """Operational review state of a source's processing register entry."""

    APPROVED = "approved"
    NEEDS_REVIEW = "needs_review"  # Default. Monitor page/hash/health only (pilot §16.2).
    PAUSED = "paused"
    RESTRICTED = "restricted"  # User-opened only; never retrieved or processed by PaxPivot.


class RawPayloadPolicy(StrEnum):
    DENIED = "denied"  # Metadata and extracted facts only; no hash of body content.
    HASH_ONLY = "hash_only"  # Content hash for change detection; no body retained.
    SNAPSHOT = "snapshot"  # Body may be retained outside the database, by reference, for a term.


class ProcessingMode(StrEnum):
    RETRIEVE = "retrieve"
    PARSE = "parse"
    STORE_RAW = "store_raw"
    SUMMARIZE = "summarize"
    DISPLAY = "display"
    AGGREGATE_HISTORY = "aggregate_history"


class SourceProcessingPolicy(Contract):
    """Deterministic, auditable answer to "may PaxPivot do X with this source?".

    Public accessibility is not permission (pilot §16.2). Until a source-specific review
    approves processing, only retrieval of page/link/timestamp/hash/health metadata is
    allowed, and only when `may_retrieve` is set. `paused` and `restricted` allow nothing.
    """

    policy_version_id: Identifier
    review_state: PolicyReviewState
    may_retrieve: bool
    may_parse: bool
    may_summarize: bool
    may_display: bool
    may_aggregate_history: bool
    raw_payload: RawPayloadPolicy
    snapshot_retention_days: int | None = Field(default=None, gt=0)
    reviewer: Identifier | None
    reviewed_at: AwareDatetime | None

    @model_validator(mode="after")
    def review_consistency(self) -> Self:
        if self.review_state == PolicyReviewState.APPROVED and (
            self.reviewer is None or self.reviewed_at is None
        ):
            raise ValueError("Approval requires a reviewer and a review time")
        if (self.raw_payload == RawPayloadPolicy.SNAPSHOT) != (
            self.snapshot_retention_days is not None
        ):
            raise ValueError("Snapshot retention is required exactly when snapshots are allowed")
        return self

    def allows(self, mode: ProcessingMode) -> bool:
        if self.review_state in {PolicyReviewState.PAUSED, PolicyReviewState.RESTRICTED}:
            return False
        if self.review_state == PolicyReviewState.NEEDS_REVIEW:
            return mode == ProcessingMode.RETRIEVE and self.may_retrieve
        return {
            ProcessingMode.RETRIEVE: self.may_retrieve,
            ProcessingMode.PARSE: self.may_parse,
            ProcessingMode.STORE_RAW: self.raw_payload == RawPayloadPolicy.SNAPSHOT,
            ProcessingMode.SUMMARIZE: self.may_summarize,
            ProcessingMode.DISPLAY: self.may_display,
            ProcessingMode.AGGREGATE_HISTORY: self.may_aggregate_history,
        }[mode]


class Source(Contract):
    """A registered public source. Carries no secrets and no retrieved content."""

    identity: SourceIdentity
    name: Identifier
    kind: SourceKind
    terminal_id: UUID | None
    enabled: bool
    cadence_minutes: int | None = Field(default=None, gt=0)  # None: not scheduled.
    adapter_id: Identifier | None
    adapter_version: Identifier | None
    policy: SourceProcessingPolicy
    created_at: AwareDatetime
    updated_at: AwareDatetime


class KillSwitchScope(StrEnum):
    SOURCE = "source"  # key: source_id
    ADAPTER = "adapter"  # key: adapter_id (a provider/adapter class)
    MODE = "mode"  # key: ProcessingMode value, e.g. "parse"


class KillSwitch(Contract):
    """Stops processing without deleting anything. Released switches stay as history."""

    switch_id: UUID
    scope: KillSwitchScope
    key: Identifier
    reason: Identifier  # Static reason code, never free text copied from a source.
    engaged_at: AwareDatetime
    released_at: AwareDatetime | None

    @property
    def engaged(self) -> bool:
        return self.released_at is None

    @model_validator(mode="after")
    def key_matches_scope(self) -> Self:
        """A mistyped key must be rejected, never silently inert.

        A safety switch that never matches anything fails *open*: an operator believes
        processing is stopped while it continues. Each scope therefore pins the shape of its
        key to the value the gate actually compares against.
        """
        if self.scope == KillSwitchScope.MODE:
            allowed = {mode.value for mode in ProcessingMode}
            if self.key not in allowed:
                raise ValueError(
                    f"A mode switch key must be one of {sorted(allowed)}, not {self.key!r}"
                )
        elif self.scope == KillSwitchScope.SOURCE:
            try:
                UUID(self.key)
            except ValueError as exc:
                raise ValueError("A source switch key must be a canonical source UUID") from exc
        return self
