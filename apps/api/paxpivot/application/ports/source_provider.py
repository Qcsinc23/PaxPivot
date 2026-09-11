from typing import Protocol

from paxpivot.application.result import Result
from paxpivot.domain.source import SourceIdentity, SourceObservation


class SourceProvider(Protocol):
    """Metadata-only port. Caller must enforce source policy before retrieval.

    Expected source failures return a SourceObservation with explicit failure state.
    Application/configuration failures return Failure. Never return raw artifacts.
    No implementation or source is enabled by this scaffold.

    ``provider_id`` is the adapter's own identity, and it must equal the ``adapter_id`` the
    registry records for a source before that adapter may observe it. Without a declared
    identity the pipeline cannot tell which adapter produced a result, so an ADAPTER-scope
    kill switch would key on a value the caller never had to honour, and one adapter could
    answer for a source configured against another. Implementations must therefore set it;
    ``record_observation`` refuses a provider whose identity does not match the registry.
    """

    provider_id: str

    async def observe(self, source: SourceIdentity) -> Result[SourceObservation]: ...
