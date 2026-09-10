from typing import Protocol

from paxpivot.application.result import Result
from paxpivot.domain.source import SourceIdentity, SourceObservation


class SourceProvider(Protocol):
    """Metadata-only port. Caller must enforce source policy before retrieval.

    Expected source failures return a SourceObservation with explicit failure state.
    Application/configuration failures return Failure. Never return raw artifacts.
    No implementation or source is enabled by this scaffold.
    """

    async def observe(self, source: SourceIdentity) -> Result[SourceObservation]: ...
