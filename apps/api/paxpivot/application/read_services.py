"""Deterministic read use cases for the first live slice.

They compose repository ports into read models. Rules encoded here (and nowhere else):

* a terminal's headline evidence is the newest observation across its registered sources,
  chosen by ``observed_at``; a terminal whose sources were never observed has ``latest=None``;
* a source with no observation is reported as never observed, not as any ``SourceState``;
* the entrance is exposed only when the registry holds a verified entrance;
* kill switches are reported as a flag; they never change an observation.
"""

from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from uuid import UUID

from paxpivot.application.ports.repositories import (
    KillSwitchReader,
    ObservationReader,
    SourceReader,
    TerminalReader,
)
from paxpivot.application.read_models import (
    SourceEvidenceRead,
    SourceHealthRead,
    SourceHealthRowRead,
    SourceStateCount,
    TerminalDetailRead,
    TerminalFactRead,
    TerminalNetworkRead,
    TerminalSourceRead,
    TerminalSummaryRead,
)
from paxpivot.application.result import ApplicationError, Failure, Result, Success
from paxpivot.application.source_explanation import explain_source
from paxpivot.application.source_gate import engaged_switch
from paxpivot.domain.source import (
    KillSwitch,
    ProcessingMode,
    Source,
    SourceKind,
    SourceObservation,
    SourceState,
)
from paxpivot.domain.terminal import Terminal, TerminalOperationalFact


def evidence_read(observation: SourceObservation) -> SourceEvidenceRead:
    return SourceEvidenceRead(
        observation_id=observation.observation_id,
        state=observation.state,
        observed_at=observation.provenance.observed_at,
        source_time=observation.provenance.source_time,
        retrieval=observation.retrieval,
        extraction=observation.extraction,
        parser_version=observation.parser_version,
        explanation=explain_source(observation),
    )


def newest(observations: Sequence[SourceObservation]) -> SourceObservation | None:
    return max(observations, key=lambda o: o.provenance.observed_at, default=None)


def terminal_summary(
    terminal: Terminal,
    sources: Sequence[Source],
    latest: Mapping[UUID, SourceObservation],
) -> TerminalSummaryRead:
    observed = [latest[s.identity.source_id] for s in sources if s.identity.source_id in latest]
    official = next((s for s in sources if s.kind == SourceKind.TERMINAL_PAGE), None)
    headline = newest(observed)
    return TerminalSummaryRead(
        terminal_id=terminal.terminal_id,
        name=terminal.name,
        installation=terminal.installation,
        timezone=terminal.timezone,
        operational_state=terminal.operational_state,
        entrance=terminal.entrance.coordinates if terminal.entrance else None,
        entrance_kind=terminal.entrance.kind if terminal.entrance else None,
        official_url=official.identity.url if official else None,
        latest=evidence_read(headline) if headline else None,
    )


def list_terminal_network(
    terminals: TerminalReader,
    sources: SourceReader,
    observations: ObservationReader,
    *,
    now: datetime | None = None,
) -> TerminalNetworkRead:
    latest = observations.latest_per_source()
    return TerminalNetworkRead(
        generated_at=now or datetime.now(UTC),
        terminals=tuple(
            terminal_summary(t, sources.list_terminal_sources(t.terminal_id), latest)
            for t in terminals.list_terminals()
        ),
    )


def fact_read(fact: TerminalOperationalFact) -> TerminalFactRead:
    return TerminalFactRead(
        fact_id=fact.fact_id,
        kind=fact.kind,
        value=fact.value,
        observed_at=fact.provenance.observed_at,
        source_time=fact.provenance.source_time,
        source_url=fact.provenance.source.url,
        effective_from=fact.effective_from,
        effective_to=fact.effective_to,
    )


def displayable_facts(
    facts: Sequence[TerminalOperationalFact], sources: SourceReader
) -> tuple[TerminalOperationalFact, ...]:
    """Only facts whose producing source currently permits display leave this service.

    A fact is extracted source content. Its existence is not permission to reproduce it: if the
    register no longer approves that source for display, the content is withheld. The check is
    deliberately fail-closed — an unknown or missing source yields nothing.
    """
    allowed: list[TerminalOperationalFact] = []
    for fact in facts:
        source = sources.get_source(fact.provenance.source.source_id)
        if source is not None and source.policy.allows(ProcessingMode.DISPLAY):
            allowed.append(fact)
    return tuple(allowed)


def get_terminal_detail(
    terminal_id: UUID,
    terminals: TerminalReader,
    sources: SourceReader,
    observations: ObservationReader,
    *,
    now: datetime | None = None,
) -> Result[TerminalDetailRead]:
    terminal = terminals.get_terminal(terminal_id)
    if terminal is None:
        return Failure(
            error=ApplicationError(
                code="unavailable", message_key="terminal.not_found", retryable=False
            )
        )
    latest = observations.latest_per_source()
    terminal_sources = sources.list_terminal_sources(terminal_id)
    return Success(
        value=TerminalDetailRead(
            generated_at=now or datetime.now(UTC),
            summary=terminal_summary(terminal, terminal_sources, latest),
            entrance_instructions=terminal.entrance.instructions if terminal.entrance else None,
            facts=tuple(
                fact_read(f)
                for f in displayable_facts(terminals.list_current_facts(terminal_id), sources)
            ),
            sources=tuple(
                TerminalSourceRead(
                    source_id=s.identity.source_id,
                    name=s.name,
                    url=s.identity.url,
                    kind=s.kind,
                    enabled=s.enabled,
                    review_state=s.policy.review_state,
                    latest=(
                        evidence_read(latest[s.identity.source_id])
                        if s.identity.source_id in latest
                        else None
                    ),
                )
                for s in terminal_sources
            ),
        )
    )


def health_row(
    source: Source, latest: SourceObservation | None, switches: Sequence[KillSwitch]
) -> SourceHealthRowRead:
    switched = any(engaged_switch(source, mode, switches) is not None for mode in ProcessingMode)
    return SourceHealthRowRead(
        source_id=source.identity.source_id,
        name=source.name,
        url=source.identity.url,
        kind=source.kind,
        terminal_id=source.terminal_id,
        enabled=source.enabled,
        review_state=source.policy.review_state,
        cadence_minutes=source.cadence_minutes,
        adapter_id=source.adapter_id,
        adapter_version=source.adapter_version,
        kill_switched=switched,
        latest=evidence_read(latest) if latest else None,
    )


def list_source_health(
    sources: SourceReader,
    observations: ObservationReader,
    kill_switches: KillSwitchReader,
    *,
    now: datetime | None = None,
) -> SourceHealthRead:
    latest = observations.latest_per_source()
    switches = kill_switches.list_engaged()
    rows = tuple(
        health_row(s, latest.get(s.identity.source_id), switches) for s in sources.list_sources()
    )
    counts: dict[SourceState, int] = {}
    for row in rows:
        if row.latest is not None:
            counts[row.latest.state] = counts.get(row.latest.state, 0) + 1
    return SourceHealthRead(
        generated_at=now or datetime.now(UTC),
        rows=rows,
        counts=tuple(
            SourceStateCount(state=state, count=count)
            for state, count in sorted(counts.items(), key=lambda item: item[0].value)
        ),
        never_observed=sum(1 for row in rows if row.latest is None),
    )
