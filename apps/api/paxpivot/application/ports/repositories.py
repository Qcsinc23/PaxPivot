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

# Reader ports: what a read use case (and a GET route) is handed. They carry no mutation
# method, so a read path cannot even name a write; the database read-only snapshot enforces the
# same boundary underneath (TASK-026).


class SourceReader(Protocol):
    def list_sources(self) -> Sequence[Source]: ...

    def get_source(self, source_id: UUID) -> Source | None: ...

    def list_terminal_sources(self, terminal_id: UUID) -> Sequence[Source]: ...


class ObservationReader(Protocol):
    def latest_per_source(self) -> Mapping[UUID, SourceObservation]:
        """The current observation of every source that has one.

        Current = the leaf observations (those no other observation of the same source
        explicitly supersedes), ranked by observed_at, recorded_at, observation_id, newest first.
        Explicit supersession outranks temporal order (ADR-004).
        """
        ...

    def list_for_source(self, source_id: UUID, *, limit: int) -> Sequence[SourceObservation]:
        """Newest first, superseded rows included: history is never hidden."""
        ...


class TerminalReader(Protocol):
    def list_terminals(self) -> Sequence[Terminal]: ...

    def get_terminal(self, terminal_id: UUID) -> Terminal | None: ...

    def list_current_facts(self, terminal_id: UUID) -> Sequence[TerminalOperationalFact]:
        """The newest open (effective_to is null) fact of each kind."""
        ...


class KillSwitchReader(Protocol):
    def list_engaged(self) -> Sequence[KillSwitch]: ...


# Repository ports: readers plus the append-only writes, for write units of work only.


class SourceRepository(SourceReader, Protocol):
    pass


class SourceObservationRepository(ObservationReader, Protocol):
    def append(self, observation: SourceObservation) -> None:
        """Insert a new immutable observation. Never updates or replaces an earlier one."""
        ...


class TerminalRepository(TerminalReader, Protocol):
    def append_fact(self, fact: TerminalOperationalFact) -> None:
        """Append a new immutable fact. Never updates or replaces an earlier one."""
        ...


class KillSwitchRepository(KillSwitchReader, Protocol):
    def engage(self, switch: KillSwitch) -> None:
        """Record an engaged switch. Engaging never deletes history."""
        ...
