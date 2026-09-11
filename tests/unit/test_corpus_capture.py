"""TASK-031: corpus capture writes reviewed fixtures, records nothing, respects the gate."""

import asyncio
import socket
from pathlib import Path

import httpx
import pytest
from paxpivot.application.corpus import capture_corpus
from paxpivot.domain.source import (
    KillSwitch,
    KillSwitchScope,
    PolicyReviewState,
    ProcessingMode,
    RawPayloadPolicy,
    Source,
    SourceProcessingPolicy,
)
from paxpivot.infrastructure.bootstrap import APPROVED_TERMINAL_PAGE_POLICY, TERMINAL_PAGE_SOURCES
from paxpivot.infrastructure.providers.firecrawl import FirecrawlSourceProvider
from support_sources import NOW, FakeObservations, source


@pytest.fixture(autouse=True)
def no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    def refuse(*args: object, **kwargs: object) -> None:
        raise AssertionError("no network in corpus tests")

    monkeypatch.setattr(socket, "getaddrinfo", refuse)
    monkeypatch.setattr(socket, "create_connection", refuse)


PARSE_APPROVED = SourceProcessingPolicy(
    policy_version_id="parse-v2-synthetic",
    review_state=PolicyReviewState.APPROVED,
    may_retrieve=True,
    may_parse=True,
    may_summarize=False,
    may_display=True,
    may_aggregate_history=False,
    raw_payload=RawPayloadPolicy.HASH_ONLY,
    snapshot_retention_days=None,
    reviewer="synthetic",
    reviewed_at=NOW,
)
BODY = "<html><body><h1>Synthetic terminal page</h1></body></html>"


def provider_for(
    src: Source, body: str | None = BODY, status: int = 200
) -> FirecrawlSourceProvider:
    def handler(request: httpx.Request) -> httpx.Response:
        data: dict[str, object] = {"metadata": {"statusCode": status}}
        if body is not None:
            data["rawHtml"] = body
        return httpx.Response(200, json={"success": True, "data": data})

    return FirecrawlSourceProvider(
        "k-synthetic", {src.identity.source_id: src}, transport=httpx.MockTransport(handler)
    )


def test_capture_writes_document_and_label_template_and_records_nothing(tmp_path: Path) -> None:
    src = source("page", policy=PARSE_APPROVED, adapter="firecrawl")
    repo = FakeObservations([])
    result = asyncio.run(capture_corpus(src, provider_for(src), [], tmp_path, now=NOW))
    assert result.ok
    capture = result.value
    html = tmp_path / f"{capture.sha256}.html"
    labels = tmp_path / f"{capture.sha256}.labels.yaml"
    assert html.read_text() == BODY
    text = labels.read_text()
    assert f"source_id: {src.identity.source_id}" in text and 'reviewer: ""' in text
    assert "rows: []" in text and "seat_state" in text
    assert repo.items == []  # nothing observed, nothing appended
    # Re-capturing the same page never overwrites a person's labels.
    labels.write_text("reviewer: a person\nrows: []\n")
    again = asyncio.run(capture_corpus(src, provider_for(src), [], tmp_path, now=NOW))
    assert again.ok and labels.read_text() == "reviewer: a person\nrows: []\n"
    assert len(list(tmp_path.glob("*.html"))) == 1


def test_capture_refuses_when_parsing_or_retrieval_is_not_allowed(tmp_path: Path) -> None:
    metadata_only = source(
        "meta", adapter="firecrawl", policy=PARSE_APPROVED.model_copy(update={"may_parse": False})
    )
    assert not metadata_only.policy.allows(ProcessingMode.PARSE)
    result = asyncio.run(capture_corpus(metadata_only, provider_for(metadata_only), [], tmp_path))
    assert not result.ok and result.error.message_key == "source.policy_denies_mode"
    switched = source("sw", policy=PARSE_APPROVED, adapter="firecrawl")
    switch = KillSwitch(
        switch_id=switched.identity.source_id,
        scope=KillSwitchScope.ADAPTER,
        key="firecrawl",
        reason="synthetic",
        engaged_at=NOW,
        released_at=None,
    )
    result = asyncio.run(capture_corpus(switched, provider_for(switched), [switch], tmp_path))
    assert not result.ok and result.error.message_key == "source.kill_switch_engaged"
    assert list(tmp_path.iterdir()) == []


def test_capture_refuses_error_pages_empty_bodies_and_foreign_adapters(tmp_path: Path) -> None:
    src = source("page", policy=PARSE_APPROVED, adapter="firecrawl")
    blocked = asyncio.run(capture_corpus(src, provider_for(src, status=403), [], tmp_path))
    assert not blocked.ok and blocked.error.message_key == "corpus.page_not_ok"
    empty = asyncio.run(capture_corpus(src, provider_for(src, body=""), [], tmp_path))
    assert not empty.ok and empty.error.message_key == "corpus.document_unavailable"
    foreign = src.model_copy(update={"adapter_id": "other-adapter"})
    result = asyncio.run(capture_corpus(foreign, provider_for(src), [], tmp_path))
    assert not result.ok and result.error.message_key == "source_provider.identity_mismatch"
    assert list(tmp_path.iterdir()) == []


def test_capture_directory_is_ignored_by_git() -> None:
    from paxpivot.tooling import ROOT

    ignored = [line.strip() for line in (ROOT / ".gitignore").read_text().splitlines()]
    assert "private-fixtures/" in ignored


def test_capture_without_a_document_is_a_failure(tmp_path: Path) -> None:
    src = source("nobody", policy=PARSE_APPROVED, adapter="firecrawl")
    result = asyncio.run(capture_corpus(src, provider_for(src, body=None), [], tmp_path))
    assert not result.ok and result.error.message_key == "corpus.document_unavailable"
    assert list(tmp_path.iterdir()) == []


def test_reference_terminal_pages_are_now_approved_for_parsing_under_the_gate() -> None:
    assert APPROVED_TERMINAL_PAGE_POLICY.policy_version_id == "terminal-page-parse-v2"
    for src in TERMINAL_PAGE_SOURCES:
        assert src.policy.allows(ProcessingMode.PARSE)
        assert not src.policy.allows(ProcessingMode.STORE_RAW)
        assert src.policy.raw_payload == RawPayloadPolicy.HASH_ONLY
