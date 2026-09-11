"""Where a retrieval provider attaches to the persistence pipeline (ADR-004).

    SourceProcessingPolicy + kill switches  →  authorize_processing(RETRIEVE)
                                            →  SourceProvider.observe (Firecrawl or another adapter)
                                            →  validation against the registry and policy
                                            →  SourceObservationRepository.append (immutable)

A provider result is retrieval evidence, never product truth: it must name the registered
source and policy version, may not carry a payload reference the policy forbids, and may not
claim interpretation the policy did not approve. A violation is rejected (nothing is stored)
and reported with a static message key so the caller can raise an incident. A retrieval
failure is a normal observation and is stored as such.
"""

from collections.abc import Sequence

from paxpivot.application.ports.repositories import SourceObservationRepository
from paxpivot.application.ports.source_provider import SourceProvider
from paxpivot.application.result import ApplicationError, Failure, Result, Success
from paxpivot.application.source_gate import authorize_processing
from paxpivot.domain.source import (
    ExtractionState,
    KillSwitch,
    ProcessingMode,
    Source,
    SourceObservation,
)

_INTERPRETED = {ExtractionState.EXACT, ExtractionState.REVIEWED}


def _reject(code: str, message_key: str) -> Failure:
    return Failure(
        error=ApplicationError(
            code="forbidden" if code == "forbidden" else "invalid_input",
            message_key=message_key,
            retryable=False,
        )
    )


def validate_against_policy(source: Source, observation: SourceObservation) -> Failure | None:
    if observation.provenance.source.source_id != source.identity.source_id:
        return _reject("invalid_input", "source.observation_identity_mismatch")
    if observation.provenance.policy_version_id != source.policy.policy_version_id:
        return _reject("invalid_input", "source.observation_policy_mismatch")
    if observation.payload_ref is not None and not source.policy.allows(ProcessingMode.STORE_RAW):
        return _reject("forbidden", "source.raw_payload_denied")
    if observation.extraction in _INTERPRETED and not source.policy.allows(ProcessingMode.PARSE):
        return _reject("forbidden", "source.parse_denied")
    return None


async def record_observation(
    source: Source,
    provider: SourceProvider,
    observations: SourceObservationRepository,
    switches: Sequence[KillSwitch],
) -> Result[SourceObservation]:
    authorization = authorize_processing(source, ProcessingMode.RETRIEVE, switches)
    if not authorization.ok:
        return authorization
    result = await provider.observe(source.identity)
    if not result.ok:
        return result
    rejection = validate_against_policy(source, result.value)
    if rejection is not None:
        return rejection
    observations.append(result.value)
    return Success(value=result.value)
