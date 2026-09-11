"""The single gate every processing step passes before touching a source.

Order of checks is fixed and auditable: kill switches (source, adapter, mode), then the
source's enabled flag, then the source-processing policy. No provider, parser or job may
call retrieval, parsing, storage, display or aggregation code without a
``ProcessingAuthorization`` from here. Failures carry static message keys only.
"""

from collections.abc import Sequence
from uuid import UUID

from paxpivot.application.result import ApplicationError, Failure, Result, Success
from paxpivot.domain.base import Contract, Identifier
from paxpivot.domain.source import (
    KillSwitch,
    KillSwitchScope,
    PolicyReviewState,
    ProcessingMode,
    Source,
)


class ProcessingAuthorization(Contract):
    source_id: UUID
    mode: ProcessingMode
    policy_version_id: Identifier


def _forbidden(message_key: str) -> Failure:
    return Failure(
        error=ApplicationError(code="forbidden", message_key=message_key, retryable=False)
    )


def engaged_switch(
    source: Source, mode: ProcessingMode, switches: Sequence[KillSwitch]
) -> KillSwitch | None:
    """The first engaged switch that covers this source, its adapter or this mode."""
    for switch in switches:
        if not switch.engaged:
            continue
        if switch.scope == KillSwitchScope.SOURCE and switch.key == str(source.identity.source_id):
            return switch
        if (
            switch.scope == KillSwitchScope.ADAPTER
            and source.adapter_id is not None
            and switch.key == source.adapter_id
        ):
            return switch
        if switch.scope == KillSwitchScope.MODE and switch.key == mode.value:
            return switch
    return None


def authorize_processing(
    source: Source, mode: ProcessingMode, switches: Sequence[KillSwitch]
) -> Result[ProcessingAuthorization]:
    if engaged_switch(source, mode, switches) is not None:
        return _forbidden("source.kill_switch_engaged")
    if not source.enabled:
        return _forbidden("source.disabled")
    if source.policy.allows(mode):
        return Success(
            value=ProcessingAuthorization(
                source_id=source.identity.source_id,
                mode=mode,
                policy_version_id=source.policy.policy_version_id,
            )
        )
    if source.policy.review_state != PolicyReviewState.APPROVED:
        return _forbidden("source.not_approved")
    return _forbidden("source.policy_denies_mode")
