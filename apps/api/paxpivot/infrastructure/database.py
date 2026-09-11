"""SQLAlchemy Core schema for the Sources + Terminals slice (ADR-004).

Tables mirror the domain contracts one-to-one and are never handed to the application
layer: ``infrastructure/repositories.py`` maps rows to ``paxpivot.domain`` records.
Observations and terminal facts are append-only (a database trigger in migration 0002
rejects UPDATE/DELETE). Provenance is stored inline as observed (source URL/authority at
that time) alongside the source foreign key.
"""

import os
from collections.abc import Iterator
from contextlib import contextmanager
from enum import StrEnum
from functools import cache

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Connection,
    DateTime,
    Double,
    Engine,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    Table,
    Text,
    Uuid,
    create_engine,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY

from paxpivot.domain.source import ExtractionState as ExtractionStateEnum
from paxpivot.domain.source import (
    KillSwitchScope,
    PolicyReviewState,
    RawPayloadPolicy,
    RetrievalState,
    SourceKind,
    SourceState,
)
from paxpivot.domain.terminal import TerminalFactKind

metadata = MetaData(
    naming_convention={
        "ix": "ix_%(column_0_label)s",
        "uq": "uq_%(table_name)s_%(column_0_name)s",
        "ck": "ck_%(table_name)s_%(constraint_name)s",
        "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        "pk": "pk_%(table_name)s",
    }
)


def _in(column: str, values: type[StrEnum] | list[str]) -> str:
    items = [v.value for v in values] if isinstance(values, type) else values
    return f"{column} IN ({', '.join(repr(v) for v in items)})"


ENTRANCE_KINDS = ["passenger_terminal", "visitor_center", "documented_gate"]
OPERATIONAL_STATES = ["verified", "unknown", "conflict", "ended"]


def _tz() -> DateTime:
    return DateTime(timezone=True)


terminals = Table(
    "terminals",
    metadata,
    Column("terminal_id", Uuid, primary_key=True),
    Column("name", Text, nullable=False),
    Column("installation", Text, nullable=True),
    Column("timezone", Text, nullable=False),
    Column("operational_state", Text, nullable=False),
    # Identity context only; never an entrance (domain/terminal.py).
    Column("base_latitude", Double, nullable=True),
    Column("base_longitude", Double, nullable=True),
    # Verified passenger entrance: all columns set, or none.
    Column("entrance_kind", Text, nullable=True),
    Column("entrance_latitude", Double, nullable=True),
    Column("entrance_longitude", Double, nullable=True),
    Column("entrance_instructions", Text, nullable=True),
    Column(
        "entrance_source_id",
        Uuid,
        ForeignKey("sources.source_id", use_alter=True),
        nullable=True,
    ),
    Column("entrance_source_url", Text, nullable=True),
    Column("entrance_source_authority", Text, nullable=True),
    Column("entrance_observed_at", _tz(), nullable=True),
    Column("entrance_source_time", _tz(), nullable=True),
    Column("entrance_provider_id", Text, nullable=True),
    Column("entrance_policy_version_id", Text, nullable=True),
    # Provenance of the registry entry itself.
    Column(
        "evidence_source_id",
        Uuid,
        ForeignKey("sources.source_id", use_alter=True),
        nullable=False,
    ),
    Column("evidence_source_url", Text, nullable=False),
    Column("evidence_source_authority", Text, nullable=False),
    Column("evidence_observed_at", _tz(), nullable=False),
    Column("evidence_source_time", _tz(), nullable=True),
    Column("evidence_provider_id", Text, nullable=False),
    Column("evidence_policy_version_id", Text, nullable=False),
    Column("created_at", _tz(), nullable=False),
    Column("updated_at", _tz(), nullable=False),
    CheckConstraint(_in("operational_state", OPERATIONAL_STATES), name="operational_state"),
    CheckConstraint(
        "(base_latitude IS NULL) = (base_longitude IS NULL)", name="base_coordinates_pair"
    ),
    CheckConstraint(
        "entrance_kind IS NULL OR " + _in("entrance_kind", ENTRANCE_KINDS), name="entrance_kind"
    ),
    CheckConstraint(
        "(entrance_kind IS NULL) = (entrance_latitude IS NULL) AND "
        "(entrance_kind IS NULL) = (entrance_longitude IS NULL) AND "
        "(entrance_kind IS NULL) = (entrance_instructions IS NULL) AND "
        "(entrance_kind IS NULL) = (entrance_source_id IS NULL) AND "
        "(entrance_kind IS NULL) = (entrance_source_url IS NULL) AND "
        "(entrance_kind IS NULL) = (entrance_source_authority IS NULL) AND "
        "(entrance_kind IS NULL) = (entrance_observed_at IS NULL) AND "
        "(entrance_kind IS NULL) = (entrance_provider_id IS NULL) AND "
        "(entrance_kind IS NULL) = (entrance_policy_version_id IS NULL)",
        name="entrance_all_or_nothing",
    ),
    # A registered source URL is a page, never a credentialed URL (tokens live in query
    # strings and fragments, and these values are served to clients).
    CheckConstraint(
        "evidence_source_url NOT LIKE '%?%' AND evidence_source_url NOT LIKE '%#%' AND "
        "(entrance_source_url IS NULL OR (entrance_source_url NOT LIKE '%?%' AND "
        "entrance_source_url NOT LIKE '%#%'))",
        name="url_carries_no_credentials",
    ),
)

sources = Table(
    "sources",
    metadata,
    Column("source_id", Uuid, primary_key=True),
    Column("url", Text, nullable=False, unique=True),
    Column("authority", Text, nullable=False),
    Column("name", Text, nullable=False),
    Column("kind", Text, nullable=False),
    Column("terminal_id", Uuid, ForeignKey("terminals.terminal_id"), nullable=True),
    Column("enabled", Boolean, nullable=False),
    Column("cadence_minutes", Integer, nullable=True),
    Column("adapter_id", Text, nullable=True),
    Column("adapter_version", Text, nullable=True),
    # Source-processing policy (pilot SRC-002). No secrets, ever.
    Column("policy_version_id", Text, nullable=False),
    Column("review_state", Text, nullable=False),
    Column("may_retrieve", Boolean, nullable=False),
    Column("may_parse", Boolean, nullable=False),
    Column("may_summarize", Boolean, nullable=False),
    Column("may_display", Boolean, nullable=False),
    Column("may_aggregate_history", Boolean, nullable=False),
    Column("raw_payload", Text, nullable=False),
    Column("snapshot_retention_days", Integer, nullable=True),
    Column("reviewer", Text, nullable=True),
    Column("reviewed_at", _tz(), nullable=True),
    Column("created_at", _tz(), nullable=False),
    Column("updated_at", _tz(), nullable=False),
    CheckConstraint(_in("kind", SourceKind), name="kind"),
    CheckConstraint(_in("review_state", PolicyReviewState), name="review_state"),
    CheckConstraint(_in("raw_payload", RawPayloadPolicy), name="raw_payload"),
    CheckConstraint("cadence_minutes IS NULL OR cadence_minutes > 0", name="cadence_positive"),
    CheckConstraint(
        "(raw_payload = 'snapshot') = (snapshot_retention_days IS NOT NULL)",
        name="snapshot_retention",
    ),
    CheckConstraint(
        "review_state <> 'approved' OR (reviewer IS NOT NULL AND reviewed_at IS NOT NULL)",
        name="approval_reviewed",
    ),
    CheckConstraint("url NOT LIKE '%?%' AND url NOT LIKE '%#%'", name="url_carries_no_credentials"),
)

source_observations = Table(
    "source_observations",
    metadata,
    Column("observation_id", Uuid, primary_key=True),
    Column("source_id", Uuid, ForeignKey("sources.source_id"), nullable=False),
    Column("source_url", Text, nullable=False),  # As observed; the registry URL may change later.
    Column("source_authority", Text, nullable=False),
    Column("observed_at", _tz(), nullable=False),
    Column("source_time", _tz(), nullable=True),  # Unknown stays NULL; never backfilled.
    Column("provider_id", Text, nullable=False),
    Column("policy_version_id", Text, nullable=False),
    Column("state", Text, nullable=False),
    Column("retrieval", Text, nullable=False),
    Column("extraction", Text, nullable=False),
    Column("parser_version", Text, nullable=True),
    Column("content_hash", Text, nullable=True),
    Column("confidence_reasons", ARRAY(Text), nullable=False),
    Column("payload_ref", Text, nullable=True),  # Reference only; bodies never live here.
    Column(
        "supersedes_observation_id",
        Uuid,
        ForeignKey("source_observations.observation_id"),
        nullable=True,
    ),
    Column("recorded_at", _tz(), nullable=False, server_default=text("now()")),
    CheckConstraint(_in("state", SourceState), name="state"),
    CheckConstraint(_in("retrieval", RetrievalState), name="retrieval"),
    CheckConstraint(_in("extraction", ExtractionStateEnum), name="extraction"),
    CheckConstraint(
        "state NOT IN ('fresh', 'no_departures_published', 'no_compatible_opportunity') "
        "OR retrieval = 'succeeded'",
        name="positive_requires_retrieval",
    ),
    CheckConstraint("payload_ref IS NULL OR retrieval = 'succeeded'", name="payload_retrieved"),
    CheckConstraint("cardinality(confidence_reasons) > 0", name="reasons_present"),
    CheckConstraint(
        "source_url NOT LIKE '%?%' AND source_url NOT LIKE '%#%'",
        name="url_carries_no_credentials",
    ),
    Index("ix_source_observations_source_id_observed_at", "source_id", "observed_at"),
)

terminal_facts = Table(
    "terminal_facts",
    metadata,
    Column("fact_id", Uuid, primary_key=True),
    Column("terminal_id", Uuid, ForeignKey("terminals.terminal_id"), nullable=False),
    Column("kind", Text, nullable=False),
    Column("value", Text, nullable=False),
    Column("source_id", Uuid, ForeignKey("sources.source_id"), nullable=False),
    Column("source_url", Text, nullable=False),
    Column("source_authority", Text, nullable=False),
    Column("observed_at", _tz(), nullable=False),
    Column("source_time", _tz(), nullable=True),
    Column("provider_id", Text, nullable=False),
    Column("policy_version_id", Text, nullable=False),
    Column("effective_from", _tz(), nullable=True),
    Column("effective_to", _tz(), nullable=True),
    Column("recorded_at", _tz(), nullable=False),
    CheckConstraint(_in("kind", TerminalFactKind), name="kind"),
    CheckConstraint(
        "effective_from IS NULL OR effective_to IS NULL OR effective_to > effective_from",
        name="validity_window",
    ),
    CheckConstraint(
        "source_url NOT LIKE '%?%' AND source_url NOT LIKE '%#%'",
        name="url_carries_no_credentials",
    ),
    Index("ix_terminal_facts_terminal_id_kind_recorded_at", "terminal_id", "kind", "recorded_at"),
)

processing_switches = Table(
    "processing_switches",
    metadata,
    Column("switch_id", Uuid, primary_key=True),
    Column("scope", Text, nullable=False),
    Column("key", Text, nullable=False),
    Column("reason", Text, nullable=False),
    Column("engaged_at", _tz(), nullable=False),
    Column("released_at", _tz(), nullable=True),
    CheckConstraint(_in("scope", KillSwitchScope), name="scope"),
    CheckConstraint("released_at IS NULL OR released_at >= engaged_at", name="release_after"),
)

# Tables whose rows may never be updated or deleted (enforced by trigger in migration 0002).
APPEND_ONLY_TABLES = ("source_observations", "terminal_facts")


@contextmanager
def transaction(
    engine: Engine, *, isolation_level: str = "REPEATABLE READ"
) -> Iterator[Connection]:
    """The explicit write boundary for a unit of work: commit on success, roll back on failure.

    A ``Connection`` on its own never commits, so a caller that appends and returns leaves the
    row invisible to every other session — and, if it raises, leaves an open transaction behind.
    Writes therefore go through here. Either every statement in the block is persisted or none
    is; a partial observation cannot survive a failure partway through.

    REPEATABLE READ is the deliberate default. The read use cases issue more than one statement
    per request (terminals, then their sources, then the newest observations), and under READ
    COMMITTED a concurrent write landing between them is visible to the later statement but not
    the earlier one — a source can read as "never observed" while it has an observation. One
    snapshot per unit of work removes that interleaving, for reads and writes alike.
    """
    with engine.connect() as connection:
        connection = connection.execution_options(isolation_level=isolation_level)
        try:
            with connection.begin():
                yield connection
        except Exception:
            # ``begin()`` has already rolled back; reset explicitly so a caller that catches and
            # continues cannot observe state left behind by the failed unit of work.
            connection.rollback()
            raise


@contextmanager
def repositories(engine: Engine) -> Iterator[Connection]:
    """A read unit of work: one snapshot, no commit (nothing may have been written)."""
    with transaction(engine) as connection:
        yield connection


@cache
def engine_from_env() -> Engine:
    """Process-wide engine for the composition root; DATABASE_URL comes from the environment."""
    return create_engine(os.environ["DATABASE_URL"], pool_pre_ping=True)
