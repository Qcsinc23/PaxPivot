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
    assert sent["maxAge"] == 0  # never a cached page recorded as observed now
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


def test_transport_error_to_firecrawl_records_nothing_about_the_source() -> None:
    result = observe(SOURCE_A, transport(raise_exc=True))
    assert not result.ok
    assert result.error.message_key == "source_provider.firecrawl_unreachable"
    assert result.error.retryable is True


def test_missing_raw_html_under_hash_only_says_so_and_a_surrogate_does_not_abort() -> None:
    no_body = observe(SOURCE_A, transport(page_status=200, body=None))
    assert no_body.ok and no_body.value.state == SourceState.FRESH
    assert no_body.value.content_hash is None
    assert "content_hash_unavailable" in no_body.value.confidence_reasons
    # A lone surrogate escape, as Firecrawl's JSON can carry; httpx decodes it to a str the
    # utf-8 codec refuses without surrogatepass.
    raw = b'{"success":true,"data":{"rawHtml":"<p>x\\ud800</p>","metadata":{"statusCode":200}}}'

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=raw, headers={"content-type": "application/json"})

    surrogate = observe(SOURCE_A, httpx.MockTransport(handler))
    assert surrogate.ok and surrogate.value.content_hash is not None


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


# ---- TASK-037: schedule artifacts are discovered on the terminal page, then fetched as text.

FOLDER = "https://example.invalid/Portals/12/Terminal%20A/"
PAGE = (
    '<a href="https://example.invalid/Portals/12/Terminal%20A/AMC%20Gram.pdf">gram</a>'
    '<a href="https://example.invalid/Portals/12/Terminal%20A/72HR%20SEP11.pdf?ver=x">72</a>'
    '<a href="https://example.invalid/Portals/12/Terminal%20A/7DAY.pdf">7</a>'
)


def artifact_pair(page_html: str = PAGE) -> tuple[Source, Source, httpx.MockTransport]:
    from paxpivot.domain.source import SourceKind

    page = source("page-a", terminal="a")
    artifact = source("artifact-a", kind=SourceKind.SCHEDULE_ARTIFACT, terminal="a").model_copy(
        update={"identity": source("artifact-a").identity.model_copy(update={"url": FOLDER})}
    )
    seen: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        seen.append(body)
        if body["url"] == str(page.identity.url):
            return httpx.Response(
                200,
                json={
                    "success": True,
                    "data": {"metadata": {"statusCode": 200}, "rawHtml": page_html},
                },
            )
        assert body["formats"] == ["markdown"]
        return httpx.Response(
            200,
            json={
                "success": True,
                "data": {
                    "metadata": {"statusCode": 200},
                    "markdown": "| 12 SEP | 0600 | RAMSTEIN | 10T |",
                },
            },
        )

    t = httpx.MockTransport(handler)
    t.seen = seen  # type: ignore[attr-defined]
    return page, artifact, t


def test_discover_artifact_picks_the_first_72_hour_link_under_the_folder() -> None:
    from paxpivot.infrastructure.providers.firecrawl import discover_artifact

    assert discover_artifact(PAGE, FOLDER) == FOLDER + "72HR%20SEP11.pdf?ver=x"
    assert discover_artifact('<a href="https://other.invalid/72HR.pdf">', FOLDER) is None
    assert discover_artifact(PAGE.replace("72HR", "30DAY"), FOLDER) is None


def test_artifact_observation_fetches_the_page_then_the_discovered_pdf_as_markdown() -> None:
    page, artifact, t = artifact_pair()
    p = FirecrawlSourceProvider(
        "synthetic-key",
        {page.identity.source_id: page, artifact.identity.source_id: artifact},
        transport=t,
        clock=lambda: NOW,
    )
    result = asyncio.run(p.observe(artifact.identity))
    assert result.ok and result.value.state == SourceState.FRESH
    assert result.value.content_hash and result.value.provenance.source.url == artifact.identity.url
    assert [b["url"] for b in t.seen] == [str(page.identity.url), FOLDER + "72HR%20SEP11.pdf?ver=x"]  # type: ignore[attr-defined]
    fetched = asyncio.run(p.fetch_document(artifact.identity))
    assert fetched.ok and fetched.value == (200, "| 12 SEP | 0600 | RAMSTEIN | 10T |")


def test_artifact_without_a_link_or_parent_is_a_failure_not_an_observation() -> None:
    page, artifact, t = artifact_pair(page_html="<html>no schedule links</html>")
    both = {page.identity.source_id: page, artifact.identity.source_id: artifact}
    unlinked = asyncio.run(
        FirecrawlSourceProvider("k", both, transport=t).observe(artifact.identity)
    )
    assert not unlinked.ok and unlinked.error.message_key == "source_provider.artifact_not_linked"
    orphan = asyncio.run(
        FirecrawlSourceProvider("k", {artifact.identity.source_id: artifact}, transport=t).observe(
            artifact.identity
        )
    )
    assert not orphan.ok and orphan.error.message_key == "source_provider.artifact_parent_missing"
