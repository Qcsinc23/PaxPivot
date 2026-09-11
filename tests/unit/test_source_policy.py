"""SourceProcessingPolicy, kill switches and the single processing gate."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from paxpivot.application.source_gate import authorize_processing, engaged_switch
from paxpivot.domain.source import (
    KillSwitch,
    KillSwitchScope,
    ProcessingMode,
    RawPayloadPolicy,
    RetrievalState,
    SourceProcessingPolicy,
    SourceState,
)
from pydantic import ValidationError
from support_sources import (
    APPROVED,
    NEEDS_REVIEW,
    NOW,
    PAUSED,
    RESTRICTED,
    SOURCE_A,
    T0,
    observation,
    source,
)


def test_unreviewed_policy_allows_metadata_retrieval_only() -> None:
    assert NEEDS_REVIEW.allows(ProcessingMode.RETRIEVE)
    for mode in ProcessingMode:
        if mode != ProcessingMode.RETRIEVE:
            assert not NEEDS_REVIEW.allows(mode), mode
    # Even retrieval needs the explicit flag.
    assert not NEEDS_REVIEW.model_copy(update={"may_retrieve": False}).allows(
        ProcessingMode.RETRIEVE
    )


@pytest.mark.parametrize("policy", [PAUSED, RESTRICTED])
def test_paused_and_restricted_allow_nothing(policy: SourceProcessingPolicy) -> None:
    for mode in ProcessingMode:
        assert not policy.allows(mode), mode


def test_approved_policy_follows_its_flags_and_raw_payload_rule() -> None:
    assert APPROVED.allows(ProcessingMode.RETRIEVE)
    assert APPROVED.allows(ProcessingMode.PARSE)
    assert APPROVED.allows(ProcessingMode.DISPLAY)
    assert not APPROVED.allows(ProcessingMode.SUMMARIZE)
    assert not APPROVED.allows(ProcessingMode.AGGREGATE_HISTORY)
    # HASH_ONLY never permits storing a body, whatever else is approved.
    assert not APPROVED.allows(ProcessingMode.STORE_RAW)
    snapshot = APPROVED.model_copy(
        update={"raw_payload": RawPayloadPolicy.SNAPSHOT, "snapshot_retention_days": 30}
    )
    assert snapshot.allows(ProcessingMode.STORE_RAW)


def test_policy_validation_is_strict() -> None:
    base = NEEDS_REVIEW.model_dump()
    with pytest.raises(ValidationError):  # approval without a reviewer
        SourceProcessingPolicy.model_validate({**base, "review_state": "approved"})
    with pytest.raises(ValidationError):  # snapshot without retention
        SourceProcessingPolicy.model_validate({**base, "raw_payload": "snapshot"})
    with pytest.raises(ValidationError):  # retention without snapshot
        SourceProcessingPolicy.model_validate({**base, "snapshot_retention_days": 7})
    with pytest.raises(ValidationError):  # invented review state
        SourceProcessingPolicy.model_validate({**base, "review_state": "public"})
    with pytest.raises(ValidationError):  # secrets have no field to live in
        SourceProcessingPolicy.model_validate({**base, "api_key": "x"})


def switch(scope: KillSwitchScope, key: str, released: bool = False) -> KillSwitch:
    return KillSwitch(
        switch_id=uuid4(),
        scope=scope,
        key=key,
        reason="synthetic_incident",
        engaged_at=NOW,
        released_at=NOW if released else None,
    )


def test_gate_order_is_switch_then_enabled_then_policy() -> None:
    ok = authorize_processing(SOURCE_A, ProcessingMode.PARSE, [])
    assert ok.ok and ok.value.policy_version_id == APPROVED.policy_version_id

    by_source = switch(KillSwitchScope.SOURCE, str(SOURCE_A.identity.source_id))
    by_adapter = switch(KillSwitchScope.ADAPTER, "synthetic-adapter")
    by_mode = switch(KillSwitchScope.MODE, "parse")
    for engaged in (by_source, by_adapter, by_mode):
        denied = authorize_processing(SOURCE_A, ProcessingMode.PARSE, [engaged])
        assert not denied.ok and denied.error.message_key == "source.kill_switch_engaged"
        assert denied.error.code == "forbidden"
    # A released switch is history, not a block; a mode switch only covers its mode.
    assert authorize_processing(
        SOURCE_A,
        ProcessingMode.PARSE,
        [switch(KillSwitchScope.SOURCE, str(SOURCE_A.identity.source_id), released=True)],
    ).ok
    assert authorize_processing(SOURCE_A, ProcessingMode.RETRIEVE, [by_mode]).ok
    assert engaged_switch(SOURCE_A, ProcessingMode.RETRIEVE, [by_mode]) is None

    disabled = authorize_processing(source("x", enabled=False), ProcessingMode.RETRIEVE, [])
    assert not disabled.ok and disabled.error.message_key == "source.disabled"

    unreviewed = authorize_processing(source("y", policy=NEEDS_REVIEW), ProcessingMode.PARSE, [])
    assert not unreviewed.ok and unreviewed.error.message_key == "source.not_approved"
    assert authorize_processing(source("y", policy=NEEDS_REVIEW), ProcessingMode.RETRIEVE, []).ok

    flagged = authorize_processing(SOURCE_A, ProcessingMode.SUMMARIZE, [])
    assert not flagged.ok and flagged.error.message_key == "source.policy_denies_mode"

    paused = authorize_processing(source("z", policy=PAUSED), ProcessingMode.RETRIEVE, [])
    assert not paused.ok and paused.error.message_key == "source.not_approved"


def test_adapter_switch_does_not_cover_a_source_without_adapter() -> None:
    plain = source("plain", adapter=None)
    assert (
        engaged_switch(
            plain, ProcessingMode.RETRIEVE, [switch(KillSwitchScope.ADAPTER, "synthetic-adapter")]
        )
        is None
    )


def test_observation_payload_and_supersession_rules() -> None:
    fresh = observation(SOURCE_A, "p", state=SourceState.FRESH, observed_at=T0)
    with_ref = fresh.model_copy(update={"payload_ref": "blob://synthetic"})
    assert with_ref.payload_ref == "blob://synthetic"
    failed = observation(
        SOURCE_A,
        "q",
        state=SourceState.UNREACHABLE,
        observed_at=T0,
        retrieval=RetrievalState.FAILED,
    )
    with pytest.raises(ValidationError):
        failed.model_validate({**failed.model_dump(), "payload_ref": "blob://synthetic"})
    with pytest.raises(ValidationError):
        fresh.model_validate(
            {**fresh.model_dump(), "supersedes_observation_id": fresh.observation_id}
        )
    # Existing observations without the new fields still validate (defaults are None).
    assert fresh.payload_ref is None and fresh.supersedes_observation_id is None


def test_source_registry_holds_no_secret_fields() -> None:
    data = SOURCE_A.model_dump()
    for key in ["api_key", "token", "credential", "cookie", "password"]:
        with pytest.raises(ValidationError):
            SOURCE_A.model_validate({**data, key: "x"})
    assert SOURCE_A.updated_at >= SOURCE_A.created_at
    assert datetime.now(UTC) > SOURCE_A.created_at
