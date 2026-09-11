"""Development/integration reference data (ADR-004 "initial data strategy"; TASK-023).

Everything here is public registry *metadata*: terminal names, their host installation and
IANA time zone, one official directory page, and one official terminal page per terminal
(URLs confirmed against that directory). There are no coordinates (nothing is geocoded), no
entrance (nothing is verified), no operating facts, and no observations, so no seeded fact
is ever presented as fresh. The directory page stays ``needs_review``/disabled; the terminal
pages carry the product owner's metadata-only approval (retrieve, hash, display; never
parse). Seeding is idempotent: rows are keyed by stable UUID5 identifiers and re-running is
a no-op. This is not a scraper and must never become one.
"""

from datetime import UTC, datetime
from uuid import NAMESPACE_URL, uuid5

from pydantic import HttpUrl
from sqlalchemy import Engine, update
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

# Approved for metadata-only retrieval by the product owner (decision delegated to the
# foundation agent, 2026-09-11, TASK-023): official AMC terminal pages, confirmed against the
# AMC Travel Site directory. Parsing stays forbidden (SRC-009 accuracy gate); only page
# reachability, content hash and page time may be recorded and displayed. hash_only: no body
# is ever stored.
# v2 (TASK-031): parsing approved by the product owner's delegated decision. Parsed rows still
# stay `parser_review_required` until the labeled corpus passes the SRC-009 accuracy gate.
APPROVED_TERMINAL_PAGE_POLICY = SourceProcessingPolicy(
    policy_version_id="terminal-page-parse-v2",
    review_state=PolicyReviewState.APPROVED,
    may_retrieve=True,
    may_parse=True,
    may_summarize=False,
    may_display=True,
    may_aggregate_history=False,
    raw_payload=RawPayloadPolicy.HASH_ONLY,
    snapshot_retention_days=None,
    reviewer="product-owner-delegated-2026-09-11",
    reviewed_at=datetime(2026, 9, 11, 16, 0, tzinfo=UTC),
)

# TASK-037: the AMC terminal pages carry no departure rows; the 72-hour schedules are linked
# PDF/slide artifacts under each terminal's official document folder. Approved by the product
# owner (2026-09-11) for retrieval and parsing under the same public-official rules. Display
# stays off until the parser passes the SRC-009 gate (TASK-032). hash_only: no body stored.
APPROVED_SCHEDULE_ARTIFACT_POLICY = SourceProcessingPolicy(
    policy_version_id="schedule-artifact-parse-v1",
    review_state=PolicyReviewState.APPROVED,
    may_retrieve=True,
    may_parse=True,
    may_summarize=False,
    may_display=False,
    may_aggregate_history=False,
    raw_payload=RawPayloadPolicy.HASH_ONLY,
    snapshot_retention_days=None,
    reviewer="product-owner-2026-09-11",
    reviewed_at=datetime(2026, 9, 11, 19, 0, tzinfo=UTC),
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


# Official terminal pages, one per seeded terminal (URLs from the AMC Travel Site directory).
TERMINAL_PAGE_SOURCES: tuple[Source, ...] = tuple(
    Source(
        identity=SourceIdentity(
            source_id=uuid5(NAMESPACE_URL, f"paxpivot:source:{slug}-terminal-page"),
            url=HttpUrl(url),
            authority="Air Mobility Command",
        ),
        name=name,
        kind=SourceKind.TERMINAL_PAGE,
        terminal_id=uuid5(NAMESPACE_URL, f"paxpivot:terminal:{slug}"),
        enabled=True,
        cadence_minutes=360,  # SRC-001 baseline cadence; budget: four pages, four credits per run.
        adapter_id="firecrawl",
        adapter_version="v1",
        policy=APPROVED_TERMINAL_PAGE_POLICY,
        created_at=SEED_RECORDED_AT,
        updated_at=SEED_RECORDED_AT,
    )
    for slug, name, url in (
        (
            "jb-mcguire-dix-lakehurst",
            "Joint Base MDL Passenger Terminal (AMC page)",
            "https://www.amc.af.mil/AMC-Travel-Site/Terminals/CONUS-Terminals/Joint-Base-MDL-Passenger-Terminal/",
        ),
        (
            "dover-afb",
            "Dover AFB Passenger Terminal (AMC page)",
            "https://www.amc.af.mil/AMC-Travel-Site/Terminals/CONUS-Terminals/Dover-AFB-Passenger-Terminal/",
        ),
        (
            "bwi-amc",
            "BWI Airport Passenger Terminal (AMC page)",
            "https://www.amc.af.mil/AMC-Travel-Site/Terminals/CONUS-Terminals/Baltimore-Washington-International-Airport-Passenger-Terminal/",
        ),
        (
            "jb-andrews",
            "Joint Base Andrews Passenger Terminal (AMC page)",
            "https://www.amc.af.mil/AMC-Travel-Site/Terminals/CONUS-Terminals/Joint-Base-Andrews-Passenger-Terminal/",
        ),
    )
)

# The registered URL is the terminal's official document folder; the current 72-hour artifact
# (a dated filename) is discovered on the terminal page at observation time by the provider.
SCHEDULE_ARTIFACT_SOURCES: tuple[Source, ...] = tuple(
    Source(
        identity=SourceIdentity(
            source_id=uuid5(NAMESPACE_URL, f"paxpivot:source:{slug}-72hr-schedule"),
            url=HttpUrl(folder),
            authority="Air Mobility Command",
        ),
        name=name,
        kind=SourceKind.SCHEDULE_ARTIFACT,
        terminal_id=uuid5(NAMESPACE_URL, f"paxpivot:terminal:{slug}"),
        enabled=True,
        cadence_minutes=360,
        adapter_id="firecrawl",
        adapter_version="v1",
        policy=APPROVED_SCHEDULE_ARTIFACT_POLICY,
        created_at=SEED_RECORDED_AT,
        updated_at=SEED_RECORDED_AT,
    )
    for slug, name, folder in (
        (
            "jb-mcguire-dix-lakehurst",
            "Joint Base MDL 72-hour schedule (AMC artifact)",
            "https://amc.usaf.afpims.mil/Portals/12/AMC%20Tvl%20Pg/Passenger%20Terminals/AMC%20CONUS%20Terminals/Joint%20Base%20McGuire-Dix-Lakehurst%20Passenger%20Terminal/",
        ),
        (
            "dover-afb",
            "Dover AFB 72-hour schedule (AMC artifact)",
            "https://www.amc.af.mil/Portals/12/AMC%20Tvl%20Pg/Passenger%20Terminals/AMC%20CONUS%20Terminals/Dover%20AFB%20Pax%20Terminal/",
        ),
        (
            "bwi-amc",
            "BWI 72-hour schedule (AMC artifact)",
            "https://www.amc.af.mil/Portals/12/AMC%20Tvl%20Pg/Passenger%20Terminals/AMC%20CONUS%20Terminals/BWI%20Passenger%20Terminal/",
        ),
        (
            "jb-andrews",
            "Joint Base Andrews 72-hour schedule (AMC artifact)",
            "https://www.amc.af.mil/Portals/12/AMC%20Tvl%20Pg/Passenger%20Terminals/AMC%20CONUS%20Terminals/Joint%20Base%20Andrews%20Passenger%20Terminal/",
        ),
    )
)

REFERENCE_SOURCES: tuple[Source, ...] = (
    DIRECTORY_SOURCE,
    *TERMINAL_PAGE_SOURCES,
    *SCHEDULE_ARTIFACT_SOURCES,
)

# Policy versions this seed is allowed to replace. Any other version on a reference row was set
# by a person (an incident pause, a restriction) and is left alone.
UPGRADABLE_POLICY_VERSIONS = frozenset({"terminal-page-metadata-v1"})

POLICY_COLUMNS = frozenset(
    {
        "policy_version_id",
        "review_state",
        "may_retrieve",
        "may_parse",
        "may_summarize",
        "may_display",
        "may_aggregate_history",
        "raw_payload",
        "snapshot_retention_days",
        "reviewer",
        "reviewed_at",
        "updated_at",
    }
)


def seed_reference_data(engine: Engine) -> dict[str, int]:
    """Insert missing reference rows; upgrade only known prior policy versions of reference rows."""
    inserted = {"sources": 0, "terminals": 0, "policies_upgraded": 0}
    with engine.begin() as connection:
        # RETURNING yields one row per inserted row and none on conflict (rowcount is
        # unreliable for ON CONFLICT DO NOTHING under psycopg). Order: the directory source
        # (terminal provenance points at it), the terminals, then the per-terminal pages.
        def insert_source(source: Source) -> None:
            inserted["sources"] += len(
                connection.execute(
                    insert(db.sources)
                    .values(source_row(source))
                    .on_conflict_do_nothing(index_elements=[db.sources.c.source_id])
                    .returning(db.sources.c.source_id)
                ).all()
            )

        insert_source(DIRECTORY_SOURCE)
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
        for source in (*TERMINAL_PAGE_SOURCES, *SCHEDULE_ARTIFACT_SOURCES):
            insert_source(source)
        # Registry rows are mutable (observations are not): bring a known older policy version
        # of a reference source up to the current one so new observations carry it. Rows on an
        # unrecognised version, or paused/restricted by a person, are never touched; URLs and
        # names are never rewritten. Each upgrade is printed so the register change is visible.
        for source in REFERENCE_SOURCES:
            upgraded = connection.execute(
                update(db.sources)
                .where(
                    db.sources.c.source_id == source.identity.source_id,
                    db.sources.c.policy_version_id != source.policy.policy_version_id,
                    db.sources.c.policy_version_id.in_(UPGRADABLE_POLICY_VERSIONS),
                    db.sources.c.review_state.notin_(
                        [PolicyReviewState.PAUSED.value, PolicyReviewState.RESTRICTED.value]
                    ),
                )
                .values(**{k: v for k, v in source_row(source).items() if k in POLICY_COLUMNS})
                .returning(db.sources.c.source_id)
            ).all()
            for (source_id,) in upgraded:
                print(f"Policy upgraded: {source_id} -> {source.policy.policy_version_id}")
            inserted["policies_upgraded"] += len(upgraded)
    return inserted
