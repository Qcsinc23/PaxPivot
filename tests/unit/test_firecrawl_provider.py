"""TASK-025: the Firecrawl provider records retrieval metadata only, offline."""

import asyncio
import json
import socket
from datetime import UTC, datetime
from uuid import uuid4

import httpx
import pytest
from paxpivot.application.source_pipeline import record_observation
from paxpivot.domain.source import (
    ExtractionState,
    PolicyReviewState,
    RawPayloadPolicy,
    RetrievalState,
    Source,
    SourceState,
)
from paxpivot.infrastructure.providers.firecrawl import API_URL, FirecrawlSourceProvider
from support_sources import APPROVED, NOW, SOURCE_A, FakeObservations, source

BODY = "<html><body>Synthetic page</body></html>"


@pytest.fixture(autouse=True)
def no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    def refuse(*args: object, **kwargs: object) -> None:
        raise AssertionError("provider tests must not perform network I/O")

    monkeypatch.setattr(socket, "getaddrinfo", refuse)
    monkeypatch.setattr(socket, "create_connection", refuse)


def transport(
    *,
    api_status: int = 200,
    page_status: int = 200,
    body: str | None = BODY,
    raise_exc: bool = False,
) -> httpx.MockTransport:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if raise_exc:
            raise httpx.ConnectTimeout("synthetic timeout")
        if api_status != 200:
            return httpx.Response(api_status, json={"success": False, "error": "synthetic"})
        data: dict[str, object] = {"metadata": {"statusCode": page_status}}
        if body is not None:
            data["rawHtml"] = body
        return httpx.Response(200, json={"success": True, "data": data})

    t = httpx.MockTransport(handler)
    t.seen = seen  # type: ignore[attr-defined]
    return t


def provider(src: Source, t: httpx.MockTransport) -> FirecrawlSourceProvider:
    return FirecrawlSourceProvider(
        "synthetic-key", {src.identity.source_id: src}, transport=t, clock=lambda: NOW
    )


def observe(src: Source, t: httpx.MockTransport):  # type: ignore[no-untyped-def]
    return asyncio.run(provider(src, t).observe(src.identity))


def test_reachable_page_is_fresh_metadata_with_a_hash_and_no_body() -> None:
    t = transport()
    result = observe(SOURCE_A, t)
    assert result.ok
    obs = result.value
    assert obs.state == SourceState.FRESH and obs.retrieval == RetrievalState.SUCCEEDED
    assert obs.extraction == ExtractionState.NOT_ATTEMPTED and obs.parser_version is None
    assert obs.content_hash and len(obs.content_hash) == 64
    assert obs.payload_ref is None and obs.provenance.source_time is None
    assert obs.provenance.provider_id == "firecrawl"
    assert obs.provenance.policy_version_id == APPROVED.policy_version_id
    assert obs.provenance.observed_at == NOW
    assert "metadata_only" in obs.confidence_reasons
    dumped = obs.model_dump_json()
    assert "Synthetic page" not in dumped and "rawHtml" not in dumped
    request = t.seen[0]  # type: ignore[attr-defined]
    assert str(request.url) == API_URL
    assert request.headers["Authorization"] == "Bearer synthetic-key"
    sent = json.loads(request.content)
    assert sent["url"] == str(SOURCE_A.identity.url) and sent["formats"] == ["rawHtml"]
    # The pipeline accepts it for an approved hash_only source registered against this adapter.
    registered = source("fc", adapter="firecrawl")
    repo = FakeObservations([])
    accepted = asyncio.run(
        record_observation(registered, provider(registered, transport()), repo, [])
    )
    assert accepted.ok and len(repo.items) == 1


def test_denied_raw_payload_policy_yields_no_hash() -> None:
    denied = source(
        "denied",
        policy=APPROVED.model_copy(update={"raw_payload": RawPayloadPolicy.DENIED}),
    )
    result = observe(denied, transport())
    assert result.ok and result.value.content_hash is None


@pytest.mark.parametrize(
    ("page_status", "state", "reason"),
    [
        (404, SourceState.MISSING, "http_404"),
        (410, SourceState.MISSING, "http_410"),
        (403, SourceState.UNREACHABLE, "http_forbidden"),
        (401, SourceState.UNREACHABLE, "http_forbidden"),
        (503, SourceState.UNREACHABLE, "http_503"),
    ],
)
def test_page_failures_are_failure_states_never_absence_or_restricted(
    page_status: int, state: SourceState, reason: str
) -> None:
    result = observe(SOURCE_A, transport(page_status=page_status, body=None))
    assert result.ok
    obs = result.value
    assert obs.state == state and obs.retrieval == RetrievalState.FAILED
    assert obs.content_hash is None and reason in obs.confidence_reasons
    assert obs.state not in {SourceState.NO_DEPARTURES, SourceState.RESTRICTED}


def test_transport_error_is_an_unreachable_observation() -> None:
    result = observe(SOURCE_A, transport(raise_exc=True))
    assert result.ok and result.value.state == SourceState.UNREACHABLE
    assert "transport_error" in result.value.confidence_reasons


@pytest.mark.parametrize(
    ("api_status", "code", "key", "retryable"),
    [
        (401, "unauthorized", "source_provider.firecrawl_unauthorized", False),
        (402, "unavailable", "source_provider.firecrawl_budget", True),
        (429, "unavailable", "source_provider.firecrawl_budget", True),
        (500, "unavailable", "source_provider.firecrawl_unavailable", True),
        (400, "unavailable", "source_provider.firecrawl_rejected", False),
    ],
)
def test_firecrawl_refusals_are_failures_that_record_nothing(
    api_status: int, code: str, key: str, retryable: bool
) -> None:
    result = observe(SOURCE_A, transport(api_status=api_status))
    assert not result.ok
    assert result.error.code == code and result.error.message_key == key
    assert result.error.retryable is retryable


def test_unknown_or_mismatched_source_is_refused_before_any_request() -> None:
    t = transport()
    stranger = source("stranger")
    result = asyncio.run(provider(SOURCE_A, t).observe(stranger.identity))
    assert not result.ok and result.error.message_key == "source_provider.unknown_source"
    assert t.seen == []  # type: ignore[attr-defined]


def test_from_env_requires_a_key_and_the_key_never_appears_in_observations() -> None:
    assert FirecrawlSourceProvider.from_env({}, env={}) is None
    p = FirecrawlSourceProvider.from_env({}, env={"FIRECRAWL_API_KEY": "k-synthetic"})
    assert p is not None and p.provider_id == "firecrawl"
    with pytest.raises(ValueError):
        FirecrawlSourceProvider("", {})
    result = observe(SOURCE_A, transport())
    assert result.ok
    obs = result.value
    assert "synthetic-key" not in obs.model_dump_json()
    assert datetime.now(UTC) > NOW and uuid4() != obs.observation_id
    assert PolicyReviewState.APPROVED == SOURCE_A.policy.review_state
