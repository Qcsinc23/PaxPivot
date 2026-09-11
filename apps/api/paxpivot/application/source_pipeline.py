"""Where a retrieval provider attaches to the persistence pipeline (ADR-004).

    SourceProcessingPolicy + kill switches  →  authorize_processing(RETRIEVE)
                                            →  SourceProvider.observe (Firecrawl or another adapter)
                                            →  validation against the registry, policy and switches
                                            →  SourceObservationRepository.append (immutable)

A provider result is retrieval evidence, never product truth: it must name the registered
source and policy version, may not carry a payload reference the policy forbids, may not claim
interpretation the policy did not approve, and may not carry a credentialed URL. A violation is
rejected (nothing is stored) and reported with a static message key so the caller can raise an
incident. A retrieval failure is a normal observation and is stored as such.

Every mode whose *effect* this pipeline commits — retrieval, parsing, raw storage — is
authorised through ``authorize_processing``, so a kill switch scoped to a source, an adapter or
a mode cannot be bypassed by engaging it after retrieval.
"""

from collections.abc import Sequence

from paxpivot.application.ports.repositories import SourceObservationRepository
from paxpivot.application.ports.source_provider import SourceProvider
from paxpivot.application.result import ApplicationError, Failure, Result, Success
from paxpivot.application.source_gate import authorize_processing, engaged_switch
from paxpivot.domain.source import (
    ExtractionState,
    KillSwitch,
    ProcessingMode,
    RawPayloadPolicy,
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


def _mode_denial(
    source: Source,
    mode: ProcessingMode,
    switches: Sequence[KillSwitch],
    policy_message_key: str,
) -> Failure | None:
    """The gate's answer for one mode, reported as a switch or as a policy denial."""
    if authorize_processing(source, mode, switches).ok:
        return None
    if engaged_switch(source, mode, switches) is not None:
        return _reject("forbidden", "source.kill_switch_engaged")
    return _reject("forbidden", policy_message_key)


def validate_against_policy(
    source: Source,
    observation: SourceObservation,
    switches: Sequence[KillSwitch],
) -> Failure | None:
    if observation.provenance.source.source_id != source.identity.source_id:
        return _reject("invalid_input", "source.observation_identity_mismatch")
    if observation.provenance.policy_version_id != source.policy.policy_version_id:
        return _reject("invalid_input", "source.observation_policy_mismatch")
    # A source's identity is a page, never a credentialed URL. Query strings and fragments are
    # where access tokens and session ids live, and these URLs are persisted and then shown to
    # clients, so nothing carrying one may enter the register or an observation.
    observed_url = observation.provenance.source.url
    if observed_url.query or observed_url.fragment:
        return _reject("forbidden", "source.url_carries_credentials")
    if observation.payload_ref is not None:
        denial = _mode_denial(
            source, ProcessingMode.STORE_RAW, switches, "source.raw_payload_denied"
        )
        if denial is not None:
            return denial
    if observation.extraction in _INTERPRETED:
        denial = _mode_denial(source, ProcessingMode.PARSE, switches, "source.parse_denied")
        if denial is not None:
            return denial
    # `denied` keeps neither the body nor a hash of it (raw_payload definition; ADR-004).
    # An operator who wants change-detection hashing sets `hash_only` for that source.
    if (
        observation.content_hash is not None
        and source.policy.raw_payload == RawPayloadPolicy.DENIED
    ):
        return _reject("forbidden", "source.raw_hash_denied")
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
    rejection = validate_against_policy(source, result.value, switches)
    if rejection is not None:
        return rejection
    observations.append(result.value)
    return Success(value=result.value)
