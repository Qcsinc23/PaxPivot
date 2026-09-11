"""Application-facing persistence ports for the Sources + Terminals slice.

Synchronous on purpose: the API composes them per request on a SQLAlchemy Core connection
(ADR-004). They expose domain contracts only, never rows or ORM objects, and they support the
current read use cases rather than generic CRUD. Observations and facts are append-only.
"""

from collections.abc import Mapping, Sequence
from typing import Protocol
from uuid import UUID

from paxpivot.domain.source import KillSwitch, Source, SourceObservation
from paxpivot.domain.terminal import Terminal, TerminalOperationalFact


class SourceRepository(Protocol):
    def list_sources(self) -> Sequence[Source]: ...

    def get_source(self, source_id: UUID) -> Source | None: ...

    def list_terminal_sources(self, terminal_id: UUID) -> Sequence[Source]: ...


class SourceObservationRepository(Protocol):
    def append(self, observation: SourceObservation) -> None:
        """Insert a new immutable observation. Never updates or replaces an earlier one."""
        ...

    def latest_per_source(self) -> Mapping[UUID, SourceObservation]:
        """The most recent observation (by observed_at) for every source that has one."""
        ...

    def list_for_source(self, source_id: UUID, *, limit: int) -> Sequence[SourceObservation]:
        """Newest first."""
        ...


class TerminalRepository(Protocol):
    def list_terminals(self) -> Sequence[Terminal]: ...

    def get_terminal(self, terminal_id: UUID) -> Terminal | None: ...

    def list_current_facts(self, terminal_id: UUID) -> Sequence[TerminalOperationalFact]:
        """The newest open (effective_to is null) fact of each kind."""
        ...

    def append_fact(self, fact: TerminalOperationalFact) -> None:
        """Append a new immutable fact. Never updates or replaces an earlier one."""
        ...


class KillSwitchRepository(Protocol):
    def list_engaged(self) -> Sequence[KillSwitch]: ...

    def engage(self, switch: KillSwitch) -> None:
        """Record an engaged switch. Engaging never deletes history."""
        ...
