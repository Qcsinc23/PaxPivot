"""In-memory fakes and deterministic fixtures for the Sources + Terminals slice.

Everything is synthetic (``example.invalid`` URLs, UUID5 identifiers, fixed timestamps) so the
read-service and API tests, and the JSON examples the web adapters consume, are reproducible.
"""

from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from uuid import NAMESPACE_URL, UUID, uuid5

from paxpivot.domain.source import (
    ExtractionState,
    KillSwitch,
    KillSwitchScope,
    PolicyReviewState,
    Provenance,
    RawPayloadPolicy,
    RetrievalState,
    Source,
    SourceIdentity,
    SourceKind,
    SourceObservation,
    SourceProcessingPolicy,
    SourceState,
)
from paxpivot.domain.terminal import (
    Coordinates,
    Terminal,
    TerminalFactKind,
    TerminalOperationalFact,
    VerifiedEntrance,
)
from pydantic import HttpUrl

NOW = datetime(2026, 9, 10, 12, 0, tzinfo=UTC)
T0 = datetime(2026, 9, 10, 9, 0, tzinfo=UTC)

# The adapter the fixture sources are registered against (``Source.adapter_id``) and the
# identity the fixture observations are stamped with (``Provenance.provider_id``). One constant
# because the pipeline requires them to agree before a provider may observe a source.
ADAPTER_ID = "synthetic-adapter"


def uid(label: str) -> UUID:
    return uuid5(NAMESPACE_URL, f"paxpivot:test:{label}")


APPROVED = SourceProcessingPolicy(
    policy_version_id="synthetic-approved-v1",
    review_state=PolicyReviewState.APPROVED,
    may_retrieve=True,
    may_parse=True,
    may_summarize=False,
    may_display=True,
    may_aggregate_history=False,
    raw_payload=RawPayloadPolicy.HASH_ONLY,
    snapshot_retention_days=None,
    reviewer="synthetic-reviewer",
    reviewed_at=T0,
)
NEEDS_REVIEW = SourceProcessingPolicy(
    policy_version_id="synthetic-review-v1",
    review_state=PolicyReviewState.NEEDS_REVIEW,
    may_retrieve=True,
    may_parse=False,
    may_summarize=False,
    may_display=False,
    may_aggregate_history=False,
    raw_payload=RawPayloadPolicy.DENIED,
    snapshot_retention_days=None,
    reviewer=None,
    reviewed_at=None,
)
PAUSED = NEEDS_REVIEW.model_copy(
    update={"review_state": PolicyReviewState.PAUSED, "policy_version_id": "synthetic-paused-v1"}
)
RESTRICTED = NEEDS_REVIEW.model_copy(
    update={
        "review_state": PolicyReviewState.RESTRICTED,
        "policy_version_id": "synthetic-restricted-v1",
    }
)


def source(
    label: str,
    *,
    kind: SourceKind = SourceKind.TERMINAL_PAGE,
    terminal: str | None = None,
    policy: SourceProcessingPolicy = APPROVED,
    enabled: bool = True,
    adapter: str | None = ADAPTER_ID,
    cadence: int | None = 30,
) -> Source:
    return Source(
        identity=SourceIdentity(
            source_id=uid(f"source:{label}"),
            url=HttpUrl(f"https://example.invalid/{label}"),
            authority="synthetic",
        ),
        name=f"Example {label}",
        kind=kind,
        terminal_id=uid(f"terminal:{terminal}") if terminal else None,
        enabled=enabled,
        cadence_minutes=cadence,
        adapter_id=adapter,
        adapter_version="v0-synthetic" if adapter else None,
        policy=policy,
        created_at=T0,
        updated_at=T0,
    )


def provenance(src: Source, observed_at: datetime, source_time: datetime | None) -> Provenance:
    return Provenance(
        source=src.identity,
        observed_at=observed_at,
        source_time=source_time,
        provider_id=ADAPTER_ID,
        policy_version_id=src.policy.policy_version_id,
    )


def observation(
    src: Source,
    label: str,
    *,
    state: SourceState,
    observed_at: datetime,
    source_time: datetime | None = None,
    retrieval: RetrievalState = RetrievalState.SUCCEEDED,
    extraction: ExtractionState = ExtractionState.NOT_ATTEMPTED,
    parser_version: str | None = None,
    reasons: tuple[str, ...] = ("synthetic",),
    content_hash: str | None = None,
) -> SourceObservation:
    return SourceObservation(
        observation_id=uid(f"observation:{label}"),
        provenance=provenance(src, observed_at, source_time),
        state=state,
        retrieval=retrieval,
        extraction=extraction,
        parser_version=parser_version,
        # A hash is only present when a caller asks for one: `raw_payload=denied` forbids it.
        content_hash=(
            None if content_hash is None or retrieval != RetrievalState.SUCCEEDED else content_hash
        ),
        confidence_reasons=reasons,
    )


def terminal(label: str, src: Source, *, verified: bool) -> Terminal:
    entrance = None
    if verified:
        entrance = VerifiedEntrance(
            kind="passenger_terminal",
            coordinates=Coordinates(latitude=0.5, longitude=0.5),
            verification=provenance(src, T0, None),
            instructions="Synthetic instructions: use the passenger terminal entrance.",
        )
    return Terminal(
        terminal_id=uid(f"terminal:{label}"),
        name=f"Example Terminal {label}",
        installation=f"Example Installation {label}",
        timezone="UTC",
        operational_state="verified" if verified else "unknown",
        evidence=provenance(src, T0, None),
        entrance=entrance,
        base_coordinates=Coordinates(latitude=0.0, longitude=0.0) if verified else None,
    )


def fact(
    term: Terminal, src: Source, kind: TerminalFactKind, value: str
) -> TerminalOperationalFact:
    return TerminalOperationalFact(
        fact_id=uid(f"fact:{term.name}:{kind.value}:{value}"),
        terminal_id=term.terminal_id,
        kind=kind,
        value=value,
        provenance=provenance(src, T0, None),
        effective_from=None,
        effective_to=None,
        recorded_at=T0,
    )


# ── fixture world ───────────────────────────────────────────────────────

DIRECTORY = source(
    "directory", kind=SourceKind.DIRECTORY_PAGE, policy=NEEDS_REVIEW, adapter=None, cadence=None
)
SOURCE_A = source("terminal-a", terminal="a")
SOURCE_B = source("terminal-b", terminal="b")
SOURCE_C = source("terminal-c", terminal="c", policy=PAUSED, enabled=False)
SOURCE_D = source("terminal-d", terminal="d", policy=RESTRICTED, enabled=False, adapter=None)
SOURCES = (DIRECTORY, SOURCE_A, SOURCE_B, SOURCE_C, SOURCE_D)

TERMINAL_A = terminal("a", DIRECTORY, verified=True)
TERMINAL_B = terminal("b", DIRECTORY, verified=False)
TERMINAL_C = terminal("c", DIRECTORY, verified=False)
TERMINAL_D = terminal("d", DIRECTORY, verified=False)
TERMINALS = (TERMINAL_A, TERMINAL_B, TERMINAL_C, TERMINAL_D)

OBSERVATIONS = (
    # Source A: an older fresh read, then a newer fresh read with a known page time.
    observation(SOURCE_A, "a-1", state=SourceState.FRESH, observed_at=T0, source_time=None),
    observation(
        SOURCE_A,
        "a-2",
        state=SourceState.FRESH,
        observed_at=datetime(2026, 9, 10, 11, 30, tzinfo=UTC),
        source_time=datetime(2026, 9, 10, 11, 0, tzinfo=UTC),
        extraction=ExtractionState.EXACT,
        parser_version="synthetic-parser-v1",
    ),
    # Source B: the latest check failed. That is a failure state, never an absence.
    observation(
        SOURCE_B,
        "b-1",
        state=SourceState.UNREACHABLE,
        observed_at=datetime(2026, 9, 10, 11, 45, tzinfo=UTC),
        retrieval=RetrievalState.FAILED,
        reasons=("retrieval_failed",),
    ),
    # Sources C and D and the directory were never observed.
)

FACTS = (
    fact(TERMINAL_A, SOURCE_A, TerminalFactKind.COUNTER_HOURS, "Synthetic hours: 06:00–22:00"),
    fact(TERMINAL_A, SOURCE_A, TerminalFactKind.PHONE, "+1 000 000 0000 (synthetic)"),
)

SWITCHES = (
    KillSwitch(
        switch_id=uid("switch:b"),
        scope=KillSwitchScope.SOURCE,
        key=str(SOURCE_B.identity.source_id),
        reason="synthetic_incident",
        engaged_at=NOW,
        released_at=None,
    ),
)


class FakeSources:
    def __init__(self, items: Sequence[Source] = SOURCES) -> None:
        self.items = list(items)

    def list_sources(self) -> Sequence[Source]:
        return sorted(self.items, key=lambda s: s.name)

    def get_source(self, source_id: UUID) -> Source | None:
        return next((s for s in self.items if s.identity.source_id == source_id), None)

    def list_terminal_sources(self, terminal_id: UUID) -> Sequence[Source]:
        return [s for s in self.list_sources() if s.terminal_id == terminal_id]


class FakeObservations:
    def __init__(self, items: Sequence[SourceObservation] = OBSERVATIONS) -> None:
        self.items = list(items)

    def append(self, observation: SourceObservation) -> None:
        if any(o.observation_id == observation.observation_id for o in self.items):
            raise ValueError("duplicate observation")
        self.items.append(observation)

    def latest_per_source(self) -> Mapping[UUID, SourceObservation]:
        # Same rule as the SQL except the tie-break: the domain model has no recorded_at, so
        # equal observed_at falls straight to observation_id here. Keep such ties out of fixtures.
        superseded = {
            o.supersedes_observation_id for o in self.items if o.supersedes_observation_id
        }
        latest: dict[UUID, SourceObservation] = {}
        for o in self.items:
            if o.observation_id in superseded:
                continue
            sid = o.provenance.source.source_id
            key = (o.provenance.observed_at, str(o.observation_id))
            if sid not in latest or key > (
                latest[sid].provenance.observed_at,
                str(latest[sid].observation_id),
            ):
                latest[sid] = o
        return latest

    def list_for_source(self, source_id: UUID, *, limit: int) -> Sequence[SourceObservation]:
        mine = [o for o in self.items if o.provenance.source.source_id == source_id]
        return sorted(mine, key=lambda o: o.provenance.observed_at, reverse=True)[:limit]


class FakeTerminals:
    def __init__(
        self,
        items: Sequence[Terminal] = TERMINALS,
        facts: Sequence[TerminalOperationalFact] = FACTS,
    ) -> None:
        self.items = list(items)
        self.facts = list(facts)

    def list_terminals(self) -> Sequence[Terminal]:
        return sorted(self.items, key=lambda t: t.name)

    def get_terminal(self, terminal_id: UUID) -> Terminal | None:
        return next((t for t in self.items if t.terminal_id == terminal_id), None)

    def list_current_facts(self, terminal_id: UUID) -> Sequence[TerminalOperationalFact]:
        return sorted(
            (f for f in self.facts if f.terminal_id == terminal_id and f.effective_to is None),
            key=lambda f: f.kind.value,
        )

    def append_fact(self, fact: TerminalOperationalFact) -> None:
        self.facts.append(fact)


class FakeSwitches:
    def __init__(self, items: Sequence[KillSwitch] = SWITCHES) -> None:
        self.items = list(items)

    def list_engaged(self) -> Sequence[KillSwitch]:
        return [s for s in self.items if s.engaged]

    def engage(self, switch: KillSwitch) -> None:
        self.items.append(switch)


def provenance_with_url(src: Source, url: str, observed_at: datetime | None = None) -> Provenance:
    """Provenance as a provider would report it, with a caller-chosen URL."""
    return Provenance(
        source=SourceIdentity(
            source_id=src.identity.source_id,
            url=HttpUrl(url),
            authority=src.identity.authority,
        ),
        observed_at=observed_at or T0,
        source_time=None,
        provider_id=ADAPTER_ID,
        policy_version_id=src.policy.policy_version_id,
    )
