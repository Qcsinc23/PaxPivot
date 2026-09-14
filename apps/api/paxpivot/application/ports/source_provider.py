from typing import Protocol

from paxpivot.application.parsers.amc_terminal_facts import ParsedFact
from paxpivot.application.result import Result
from paxpivot.domain.source import SourceIdentity, SourceObservation


class SourceProvider(Protocol):
    """Metadata-only port. Caller must enforce source policy before retrieval.

    Expected source failures return a SourceObservation with explicit failure state.
    Application/configuration failures return Failure. Never return raw artifacts.
    No implementation or source is enabled by this scaffold.

    ``provider_id`` is the adapter's own identity, and it must equal the ``adapter_id`` the
    registry records for a source before that adapter may observe it. Without a declared
    identity the pipeline cannot tell which adapter produced a result, so an ADAPTER-scope
    kill switch would key on a value the caller never had to honour, and one adapter could
    answer for a source configured against another. Implementations must therefore expose it;
    ``record_observation`` refuses a provider whose identity does not match the registry.

    Declared as a read-only property so that a plain attribute and a frozen dataclass field both
    satisfy the port: an adapter's identity is fixed at construction and never reassigned.
    """

    @property
    def provider_id(self) -> str: ...

    async def observe(self, source: SourceIdentity) -> Result[SourceObservation]: ...


class TerminalFactProvider(Protocol):
    """Additive, metadata-only port (TASK-048): parsed terminal operating facts, never a body.

    Deliberately a *separate* Protocol from ``SourceProvider`` rather than a change to
    ``observe``'s signature: a concrete adapter satisfies both by having both methods (Python's
    structural typing does not require inheritance), so nothing else that already implements
    ``SourceProvider`` — the ~8 fakes across the test suite plus ``FirecrawlSourceProvider`` —
    needs a stub method it never uses. Callers that record facts pass the same provider instance
    for both parameters.

    Never returns a raw document: a ``ParsedFact`` is already a short, bounded, verbatim span
    (``application/parsers/amc_terminal_facts.py``). The caller (``source_pipeline.py``) is
    responsible for policy authorization, deduplication and persistence; this port only reports
    what the page's own text supports for a given source, or an empty tuple when it supports
    none, or when the source is not a terminal page at all.

    ``provider_id`` mirrors ``SourceProvider.provider_id`` for the same reason: the pipeline
    checks it against the registry's ``adapter_id`` before recording any fact.
    """

    @property
    def provider_id(self) -> str: ...

    async def observe_facts(self, source: SourceIdentity) -> Result[tuple[ParsedFact, ...]]: ...
