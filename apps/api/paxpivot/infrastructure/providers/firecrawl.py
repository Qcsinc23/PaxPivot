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
* any other page status → ``source_unreachable``;
* Firecrawl itself failing or refusing (unreachable from this host, bad key, credits, rate
  limit, malformed answer) → ``Failure`` — nothing is recorded, because the official page was
  never observed; an outage on our side must not become evidence about the source.
"""

import hashlib
import html as html_module
import os
import re
from collections.abc import Callable, Mapping, Sequence
from datetime import UTC, datetime
from typing import Any, Literal
from urllib.parse import unquote, urljoin
from uuid import UUID, uuid4

import httpx

from paxpivot.application.result import ApplicationError, Failure, Result, Success
from paxpivot.application.source_gate import authorize_processing
from paxpivot.domain.source import (
    ExtractionState,
    KillSwitch,
    ProcessingMode,
    Provenance,
    RawPayloadPolicy,
    RetrievalState,
    Source,
    SourceIdentity,
    SourceKind,
    SourceObservation,
    SourceState,
)

PROVIDER_ID = "firecrawl"
API_URL = "https://api.firecrawl.dev/v1/scrape"
REQUEST_TIMEOUT_SECONDS = 60.0
# TASK-037: the current 72-hour artifact is a dated file under the terminal's document folder,
# linked from the terminal page. Discovery is a prefix match plus this filename pattern.
ARTIFACT_FILENAME = re.compile(r"72\s*-?\s*(hr|hour)", re.IGNORECASE)
HREF = re.compile(r"""href=["']([^"']+)["']""", re.IGNORECASE)


def discover_artifact(page_html: str, folder: str, *, page_url: str = "") -> str | None:
    """First link on the page under `folder` whose filename names the 72-hour schedule.

    Relative links resolve against the page; the folder match is on the resolved URL, so no
    other host or folder can be chosen. A filename with a path separator (encoded or not) is
    refused rather than resolved.
    """
    for raw in HREF.findall(page_html):
        href: str = urljoin(page_url, html_module.unescape(raw))
        if not href.lower().startswith(folder.lower()):
            continue
        filename = unquote(href[len(folder) :].split("?", 1)[0])
        if "/" in filename or ".." in filename or "\\" in filename:
            continue
        if ARTIFACT_FILENAME.search(filename):
            return href
    return None


def _failure(
    code: Literal["unauthorized", "unavailable", "invalid_input"], message_key: str, retryable: bool
) -> Failure:
    return Failure(error=ApplicationError(code=code, message_key=message_key, retryable=retryable))


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
        switches: Sequence[KillSwitch] = (),
    ) -> None:
        if not api_key:
            raise ValueError("Firecrawl API key must not be empty")
        self._api_key = api_key
        self._sources = sources
        self._transport = transport
        self._clock = clock
        # Engaged kill switches: an artifact's parent page is fetched only under the same
        # authorization the page itself would need (review state and switches).
        self._switches = tuple(switches)
        # One provider instance per run: a terminal page discovered from is fetched once.
        self._page_cache: dict[str, Result[tuple[int, Any]]] = {}

    @classmethod
    def from_env(
        cls,
        sources: Mapping[UUID, Source],
        env: Mapping[str, str] = os.environ,
        *,
        switches: Sequence[KillSwitch] = (),
    ) -> "FirecrawlSourceProvider | None":
        key = env.get("FIRECRAWL_API_KEY")
        return cls(key, sources, switches=switches) if key else None

    async def fetch_document(self, source: SourceIdentity) -> Result[tuple[int, str | None]]:
        """Page status and raw document for the labeled-corpus capture (TASK-031) only.

        Not used by ``observe``; the corpus command writes the document to a reviewed fixture
        file in the repository, never to the database.
        """
        registered = self._sources.get(source.source_id)
        if registered is None or registered.identity != source:
            return _failure("invalid_input", "source_provider.unknown_source", False)
        fetched = await self._fetch_registered(registered)
        if not fetched.ok:
            return fetched
        page_status, document = fetched.value
        return Success(value=(page_status, document if isinstance(document, str) else None))

    async def observe(self, source: SourceIdentity) -> Result[SourceObservation]:
        registered = self._sources.get(source.source_id)
        if registered is None or registered.identity != source:
            return _failure("invalid_input", "source_provider.unknown_source", False)
        observed_at = self._clock()
        fetched = await self._fetch_registered(registered)
        if not fetched.ok:
            return fetched
        page_status, document = fetched.value
        digest = None
        hash_wanted = registered.policy.raw_payload != RawPayloadPolicy.DENIED
        if hash_wanted and isinstance(document, str):
            # surrogatepass: a stray surrogate in the page must not abort the run.
            digest = hashlib.sha256(document.encode("utf-8", "surrogatepass")).hexdigest()
        # The body is only ever hashed above; nothing below reads document.
        extra = "content_hash_unavailable" if hash_wanted and digest is None else None
        return Success(value=self._observation(registered, observed_at, page_status, digest, extra))

    async def _fetch_registered(self, source: Source) -> Result[tuple[int, Any]]:
        """A terminal page is fetched as HTML; a schedule artifact is discovered on its terminal
        page first, then fetched as text (Firecrawl renders the PDF to markdown)."""
        if source.kind != SourceKind.SCHEDULE_ARTIFACT:
            return await self._fetch(str(source.identity.url), "rawHtml")
        parent = next(
            (
                s
                for s in self._sources.values()
                if s.kind == SourceKind.TERMINAL_PAGE
                and s.terminal_id == source.terminal_id
                and authorize_processing(s, ProcessingMode.RETRIEVE, self._switches).ok
            ),
            None,
        )
        if parent is None:
            return _failure("invalid_input", "source_provider.artifact_parent_missing", False)
        page_url = str(parent.identity.url)
        if page_url not in self._page_cache:
            self._page_cache[page_url] = await self._fetch(page_url, "rawHtml")
        page = self._page_cache[page_url]
        if not page.ok:
            return page
        page_status, page_html = page.value
        if not (200 <= page_status < 300 and isinstance(page_html, str)):
            # The terminal page itself did not answer; that is its observation, not this one's.
            return _failure("unavailable", "source_provider.artifact_parent_unreachable", True)
        href = discover_artifact(page_html, str(source.identity.url), page_url=page_url)
        if href is None:
            return _failure("unavailable", "source_provider.artifact_not_linked", True)
        return await self._fetch(href, "markdown")

    async def _fetch(self, url: str, fmt: str) -> Result[tuple[int, Any]]:
        try:
            async with httpx.AsyncClient(
                transport=self._transport, timeout=REQUEST_TIMEOUT_SECONDS
            ) as client:
                response = await client.post(
                    API_URL,
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    json={
                        "url": url,
                        "formats": [fmt],
                        "onlyMainContent": False,
                        "maxAge": 0,
                    },
                )
        except httpx.HTTPError:
            # Our side could not reach Firecrawl: nothing about the source was observed.
            return _failure("unavailable", "source_provider.firecrawl_unreachable", True)
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
            document = data.get(fmt)
            if isinstance(document, str) and not document.strip():
                document = None  # An unrenderable PDF or empty page has no content to hash.
        except (ValueError, KeyError, TypeError):
            return _failure("unavailable", "source_provider.firecrawl_malformed", True)
        return Success(value=(page_status, document))

    @staticmethod
    def _observation(
        source: Source,
        observed_at: datetime,
        page_status: int,
        digest: str | None,
        extra_reason: str | None,
    ) -> SourceObservation:
        if 200 <= page_status < 300:
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
            reasons = (f"http_{page_status}",)
        if extra_reason:
            reasons = (*reasons, extra_reason)
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
