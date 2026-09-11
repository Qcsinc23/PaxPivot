"""Labeled-corpus capture for source-specific parsers (TASK-031; PRD §9.2, SRC-009).

A parser may only be trusted after its labeled corpus reaches the accuracy gate. This module
captures one page through the registered provider and writes it to a fixture directory in the
repository, next to an empty label template a person completes. It never writes to the
database and refuses a source whose policy does not allow parsing.
"""

import hashlib
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path

from paxpivot.application.result import ApplicationError, Failure, Result, Success
from paxpivot.application.source_gate import authorize_processing
from paxpivot.domain.base import Contract
from paxpivot.domain.source import KillSwitch, ProcessingMode, Source
from paxpivot.infrastructure.providers.firecrawl import FirecrawlSourceProvider

LABEL_TEMPLATE = """# Human-completed labels for {name} ({sha}.html), captured {captured_at}.
# Every departure row shown on the page, in page order. Leave `rows: []` if the page shows none.
# Critical fields (SRC-009): date, time, destination, seat_state. Copy the page's own wording.
source_id: {source_id}
captured_at: {captured_at}
page_status: {page_status}
reviewer: ""          # your name; required before TASK-032 may use this file
rows: []
# - date: "2026-09-12"
#   time: "0600"
#   destination: "Example destination as printed"
#   seat_state: "Seats: 10T"
#   roll_call: "0400"
#   notes: ""
"""


class CorpusCapture(Contract):
    source_id: str
    page_status: int
    sha256: str
    document_path: str
    labels_path: str


async def capture_corpus(
    source: Source,
    provider: FirecrawlSourceProvider,
    switches: Sequence[KillSwitch],
    directory: Path,
    *,
    now: datetime | None = None,
) -> Result[CorpusCapture]:
    """Fetch one page and write `<sha>.html` + `<sha>.labels.yaml`; records nothing."""
    for mode in (ProcessingMode.RETRIEVE, ProcessingMode.PARSE):
        authorization = authorize_processing(source, mode, switches)
        if not authorization.ok:
            return authorization
    fetched = await provider.fetch_document(source.identity)
    if not fetched.ok:
        return fetched
    page_status, document = fetched.value
    if document is None:
        return Failure(
            error=ApplicationError(
                code="unavailable", message_key="corpus.document_unavailable", retryable=True
            )
        )
    sha = hashlib.sha256(document.encode("utf-8", "surrogatepass")).hexdigest()
    directory.mkdir(parents=True, exist_ok=True)
    document_path = directory / f"{sha}.html"
    labels_path = directory / f"{sha}.labels.yaml"
    document_path.write_text(document, encoding="utf-8", errors="surrogatepass")
    if not labels_path.exists():  # never overwrite a person's labels
        labels_path.write_text(
            LABEL_TEMPLATE.format(
                name=source.name,
                sha=sha,
                captured_at=(now or datetime.now(UTC)).isoformat(),
                source_id=source.identity.source_id,
                page_status=page_status,
            )
        )
    return Success(
        value=CorpusCapture(
            source_id=str(source.identity.source_id),
            page_status=page_status,
            sha256=sha,
            document_path=str(document_path),
            labels_path=str(labels_path),
        )
    )
