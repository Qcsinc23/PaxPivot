"""Development/integration reference data (ADR-004 "initial data strategy").

Everything here is public registry *metadata*: terminal names, their host installation and
IANA time zone, and one official directory page. There are no coordinates (nothing is
geocoded), no entrance (nothing is verified), no operating facts, and no observations — so no
seeded fact is ever presented as fresh. Every entry is ``needs_review`` and disabled until a
person confirms it against the official page. Seeding is idempotent: rows are keyed by stable
UUID5 identifiers and re-running is a no-op. This is not a scraper and must never become one.
"""

from datetime import UTC, datetime
from uuid import NAMESPACE_URL, uuid5

from pydantic import HttpUrl
from sqlalchemy import Engine
from sqlalchemy.dialects.postgresql import insert

from paxpivot.domain.source import (
    PolicyReviewState,
    Provenance,
    RawPayloadPolicy,
    Source,
    SourceIdentity,
    SourceKind,
    SourceProcessingPolicy,
)
from paxpivot.domain.terminal import Terminal
from paxpivot.infrastructure import database as db
from paxpivot.infrastructure.repositories import source_row, terminal_row

SEED_RECORDED_AT = datetime(2026, 9, 10, tzinfo=UTC)  # Registry entry time, not a source time.
SEED_PROVIDER_ID = "registry-seed"
SEED_POLICY_VERSION_ID = "seed-not-approved-v1"


UNREVIEWED_POLICY = SourceProcessingPolicy(
    policy_version_id=SEED_POLICY_VERSION_ID,
    review_state=PolicyReviewState.NEEDS_REVIEW,
    may_retrieve=False,  # Nothing is retrieved until a person enables it.
    may_parse=False,
    may_summarize=False,
    may_display=False,
    may_aggregate_history=False,
    raw_payload=RawPayloadPolicy.DENIED,
    snapshot_retention_days=None,
    reviewer=None,
    reviewed_at=None,
)

DIRECTORY_SOURCE = Source(
    identity=SourceIdentity(
        source_id=uuid5(NAMESPACE_URL, "paxpivot:source:amc-travel-site"),
        url=HttpUrl("https://www.amc.af.mil/AMC-Travel-Site/"),
        authority="Air Mobility Command",
    ),
    name="AMC Travel Site (terminal directory)",
    kind=SourceKind.DIRECTORY_PAGE,
    terminal_id=None,
    enabled=False,
    cadence_minutes=None,
    adapter_id=None,
    adapter_version=None,
    policy=UNREVIEWED_POLICY,
    created_at=SEED_RECORDED_AT,
    updated_at=SEED_RECORDED_AT,
)

REGISTRY_PROVENANCE = Provenance(
    source=DIRECTORY_SOURCE.identity,
    observed_at=SEED_RECORDED_AT,
    source_time=None,  # The directory page's own time was not read; unknown stays unknown.
    provider_id=SEED_PROVIDER_ID,
    policy_version_id=SEED_POLICY_VERSION_ID,
)

# Public AMC passenger terminals in the north-east United States, as listed by the AMC
# directory. Names and installations only; operational state stays "unknown" until an
# approved source observation establishes it.
REFERENCE_TERMINALS: tuple[Terminal, ...] = tuple(
    Terminal(
        terminal_id=uuid5(NAMESPACE_URL, f"paxpivot:terminal:{slug}"),
        name=name,
        installation=installation,
        timezone="America/New_York",
        operational_state="unknown",
        evidence=REGISTRY_PROVENANCE,
        entrance=None,
        base_coordinates=None,
    )
    for slug, name, installation in (
        (
            "jb-mcguire-dix-lakehurst",
            "Joint Base McGuire-Dix-Lakehurst Passenger Terminal",
            "Joint Base McGuire-Dix-Lakehurst, NJ",
        ),
        ("dover-afb", "Dover AFB Passenger Terminal", "Dover Air Force Base, DE"),
        (
            "bwi-amc",
            "BWI AMC Passenger Terminal",
            "Baltimore/Washington International Thurgood Marshall Airport, MD",
        ),
        ("jb-andrews", "Joint Base Andrews Passenger Terminal", "Joint Base Andrews, MD"),
    )
)


def seed_reference_data(engine: Engine) -> dict[str, int]:
    """Insert the reference rows that are missing; existing rows are never rewritten."""
    inserted = {"sources": 0, "terminals": 0}
    with engine.begin() as connection:
        # RETURNING yields one row per inserted row and none on conflict (rowcount is
        # unreliable for ON CONFLICT DO NOTHING under psycopg).
        inserted["sources"] += len(
            connection.execute(
                insert(db.sources)
                .values(source_row(DIRECTORY_SOURCE))
                .on_conflict_do_nothing(index_elements=[db.sources.c.source_id])
                .returning(db.sources.c.source_id)
            ).all()
        )
        for terminal in REFERENCE_TERMINALS:
            inserted["terminals"] += len(
                connection.execute(
                    insert(db.terminals)
                    .values(
                        terminal_row(
                            terminal, created_at=SEED_RECORDED_AT, updated_at=SEED_RECORDED_AT
                        )
                    )
                    .on_conflict_do_nothing(index_elements=[db.terminals.c.terminal_id])
                    .returning(db.terminals.c.terminal_id)
                ).all()
            )
    return inserted
