"""TASK-023: the reference registry is metadata-only, official, and never a scraper."""

import ast
from pathlib import Path

from paxpivot.domain.source import PolicyReviewState, ProcessingMode, RawPayloadPolicy, SourceKind
from paxpivot.infrastructure.bootstrap import (
    DIRECTORY_SOURCE,
    REFERENCE_SOURCES,
    REFERENCE_TERMINALS,
    SCHEDULE_ARTIFACT_SOURCES,
    TERMINAL_PAGE_SOURCES,
)


def test_every_reference_source_is_an_official_https_page_without_credentials() -> None:
    assert len(REFERENCE_SOURCES) == 9
    ids = {s.identity.source_id for s in REFERENCE_SOURCES}
    assert len(ids) == 9
    for source in REFERENCE_SOURCES:
        url = source.identity.url
        assert url.scheme == "https" and url.host and url.host.endswith(".mil")
        assert not url.query and not url.fragment
        assert source.policy.raw_payload in {RawPayloadPolicy.DENIED, RawPayloadPolicy.HASH_ONLY}
        assert source.policy.snapshot_retention_days is None
        assert not source.policy.may_summarize  # parsing: see the terminal-page test
        assert not source.policy.may_aggregate_history


def test_terminal_pages_are_approved_to_parse_and_linked_to_their_terminal() -> None:
    terminal_ids = {t.terminal_id for t in REFERENCE_TERMINALS}
    assert {s.terminal_id for s in TERMINAL_PAGE_SOURCES} == terminal_ids
    for source in TERMINAL_PAGE_SOURCES:
        assert source.kind == SourceKind.TERMINAL_PAGE
        assert source.enabled and source.cadence_minutes == 360
        assert source.adapter_id == "firecrawl"
        policy = source.policy
        assert policy.review_state == PolicyReviewState.APPROVED
        assert policy.reviewer and policy.reviewed_at is not None
        assert policy.allows(ProcessingMode.RETRIEVE)
        assert policy.allows(ProcessingMode.DISPLAY)
        # TASK-031: parsing approved behind the SRC-009 gate; raw bodies still never stored.
        assert policy.allows(ProcessingMode.PARSE)
        assert not policy.allows(ProcessingMode.STORE_RAW)
        assert "amc.af.mil/AMC-Travel-Site/Terminals/" in str(source.identity.url)
    # The directory page itself stays unreviewed and disabled.
    assert DIRECTORY_SOURCE.policy.review_state == PolicyReviewState.NEEDS_REVIEW
    assert not DIRECTORY_SOURCE.enabled


def test_bootstrap_seeds_no_observation_coordinate_or_entrance() -> None:
    source = Path(__file__).resolve().parents[2] / "apps/api/paxpivot/infrastructure/bootstrap.py"
    tree = ast.parse(source.read_text())
    names = {node.id for node in ast.walk(tree) if isinstance(node, ast.Name)}
    for forbidden in (
        "SourceObservation",
        "Coordinates",
        "VerifiedEntrance",
        "TerminalOperationalFact",
    ):
        assert forbidden not in names, forbidden
    for terminal in REFERENCE_TERMINALS:
        assert terminal.entrance is None and terminal.base_coordinates is None
        assert terminal.operational_state == "unknown"


def test_schedule_artifacts_are_registered_but_user_opened_only() -> None:
    """TASK-037 option 1: marked artifacts are never retrieved; the register keeps the pointer."""
    terminal_ids = {t.terminal_id for t in REFERENCE_TERMINALS}
    assert {s.terminal_id for s in SCHEDULE_ARTIFACT_SOURCES} == terminal_ids
    for source in SCHEDULE_ARTIFACT_SOURCES:
        assert source.kind == SourceKind.SCHEDULE_ARTIFACT
        assert str(source.identity.url).endswith("/")
        policy = source.policy
        assert policy.review_state == PolicyReviewState.RESTRICTED and policy.reviewer
        for mode in ProcessingMode:
            assert not policy.allows(mode)
