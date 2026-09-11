"""SQLAlchemy Core implementations of the repository ports (ADR-004).

Each repository holds one ``Connection`` for one request/unit of work. Rows are mapped to
domain contracts here and nowhere else. ``append`` is the only write on observations; the
database trigger rejects any UPDATE/DELETE, so history cannot be rewritten from Python either.
"""

from collections.abc import Mapping, Sequence
from typing import Any
from uuid import UUID

from sqlalchemy import Connection, Row, func, insert, select

from paxpivot.domain.source import (
    KillSwitch,
    Provenance,
    Source,
    SourceIdentity,
    SourceObservation,
    SourceProcessingPolicy,
)
from paxpivot.domain.terminal import (
    Coordinates,
    Terminal,
    TerminalOperationalFact,
    VerifiedEntrance,
)
from paxpivot.infrastructure import database as db


def _provenance(row: Row[Any], prefix: str = "") -> Provenance:
    return Provenance(
        source=SourceIdentity(
            source_id=row._mapping[f"{prefix}source_id"],
            url=row._mapping[f"{prefix}source_url"],
            authority=row._mapping[f"{prefix}source_authority"],
        ),
        observed_at=row._mapping[f"{prefix}observed_at"],
        source_time=row._mapping[f"{prefix}source_time"],
        provider_id=row._mapping[f"{prefix}provider_id"],
        policy_version_id=row._mapping[f"{prefix}policy_version_id"],
    )


def _source(row: Row[Any]) -> Source:
    m = row._mapping
    return Source(
        identity=SourceIdentity(source_id=m["source_id"], url=m["url"], authority=m["authority"]),
        name=m["name"],
        kind=m["kind"],
        terminal_id=m["terminal_id"],
        enabled=m["enabled"],
        cadence_minutes=m["cadence_minutes"],
        adapter_id=m["adapter_id"],
        adapter_version=m["adapter_version"],
        policy=SourceProcessingPolicy(
            policy_version_id=m["policy_version_id"],
            review_state=m["review_state"],
            may_retrieve=m["may_retrieve"],
            may_parse=m["may_parse"],
            may_summarize=m["may_summarize"],
            may_display=m["may_display"],
            may_aggregate_history=m["may_aggregate_history"],
            raw_payload=m["raw_payload"],
            snapshot_retention_days=m["snapshot_retention_days"],
            reviewer=m["reviewer"],
            reviewed_at=m["reviewed_at"],
        ),
        created_at=m["created_at"],
        updated_at=m["updated_at"],
    )


def source_row(source: Source) -> dict[str, Any]:
    p = source.policy
    return {
        "source_id": source.identity.source_id,
        "url": str(source.identity.url),
        "authority": source.identity.authority,
        "name": source.name,
        "kind": source.kind.value,
        "terminal_id": source.terminal_id,
        "enabled": source.enabled,
        "cadence_minutes": source.cadence_minutes,
        "adapter_id": source.adapter_id,
        "adapter_version": source.adapter_version,
        "policy_version_id": p.policy_version_id,
        "review_state": p.review_state.value,
        "may_retrieve": p.may_retrieve,
        "may_parse": p.may_parse,
        "may_summarize": p.may_summarize,
        "may_display": p.may_display,
        "may_aggregate_history": p.may_aggregate_history,
        "raw_payload": p.raw_payload.value,
        "snapshot_retention_days": p.snapshot_retention_days,
        "reviewer": p.reviewer,
        "reviewed_at": p.reviewed_at,
        "created_at": source.created_at,
        "updated_at": source.updated_at,
    }


def _provenance_row(provenance: Provenance, prefix: str = "") -> dict[str, Any]:
    return {
        f"{prefix}source_id": provenance.source.source_id,
        f"{prefix}source_url": str(provenance.source.url),
        f"{prefix}source_authority": provenance.source.authority,
        f"{prefix}observed_at": provenance.observed_at,
        f"{prefix}source_time": provenance.source_time,
        f"{prefix}provider_id": provenance.provider_id,
        f"{prefix}policy_version_id": provenance.policy_version_id,
    }


def _observation(row: Row[Any]) -> SourceObservation:
    m = row._mapping
    return SourceObservation(
        observation_id=m["observation_id"],
        provenance=_provenance(row),
        state=m["state"],
        retrieval=m["retrieval"],
        extraction=m["extraction"],
        parser_version=m["parser_version"],
        content_hash=m["content_hash"],
        confidence_reasons=tuple(m["confidence_reasons"]),
        payload_ref=m["payload_ref"],
        supersedes_observation_id=m["supersedes_observation_id"],
    )


def observation_row(observation: SourceObservation) -> dict[str, Any]:
    return {
        "observation_id": observation.observation_id,
        **_provenance_row(observation.provenance),
        "state": observation.state.value,
        "retrieval": observation.retrieval.value,
        "extraction": observation.extraction.value,
        "parser_version": observation.parser_version,
        "content_hash": observation.content_hash,
        "confidence_reasons": list(observation.confidence_reasons),
        "payload_ref": observation.payload_ref,
        "supersedes_observation_id": observation.supersedes_observation_id,
    }


def _terminal(row: Row[Any]) -> Terminal:
    m = row._mapping
    entrance = None
    if m["entrance_kind"] is not None:
        entrance = VerifiedEntrance(
            kind=m["entrance_kind"],
            coordinates=Coordinates(
                latitude=m["entrance_latitude"], longitude=m["entrance_longitude"]
            ),
            verification=_provenance(row, "entrance_"),
            instructions=m["entrance_instructions"],
        )
    base = None
    if m["base_latitude"] is not None:
        base = Coordinates(latitude=m["base_latitude"], longitude=m["base_longitude"])
    return Terminal(
        terminal_id=m["terminal_id"],
        name=m["name"],
        installation=m["installation"],
        timezone=m["timezone"],
        operational_state=m["operational_state"],
        evidence=_provenance(row, "evidence_"),
        entrance=entrance,
        base_coordinates=base,
    )


def terminal_row(terminal: Terminal, *, created_at: Any, updated_at: Any) -> dict[str, Any]:
    row: dict[str, Any] = {
        "terminal_id": terminal.terminal_id,
        "name": terminal.name,
        "installation": terminal.installation,
        "timezone": terminal.timezone,
        "operational_state": terminal.operational_state,
        "base_latitude": terminal.base_coordinates.latitude if terminal.base_coordinates else None,
        "base_longitude": (
            terminal.base_coordinates.longitude if terminal.base_coordinates else None
        ),
        **_provenance_row(terminal.evidence, "evidence_"),
        "created_at": created_at,
        "updated_at": updated_at,
    }
    if terminal.entrance is not None:
        row.update(
            entrance_kind=terminal.entrance.kind,
            entrance_latitude=terminal.entrance.coordinates.latitude,
            entrance_longitude=terminal.entrance.coordinates.longitude,
            entrance_instructions=terminal.entrance.instructions,
            **_provenance_row(terminal.entrance.verification, "entrance_"),
        )
    return row


def _fact(row: Row[Any]) -> TerminalOperationalFact:
    m = row._mapping
    return TerminalOperationalFact(
        fact_id=m["fact_id"],
        terminal_id=m["terminal_id"],
        kind=m["kind"],
        value=m["value"],
        provenance=_provenance(row),
        effective_from=m["effective_from"],
        effective_to=m["effective_to"],
        recorded_at=m["recorded_at"],
    )


def fact_row(fact: TerminalOperationalFact) -> dict[str, Any]:
    return {
        "fact_id": fact.fact_id,
        "terminal_id": fact.terminal_id,
        "kind": fact.kind.value,
        "value": fact.value,
        **_provenance_row(fact.provenance),
        "effective_from": fact.effective_from,
        "effective_to": fact.effective_to,
        "recorded_at": fact.recorded_at,
    }


def _switch(row: Row[Any]) -> KillSwitch:
    m = row._mapping
    return KillSwitch(
        switch_id=m["switch_id"],
        scope=m["scope"],
        key=m["key"],
        reason=m["reason"],
        engaged_at=m["engaged_at"],
        released_at=m["released_at"],
    )


class SqlSourceRepository:
    def __init__(self, connection: Connection) -> None:
        self._c = connection

    def list_sources(self) -> Sequence[Source]:
        rows = self._c.execute(select(db.sources).order_by(db.sources.c.name)).all()
        return [_source(r) for r in rows]

    def get_source(self, source_id: UUID) -> Source | None:
        row = self._c.execute(select(db.sources).where(db.sources.c.source_id == source_id)).first()
        return _source(row) if row else None

    def list_terminal_sources(self, terminal_id: UUID) -> Sequence[Source]:
        rows = self._c.execute(
            select(db.sources)
            .where(db.sources.c.terminal_id == terminal_id)
            .order_by(db.sources.c.name)
        ).all()
        return [_source(r) for r in rows]


class SqlSourceObservationRepository:
    def __init__(self, connection: Connection) -> None:
        self._c = connection

    def append(self, observation: SourceObservation) -> None:
        self._c.execute(insert(db.source_observations).values(observation_row(observation)))

    def latest_per_source(self) -> Mapping[UUID, SourceObservation]:
        o = db.source_observations
        # A total order matters: `recorded_at` defaults to Postgres now(), which is the
        # transaction start time, so two observations appended in one transaction share it.
        # Without the id tiebreaker the "latest" row would be arbitrary.
        rank = (
            func.row_number()
            .over(
                partition_by=o.c.source_id,
                order_by=(
                    o.c.observed_at.desc(),
                    o.c.recorded_at.desc(),
                    o.c.observation_id.desc(),
                ),
            )
            .label("rank")
        )
        ranked = select(o, rank).subquery()
        rows = self._c.execute(select(ranked).where(ranked.c.rank == 1)).all()
        return {r._mapping["source_id"]: _observation(r) for r in rows}

    def list_for_source(self, source_id: UUID, *, limit: int) -> Sequence[SourceObservation]:
        o = db.source_observations
        rows = self._c.execute(
            select(o)
            .where(o.c.source_id == source_id)
            .order_by(o.c.observed_at.desc(), o.c.recorded_at.desc(), o.c.observation_id.desc())
            .limit(limit)
        ).all()
        return [_observation(r) for r in rows]


class SqlTerminalRepository:
    def __init__(self, connection: Connection) -> None:
        self._c = connection

    def list_terminals(self) -> Sequence[Terminal]:
        rows = self._c.execute(select(db.terminals).order_by(db.terminals.c.name)).all()
        return [_terminal(r) for r in rows]

    def get_terminal(self, terminal_id: UUID) -> Terminal | None:
        row = self._c.execute(
            select(db.terminals).where(db.terminals.c.terminal_id == terminal_id)
        ).first()
        return _terminal(row) if row else None

    def list_current_facts(self, terminal_id: UUID) -> Sequence[TerminalOperationalFact]:
        f = db.terminal_facts
        # `recorded_at` is caller-supplied, so ties are likely; the id makes the choice total.
        rank = (
            func.row_number()
            .over(
                partition_by=f.c.kind,
                order_by=(f.c.recorded_at.desc(), f.c.fact_id.desc()),
            )
            .label("rank")
        )
        ranked = (
            select(f, rank)
            .where(f.c.terminal_id == terminal_id, f.c.effective_to.is_(None))
            .subquery()
        )
        rows = self._c.execute(
            select(ranked).where(ranked.c.rank == 1).order_by(ranked.c.kind)
        ).all()
        return [_fact(r) for r in rows]

    def append_fact(self, fact: TerminalOperationalFact) -> None:
        self._c.execute(insert(db.terminal_facts).values(fact_row(fact)))


class SqlKillSwitchRepository:
    def __init__(self, connection: Connection) -> None:
        self._c = connection

    def list_engaged(self) -> Sequence[KillSwitch]:
        s = db.processing_switches
        rows = self._c.execute(
            select(s).where(s.c.released_at.is_(None)).order_by(s.c.engaged_at)
        ).all()
        return [_switch(r) for r in rows]

    def engage(self, switch: KillSwitch) -> None:
        self._c.execute(
            insert(s := db.processing_switches).values(
                switch_id=switch.switch_id,
                scope=switch.scope.value,
                key=switch.key,
                reason=switch.reason,
                engaged_at=switch.engaged_at,
                released_at=switch.released_at,
            )
        )
        del s
