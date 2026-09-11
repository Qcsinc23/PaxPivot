"""Read models for the first live slice (Terminals + Advanced source health).

These are the wire contracts of the read API (``/api/v1``) and the only input to the web
presentation adapters. They carry decided facts: unknown stays ``None``, a failed retrieval is
an observation with its failure state (never an absence), and nothing here re-derives a
``SourceState`` from timestamps. No raw source payload or payload reference is exposed.
"""

from uuid import UUID

from pydantic import AwareDatetime, HttpUrl

from paxpivot.domain.base import Contract, Identifier
from paxpivot.domain.source import (
    ExtractionState,
    PolicyReviewState,
    RetrievalState,
    SourceKind,
    SourceState,
)
from paxpivot.domain.terminal import Coordinates, TerminalFactKind


class SourceEvidenceRead(Contract):
    """Summary of one source's latest observation."""

    observation_id: UUID
    state: SourceState
    observed_at: AwareDatetime
    source_time: AwareDatetime | None  # Unknown stays None; never backfilled.
    retrieval: RetrievalState
    extraction: ExtractionState
    parser_version: Identifier | None
    explanation: str  # TASK-002 deterministic wording for `state`.


class TerminalSourceRead(Contract):
    source_id: UUID
    name: Identifier
    url: HttpUrl
    kind: SourceKind
    enabled: bool
    review_state: PolicyReviewState
    latest: SourceEvidenceRead | None  # None: never observed.


class TerminalSummaryRead(Contract):
    terminal_id: UUID
    name: Identifier
    installation: Identifier | None
    timezone: Identifier
    operational_state: str
    # Verified passenger entrance only. Base coordinates are never exposed as a location.
    entrance: Coordinates | None
    entrance_kind: str | None
    official_url: HttpUrl | None  # The terminal's registered terminal-page source, if any.
    latest: SourceEvidenceRead | None  # Newest observation across the terminal's sources.


class TerminalFactRead(Contract):
    fact_id: UUID
    kind: TerminalFactKind
    value: str
    observed_at: AwareDatetime
    source_time: AwareDatetime | None
    source_url: HttpUrl
    effective_from: AwareDatetime | None
    effective_to: AwareDatetime | None


class TerminalNetworkRead(Contract):
    generated_at: AwareDatetime
    terminals: tuple[TerminalSummaryRead, ...]


class TerminalDetailRead(Contract):
    generated_at: AwareDatetime
    summary: TerminalSummaryRead
    entrance_instructions: str | None
    facts: tuple[TerminalFactRead, ...]
    sources: tuple[TerminalSourceRead, ...]


class SourceHealthRowRead(Contract):
    source_id: UUID
    name: Identifier
    url: HttpUrl
    kind: SourceKind
    terminal_id: UUID | None
    enabled: bool
    review_state: PolicyReviewState
    cadence_minutes: int | None
    adapter_id: Identifier | None
    adapter_version: Identifier | None
    kill_switched: bool
    latest: SourceEvidenceRead | None


class SourceStateCount(Contract):
    state: SourceState
    count: int


class SourceHealthRead(Contract):
    generated_at: AwareDatetime
    rows: tuple[SourceHealthRowRead, ...]
    counts: tuple[SourceStateCount, ...]  # Sources with no observation are not counted.
    never_observed: int
