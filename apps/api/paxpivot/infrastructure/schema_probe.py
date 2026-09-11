"""CHECK-constraint parity probe (TASK-026, A3).

`alembic check` proves the *structure* of the deployed schema matches the metadata, but Alembic
does not compare CHECK constraints, and those are where the safety-critical rules live (a
positive state needs successful retrieval, a payload reference needs retrieval, reasons must be
present, URLs carry no credentials, ...). This probe exercises each rule against the deployed
database: every domain enum member must insert, an invented value must be refused by the named
constraint, and each invariant must refuse its counter-example. Everything runs inside
savepoints on a caller-owned transaction that the caller rolls back, so the probe writes nothing.

It is deliberately narrow: a fixed table of the rules migrations 0002/0003 introduced, not a
schema-diff framework. Domain enums are the only source of the value lists.
"""

import re
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any
from uuid import uuid4

from sqlalchemy import Connection, Table, insert
from sqlalchemy.exc import IntegrityError

from paxpivot.domain.source import (
    ExtractionState,
    KillSwitchScope,
    PolicyReviewState,
    RawPayloadPolicy,
    RetrievalState,
    SourceKind,
    SourceState,
)
from paxpivot.domain.terminal import TerminalFactKind
from paxpivot.infrastructure import database as db

NOW = datetime(2026, 1, 1, tzinfo=UTC)
Row = dict[str, Any]


class CheckParityError(AssertionError):
    """The deployed database does not enforce a rule the domain relies on."""


@dataclass
class ParityReport:
    constraints_verified: int = 0
    verified: list[str] = field(default_factory=list)


def _violated(exc: IntegrityError) -> str:
    # psycopg exposes the structured field, independent of message locale/wording.
    name = getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
    if name:
        return str(name)
    match = re.search(r'constraint "([^"]+)"', str(exc.orig))
    return match.group(1) if match else str(exc.orig)


def _attempt(connection: Connection, table: Table, row: Row) -> str | None:
    """Insert inside a savepoint; return the violated constraint name, or None on success."""
    savepoint = connection.begin_nested()
    try:
        connection.execute(insert(table).values(row))
    except IntegrityError as exc:
        savepoint.rollback()
        return _violated(exc)
    savepoint.rollback()  # never keep probe rows
    return None


# ── minimal valid rows ─────────────────────────────────────────────────


def source_row(**overrides: Any) -> Row:
    row: Row = {
        "source_id": uuid4(),
        "url": f"https://example.invalid/probe/{uuid4().hex}",
        "authority": "probe",
        "name": "probe",
        "kind": SourceKind.TERMINAL_PAGE.value,
        "terminal_id": None,
        "enabled": False,
        "cadence_minutes": None,
        "adapter_id": None,
        "adapter_version": None,
        "policy_version_id": "probe-v1",
        "review_state": PolicyReviewState.NEEDS_REVIEW.value,
        "may_retrieve": False,
        "may_parse": False,
        "may_summarize": False,
        "may_display": False,
        "may_aggregate_history": False,
        "raw_payload": RawPayloadPolicy.DENIED.value,
        "snapshot_retention_days": None,
        "reviewer": None,
        "reviewed_at": None,
        "created_at": NOW,
        "updated_at": NOW,
    }
    return {**row, **overrides}


def _provenance(source_id: Any, prefix: str = "") -> Row:
    return {
        f"{prefix}source_id": source_id,
        f"{prefix}source_url": "https://example.invalid/probe",
        f"{prefix}source_authority": "probe",
        f"{prefix}observed_at": NOW,
        f"{prefix}source_time": None,
        f"{prefix}provider_id": "probe",
        f"{prefix}policy_version_id": "probe-v1",
    }


def terminal_row(source_id: Any, **overrides: Any) -> Row:
    row: Row = {
        "terminal_id": uuid4(),
        "name": "probe",
        "installation": None,
        "timezone": "UTC",
        "operational_state": "unknown",
        "base_latitude": None,
        "base_longitude": None,
        "entrance_kind": None,
        "entrance_latitude": None,
        "entrance_longitude": None,
        "entrance_instructions": None,
        **{k: None for k in _provenance(None, "entrance_")},
        **_provenance(source_id, "evidence_"),
        "created_at": NOW,
        "updated_at": NOW,
    }
    return {**row, **overrides}


def observation_row(source_id: Any, **overrides: Any) -> Row:
    row: Row = {
        "observation_id": uuid4(),
        **_provenance(source_id),
        "state": SourceState.UNREACHABLE.value,
        "retrieval": RetrievalState.FAILED.value,
        "extraction": ExtractionState.NOT_ATTEMPTED.value,
        "parser_version": None,
        "content_hash": None,
        "confidence_reasons": ["probe"],
        "payload_ref": None,
        "supersedes_observation_id": None,
    }
    return {**row, **overrides}


def fact_row(terminal_id: Any, source_id: Any, **overrides: Any) -> Row:
    row: Row = {
        "fact_id": uuid4(),
        "terminal_id": terminal_id,
        "kind": TerminalFactKind.PARKING.value,
        "value": "probe",
        **_provenance(source_id),
        "effective_from": None,
        "effective_to": None,
        "recorded_at": NOW,
    }
    return {**row, **overrides}


def switch_row(**overrides: Any) -> Row:
    row: Row = {
        "switch_id": uuid4(),
        "scope": KillSwitchScope.MODE.value,
        "key": "parse",
        "reason": "probe",
        "engaged_at": NOW,
        "released_at": None,
    }
    return {**row, **overrides}


# ── the rules ──────────────────────────────────────────────────────────

ENTRANCE = {
    "entrance_kind": "passenger_terminal",
    "entrance_latitude": 0.0,
    "entrance_longitude": 0.0,
    "entrance_instructions": "probe",
}


@dataclass(frozen=True)
class Rule:
    constraint: str  # full constraint name in the deployed database
    table: Table
    valid: Callable[[], Iterable[Row]]  # each must insert
    invalid: Callable[[], Iterable[Row]]  # each must be refused by `constraint`


def _enum_rule(
    constraint: str,
    table: Table,
    column: str,
    enum: type[StrEnum],
    base: Callable[..., Row],
    **fixed: Any,
) -> Rule:
    return Rule(
        constraint,
        table,
        lambda: [base(**{column: member.value, **fixed}) for member in enum],
        lambda: [base(**{column: "__invented__", **fixed})],
    )


def rules(source_id: Any, terminal_id: Any) -> tuple[Rule, ...]:
    def obs(**o: Any) -> Row:
        return observation_row(source_id, **o)

    def term(**o: Any) -> Row:
        return terminal_row(source_id, **o)

    def fact(**o: Any) -> Row:
        return fact_row(terminal_id, source_id, **o)

    fresh = {"state": "fresh", "retrieval": "succeeded"}
    return (
        # Enumerations: the domain enum is the only list; the database must accept exactly it.
        _enum_rule(
            "ck_source_observations_state",
            db.source_observations,
            "state",
            SourceState,
            obs,
            retrieval="succeeded",
            extraction="exact_text",
            parser_version="probe",
        ),
        _enum_rule(
            "ck_source_observations_retrieval",
            db.source_observations,
            "retrieval",
            RetrievalState,
            obs,
        ),
        _enum_rule(
            "ck_source_observations_extraction",
            db.source_observations,
            "extraction",
            ExtractionState,
            obs,
            retrieval="succeeded",
            parser_version="probe",
        ),
        _enum_rule(
            "ck_sources_review_state",
            db.sources,
            "review_state",
            PolicyReviewState,
            source_row,
            reviewer="r",
            reviewed_at=NOW,
        ),
        Rule(
            "ck_sources_raw_payload",
            db.sources,
            lambda: [
                source_row(
                    raw_payload=m.value,
                    snapshot_retention_days=30 if m == RawPayloadPolicy.SNAPSHOT else None,
                )
                for m in RawPayloadPolicy
            ],
            lambda: [source_row(raw_payload="__invented__")],
        ),
        _enum_rule("ck_sources_kind", db.sources, "kind", SourceKind, source_row),
        _enum_rule(
            "ck_processing_switches_scope",
            db.processing_switches,
            "scope",
            KillSwitchScope,
            switch_row,
        ),
        _enum_rule("ck_terminal_facts_kind", db.terminal_facts, "kind", TerminalFactKind, fact),
        Rule(
            "ck_terminals_operational_state",
            db.terminals,
            lambda: [term(operational_state=s) for s in db.OPERATIONAL_STATES],
            lambda: [term(operational_state="__invented__")],
        ),
        # Invariants.
        Rule(
            "ck_sources_url_carries_no_credentials",
            db.sources,
            lambda: [source_row()],
            lambda: [
                source_row(url="https://example.invalid/p?token=x"),
                source_row(url="https://example.invalid/p#frag"),
            ],
        ),
        Rule(
            "ck_source_observations_positive_requires_retrieval",
            db.source_observations,
            lambda: [obs(**fresh)],
            lambda: [
                obs(state=s, retrieval="failed")
                for s in ("fresh", "no_departures_published", "no_compatible_opportunity")
            ],
        ),
        Rule(
            "ck_source_observations_payload_retrieved",
            db.source_observations,
            lambda: [obs(**fresh, payload_ref="blob://probe")],
            lambda: [obs(retrieval="failed", payload_ref="blob://probe")],
        ),
        Rule(
            "ck_source_observations_reasons_present",
            db.source_observations,
            lambda: [obs()],
            lambda: [obs(confidence_reasons=[])],
        ),
        Rule(
            "ck_source_observations_supersedes_not_self",
            db.source_observations,
            lambda: [obs()],
            lambda: [_self_superseding(obs())],
        ),
        Rule(
            "ck_sources_approval_reviewed",
            db.sources,
            lambda: [source_row(review_state="approved", reviewer="r", reviewed_at=NOW)],
            lambda: [
                source_row(review_state="approved"),
                source_row(review_state="approved", reviewer="r"),
            ],
        ),
        Rule(
            "ck_sources_snapshot_retention",
            db.sources,
            lambda: [source_row(raw_payload="snapshot", snapshot_retention_days=30)],
            lambda: [
                source_row(raw_payload="snapshot"),
                source_row(raw_payload="hash_only", snapshot_retention_days=30),
            ],
        ),
        Rule(
            "ck_terminals_entrance_all_or_nothing",
            db.terminals,
            lambda: [term(**ENTRANCE, **_provenance(source_id, "entrance_"))],
            lambda: [
                term(entrance_kind="passenger_terminal"),
                term(entrance_latitude=0.0, entrance_longitude=0.0),
            ],
        ),
        Rule(
            "ck_terminals_base_coordinates_pair",
            db.terminals,
            lambda: [term(base_latitude=0.0, base_longitude=0.0)],
            lambda: [term(base_latitude=0.0), term(base_longitude=0.0)],
        ),
        Rule(
            "ck_terminal_facts_validity_window",
            db.terminal_facts,
            lambda: [fact(effective_from=NOW, effective_to=datetime(2026, 1, 2, tzinfo=UTC))],
            lambda: [fact(effective_from=NOW, effective_to=NOW)],
        ),
    )


def _self_superseding(row: Row) -> Row:
    return {**row, "supersedes_observation_id": row["observation_id"]}


def verify_check_parity(connection: Connection) -> ParityReport:
    """Exercise every rule against the deployed database. The caller rolls the transaction back."""
    probe_source = source_row()
    probe_terminal = terminal_row(probe_source["source_id"])
    connection.execute(insert(db.sources).values(probe_source))
    connection.execute(insert(db.terminals).values(probe_terminal))
    report = ParityReport()
    for rule in rules(probe_source["source_id"], probe_terminal["terminal_id"]):
        for row in rule.valid():
            violated = _attempt(connection, rule.table, row)
            if violated is not None:
                raise CheckParityError(f"{rule.constraint}: a valid row was refused by {violated}")
        for row in rule.invalid():
            violated = _attempt(connection, rule.table, row)
            if violated != rule.constraint:
                raise CheckParityError(
                    f"{rule.constraint}: expected refusal, got "
                    f"{'success' if violated is None else violated}"
                )
        report.constraints_verified += 1
        report.verified.append(rule.constraint)
    return report
