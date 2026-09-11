"""Deterministic read use cases over in-memory repositories."""

from uuid import uuid4

from paxpivot.application.read_services import (
    get_terminal_detail,
    list_source_health,
    list_terminal_network,
)
from paxpivot.domain.source import SourceState
from support_sources import (
    NOW,
    SOURCE_A,
    SOURCE_B,
    SOURCE_C,
    TERMINAL_A,
    TERMINAL_B,
    TERMINAL_C,
    FakeObservations,
    FakeSources,
    FakeSwitches,
    FakeTerminals,
)


def test_terminal_network_reports_verified_entrance_and_newest_evidence_only() -> None:
    network = list_terminal_network(FakeTerminals(), FakeSources(), FakeObservations(), now=NOW)
    by_id = {t.terminal_id: t for t in network.terminals}
    assert len(by_id) == 4 and network.generated_at == NOW

    a = by_id[TERMINAL_A.terminal_id]
    assert a.entrance is not None and a.entrance_kind == "passenger_terminal"
    assert a.official_url == SOURCE_A.identity.url
    assert a.latest is not None and a.latest.state == SourceState.FRESH
    # The newest observation wins, and its unknown page time is preserved as None on the older one.
    assert a.latest.observation_id != FakeObservations().items[0].observation_id
    assert a.latest.source_time is not None and a.latest.parser_version == "synthetic-parser-v1"
    assert "not a confirmed flight" in a.latest.explanation

    b = by_id[TERMINAL_B.terminal_id]
    assert b.entrance is None and b.entrance_kind is None  # Base coordinates never leak.
    assert b.latest is not None and b.latest.state == SourceState.UNREACHABLE
    assert b.latest.retrieval == "failed" and b.latest.source_time is None

    c = by_id[TERMINAL_C.terminal_id]
    assert c.latest is None  # Never observed: no state is invented.
    assert c.operational_state == "unknown"


def test_terminal_detail_carries_facts_sources_and_instructions() -> None:
    result = get_terminal_detail(
        TERMINAL_A.terminal_id, FakeTerminals(), FakeSources(), FakeObservations(), now=NOW
    )
    assert result.ok
    detail = result.value
    assert detail.summary.name == TERMINAL_A.name
    assert (
        detail.entrance_instructions is not None
        and "passenger terminal" in detail.entrance_instructions
    )
    assert [f.kind.value for f in detail.facts] == ["counter_hours", "phone"]
    assert all(f.source_url == SOURCE_A.identity.url for f in detail.facts)
    assert [s.source_id for s in detail.sources] == [SOURCE_A.identity.source_id]
    assert detail.sources[0].latest is not None
    # A read model never carries the payload reference or a content hash.
    dumped = detail.model_dump()
    assert "payload_ref" not in str(dumped) and "content_hash" not in str(dumped)


def test_terminal_detail_without_entrance_and_unknown_terminal() -> None:
    result = get_terminal_detail(
        TERMINAL_B.terminal_id, FakeTerminals(), FakeSources(), FakeObservations(), now=NOW
    )
    assert result.ok and result.value.entrance_instructions is None
    assert result.value.facts == ()
    missing = get_terminal_detail(uuid4(), FakeTerminals(), FakeSources(), FakeObservations())
    assert not missing.ok and missing.error.message_key == "terminal.not_found"


def test_source_health_counts_only_observed_sources_and_flags_switches() -> None:
    health = list_source_health(FakeSources(), FakeObservations(), FakeSwitches(), now=NOW)
    rows = {r.source_id: r for r in health.rows}
    assert len(rows) == 5
    assert rows[SOURCE_A.identity.source_id].latest is not None
    assert rows[SOURCE_A.identity.source_id].kill_switched is False
    assert rows[SOURCE_B.identity.source_id].kill_switched is True
    assert rows[SOURCE_B.identity.source_id].latest is not None  # The switch hides nothing.
    assert rows[SOURCE_C.identity.source_id].latest is None
    assert rows[SOURCE_C.identity.source_id].review_state == "paused"
    assert {(c.state, c.count) for c in health.counts} == {
        (SourceState.FRESH, 1),
        (SourceState.UNREACHABLE, 1),
    }
    assert health.never_observed == 3
    # A failed retrieval is reported as its failure state, never as an absence state.
    latest_b = rows[SOURCE_B.identity.source_id].latest
    assert latest_b is not None and latest_b.state == SourceState.UNREACHABLE
