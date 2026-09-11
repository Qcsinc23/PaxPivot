"""Firecrawl-backed ``SourceProvider`` (TASK-025): retrieval metadata only.

Firecrawl fetches the official page through its own browsers (the pilot host's own egress is
refused by the site's edge). What comes back is reduced, in this process, to retrieval
metadata: the HTTP status the page answered with and, when the source policy keeps a hash, a
SHA-256 of the returned document. The document itself is discarded before the observation is
built and never leaves this function. No login, no bypass, no parsing: the observation's
``extraction`` is always ``not_attempted`` and its ``state`` is never an absence claim.

Outcome mapping (PRD §9.5: retrieval failure is preserved, never "no departures"):

* page status 2xx → ``fresh`` (metadata only), retrieval succeeded;
* 404 / 410 → ``source_missing``, retrieval failed;
* 401 / 403 → ``source_unreachable`` with reason ``http_forbidden`` (an edge refusal is not
  evidence that the source is user-open-only);
* any other status, a transport error or a timeout → ``source_unreachable``;
* Firecrawl itself refusing (bad key, credits, rate limit) → ``Failure`` — nothing is recorded,
  because nothing was observed.
"""

import hashlib
import os
from collections.abc import Callable, Mapping
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

import httpx

from paxpivot.application.result import ApplicationError, Failure, Result, Success
from paxpivot.domain.source import (
    ExtractionState,
    Provenance,
    RawPayloadPolicy,
    RetrievalState,
    Source,
    SourceIdentity,
    SourceObservation,
    SourceState,
)

PROVIDER_ID = "firecrawl"
API_URL = "https://api.firecrawl.dev/v1/scrape"
REQUEST_TIMEOUT_SECONDS = 60.0


def _failure(code: str, message_key: str, retryable: bool) -> Failure:
    return Failure(
        error=ApplicationError(code=code, message_key=message_key, retryable=retryable)  # type: ignore[arg-type]
    )


class FirecrawlSourceProvider:
    """One provider instance per run, bound to the registered sources it may observe."""

    provider_id = PROVIDER_ID

    def __init__(
        self,
        api_key: str,
        sources: Mapping[UUID, Source],
        *,
        transport: httpx.AsyncBaseTransport | None = None,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        if not api_key:
            raise ValueError("Firecrawl API key must not be empty")
        self._api_key = api_key
        self._sources = sources
        self._transport = transport
        self._clock = clock

    @classmethod
    def from_env(
        cls, sources: Mapping[UUID, Source], env: Mapping[str, str] = os.environ
    ) -> "FirecrawlSourceProvider | None":
        key = env.get("FIRECRAWL_API_KEY")
        return cls(key, sources) if key else None

    async def observe(self, source: SourceIdentity) -> Result[SourceObservation]:
        registered = self._sources.get(source.source_id)
        if registered is None or registered.identity != source:
            return _failure("invalid_input", "source_provider.unknown_source", False)
        observed_at = self._clock()
        try:
            async with httpx.AsyncClient(
                transport=self._transport, timeout=REQUEST_TIMEOUT_SECONDS
            ) as client:
                response = await client.post(
                    API_URL,
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    json={
                        "url": str(source.url),
                        "formats": ["rawHtml"],
                        "onlyMainContent": False,
                        "maxAge": 0,
                    },
                )
        except httpx.HTTPError:
            return Success(
                value=self._observation(registered, observed_at, None, None, "transport_error")
            )
        if response.status_code == 401:
            return _failure("unauthorized", "source_provider.firecrawl_unauthorized", False)
        if response.status_code in {402, 429}:
            return _failure("unavailable", "source_provider.firecrawl_budget", True)
        if response.status_code >= 500:
            return _failure("unavailable", "source_provider.firecrawl_unavailable", True)
        if response.status_code != 200:
            return _failure("unavailable", "source_provider.firecrawl_rejected", False)
        try:
            payload: Any = response.json()
            data = payload["data"]
            page_status = int(data["metadata"]["statusCode"])
            document = data.get("rawHtml")
        except (ValueError, KeyError, TypeError):
            return _failure("unavailable", "source_provider.firecrawl_malformed", True)
        digest = None
        if isinstance(document, str) and registered.policy.raw_payload != RawPayloadPolicy.DENIED:
            digest = hashlib.sha256(document.encode("utf-8")).hexdigest()
        del document  # The body is never retained past this point.
        return Success(value=self._observation(registered, observed_at, page_status, digest, None))

    @staticmethod
    def _observation(
        source: Source,
        observed_at: datetime,
        page_status: int | None,
        digest: str | None,
        error: str | None,
    ) -> SourceObservation:
        if page_status is not None and 200 <= page_status < 300:
            state, retrieval = SourceState.FRESH, RetrievalState.SUCCEEDED
            reasons: tuple[str, ...] = ("metadata_only", f"http_{page_status}")
        elif page_status in {404, 410}:
            state, retrieval = SourceState.MISSING, RetrievalState.FAILED
            reasons = (f"http_{page_status}",)
        elif page_status in {401, 403}:
            state, retrieval = SourceState.UNREACHABLE, RetrievalState.FAILED
            reasons = ("http_forbidden", f"http_{page_status}")
        else:
            state, retrieval = SourceState.UNREACHABLE, RetrievalState.FAILED
            reasons = (error or f"http_{page_status}",)
        return SourceObservation(
            observation_id=uuid4(),
            provenance=Provenance(
                source=source.identity,
                observed_at=observed_at,
                source_time=None,  # Firecrawl reports no page time; unknown stays unknown.
                provider_id=PROVIDER_ID,
                policy_version_id=source.policy.policy_version_id,
            ),
            state=state,
            retrieval=retrieval,
            extraction=ExtractionState.NOT_ATTEMPTED,
            parser_version=None,
            content_hash=digest if retrieval == RetrievalState.SUCCEEDED else None,
            confidence_reasons=reasons,
        )
