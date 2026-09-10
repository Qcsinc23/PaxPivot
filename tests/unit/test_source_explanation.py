import re
from datetime import UTC, datetime
from uuid import UUID

import pytest
from paxpivot.application.source_explanation import explain_source
from paxpivot.domain.source import (
    ExtractionState,
    Provenance,
    RetrievalState,
    SourceIdentity,
    SourceObservation,
    SourceState,
)
from pydantic import HttpUrl

SOURCE_ID = UUID("11111111-1111-4111-8111-111111111111")
SOURCE_URL = HttpUrl("https://example.invalid/source?window=1100")
OBSERVATION_ID = UUID("22222222-2222-4222-8222-222222222222")
OBSERVED_AT = datetime(2026, 1, 1, 0, 0, tzinfo=UTC)
SOURCE_TIME = datetime(2026, 1, 1, 6, 0, tzinfo=UTC)

# Exact approved wording per state, reviewed so every sentence preserves uncertainty.
EXPECTED_EXPLANATIONS = {
    SourceState.FRESH: (
        "A fresh source observation exists for this source; it is metadata, not a confirmed "
        "flight and not confirmed seat availability, and it still requires official verification."
    ),
    SourceState.STALE: (
        "The available observation for this source is stale: it is no longer current and must "
        "not be read as current availability."
    ),
    SourceState.UNREACHABLE: (
        "The source could not currently be reached, so this check obtained no observation. "
        "That is missing data, not evidence that there are no departures."
    ),
    SourceState.CHANGED_UNPARSED: (
        "The source changed and its current contents cannot safely be interpreted, so nothing "
        "here states whether departures exist."
    ),
    SourceState.MISSING: (
        "The source itself could not be found or is unavailable, so its published contents are "
        "unknown; this is not evidence that there are no departures."
    ),
    SourceState.CONFLICT: (
        "Available source evidence conflicts, so no single current reading is established by "
        "this observation."
    ),
    SourceState.MONITOR_DELAYED: (
        "The scheduled source check was delayed, so no current observation is available and "
        "current availability cannot be reported."
    ),
    SourceState.NO_DEPARTURES: (
        "This specific source explicitly published no departures in the observation evaluated; "
        "that applies to this source only and is not a generalization or a verified flight "
        "guarantee."
    ),
    SourceState.NO_COMPATIBLE: (
        "For the request evaluated, the evidence did not support a compatible opportunity; the "
        "reason is not established here and is not an eligibility, seat or no-departure finding."
    ),
    SourceState.RESTRICTED: (
        "This source is restricted and may only be reviewed by the user opening it directly; no "
        "current availability is established here."
    ),
    SourceState.REVIEW_REQUIRED: (
        "An observation for this source is awaiting human parser review, so no current "
        "availability is established here."
    ),
    SourceState.SUPERSEDED: (
        "This observation is superseded and is not presented as current availability."
    ),
    SourceState.WITHDRAWN: (
        "This source withdrew the observation, so it is no longer current and does not indicate "
        "current availability."
    ),
}

POSITIVE_EVIDENCE_STATES = {
    SourceState.FRESH,
    SourceState.NO_DEPARTURES,
    SourceState.NO_COMPATIBLE,
}
SUCCESSFUL_RETRIEVAL_STATES = POSITIVE_EVIDENCE_STATES | {
    SourceState.STALE,
    SourceState.CONFLICT,
    SourceState.REVIEW_REQUIRED,
}
ABSENCE_STATES = {SourceState.NO_DEPARTURES, SourceState.NO_COMPATIBLE}

# Tokens that let a reader recover the exact condition from the wording.
REQUIRED_TOKENS = {
    SourceState.FRESH: (
        "fresh source observation",
        "official verification",
        "not a confirmed flight",
    ),
    SourceState.STALE: ("stale", "no longer current"),
    SourceState.UNREACHABLE: (
        "could not currently be reached",
        "not evidence that there are no departures",
    ),
    SourceState.CHANGED_UNPARSED: ("cannot safely be interpreted",),
    SourceState.MISSING: (
        "could not be found",
        "not evidence that there are no departures",
    ),
    SourceState.CONFLICT: ("conflicts",),
    SourceState.MONITOR_DELAYED: ("delayed", "no current observation is available"),
    SourceState.NO_DEPARTURES: (
        "this specific source",
        "published no departures",
        "that applies to this source only",
    ),
    SourceState.NO_COMPATIBLE: ("did not support a compatible opportunity",),
    SourceState.RESTRICTED: ("restricted", "opening it directly"),
    SourceState.REVIEW_REQUIRED: ("human parser review",),
    SourceState.SUPERSEDED: ("superseded", "not presented as current availability"),
    SourceState.WITHDRAWN: ("withdrew", "no longer current"),
}

# Claims the helper must never make. These are assertions of fact, not negations of one.
FORBIDDEN_CLAIMS = (
    r"confirmed (?:flight|seat|availability)",
    r"seats? (?:are )?available",
    r"seat availability is (?:confirmed|known)",
    r"(?:we found|the (?:search|engine) (?:found|shows?)|it indicates?|it confirms?) no "
    r"(?:flights?|departures?)",
    r"no (?:flights?|departures?) (?:exist|are available)",
    r"guaranteed",
    r"probab(?:le|ility)",
    r"likely",
    r"reliab(?:le|ility)",
    r"ineligible",
    r"not eligible",
    r"you qualif(?:y|ies)",
)
NEGATION = re.compile(r"\b(?:not|no|never|nothing|neither|nor)\b", re.IGNORECASE)


def source_identity() -> SourceIdentity:
    return SourceIdentity(
        source_id=SOURCE_ID,
        url=SOURCE_URL,
        authority="synthetic-authority",
    )


def provenance(*, source_time: datetime | None = SOURCE_TIME) -> Provenance:
    return Provenance(
        source=source_identity(),
        observed_at=OBSERVED_AT,
        source_time=source_time,
        provider_id="synthetic-provider",
        policy_version_id="synthetic-not-approved-v1",
    )


def observation_for(state: SourceState) -> SourceObservation:
    """Build a synthetic observation that satisfies the domain evidence rules for its state."""
    retrieval = (
        RetrievalState.SUCCEEDED if state in SUCCESSFUL_RETRIEVAL_STATES else RetrievalState.FAILED
    )
    extraction = ExtractionState.EXACT if state in ABSENCE_STATES else ExtractionState.NOT_ATTEMPTED
    interpreted = extraction in {ExtractionState.EXACT, ExtractionState.REVIEWED}
    return SourceObservation(
        observation_id=OBSERVATION_ID,
        provenance=provenance(source_time=None if state is SourceState.STALE else SOURCE_TIME),
        state=state,
        retrieval=retrieval,
        extraction=extraction,
        parser_version="synthetic-parser-v1" if interpreted else None,
        content_hash="sha256-synthetic" if interpreted else None,
        confidence_reasons=("synthetic_evidence_limit",),
    )


def test_explanation_covers_every_current_state() -> None:
    assert set(EXPECTED_EXPLANATIONS) == set(SourceState)
    assert set(REQUIRED_TOKENS) == set(SourceState)


@pytest.mark.parametrize("state", list(SourceState))
def test_explanation_is_exactly_the_approved_uncertainty_wording(state: SourceState) -> None:
    assert explain_source(observation_for(state)) == EXPECTED_EXPLANATIONS[state]


@pytest.mark.parametrize("state", list(SourceState))
def test_explanation_never_infers_availability_or_probabilities(state: SourceState) -> None:
    explanation = explain_source(observation_for(state))
    for pattern in FORBIDDEN_CLAIMS:
        for match in re.finditer(pattern, explanation, re.IGNORECASE):
            prefix = explanation[max(0, match.start() - 12) : match.start()]
            assert NEGATION.search(prefix), f"unsupported claim {match.group(0)!r} in {state.value}"


@pytest.mark.parametrize("state", list(SourceState))
def test_explanation_recovers_the_exact_condition(state: SourceState) -> None:
    explanation = explain_source(observation_for(state)).lower()
    for token in REQUIRED_TOKENS[state]:
        assert token.lower() in explanation, f"{state.value} explanation lost {token!r}"


@pytest.mark.parametrize("state", list(SourceState))
def test_explanation_discloses_no_source_or_observation_payload(state: SourceState) -> None:
    observation = observation_for(state)
    explanation = explain_source(observation)
    for value in (
        str(observation.observation_id),
        str(observation.provenance.source.url),
        observation.provenance.source.source_id.hex,
        str(observation.provenance.policy_version_id),
        str(observation.provenance.provider_id),
        "https",
        "://",
        "example.invalid",
        "?window=",
    ):
        assert value not in explanation


@pytest.mark.parametrize("state", list(SourceState))
def test_explanation_is_deterministic_and_pure(state: SourceState) -> None:
    observation = observation_for(state)
    first = explain_source(observation)
    second = explain_source(observation)
    assert first == second
    assert observation == observation_for(state)


@pytest.mark.parametrize(
    "state",
    [
        SourceState.UNREACHABLE,
        SourceState.MISSING,
        SourceState.CHANGED_UNPARSED,
        SourceState.CONFLICT,
        SourceState.MONITOR_DELAYED,
    ],
)
def test_failure_states_preserve_uncertainty(state: SourceState) -> None:
    explanation = explain_source(observation_for(state)).lower()
    assert "not evidence that there are no departures" in explanation or (
        "nothing here states whether departures exist" in explanation
        or "no single current reading" in explanation
        or "cannot be reported" in explanation
    )


def test_absence_wording_stays_source_specific() -> None:
    explanation = explain_source(observation_for(SourceState.NO_DEPARTURES)).lower()
    assert "this specific source" in explanation
    assert "that applies to this source only" in explanation
    assert "not a generalization" in explanation
    for generalization in ("all sources", "every source", "any source", "system-wide"):
        assert generalization not in explanation


def test_compatibility_wording_states_no_unestablished_reason() -> None:
    explanation = explain_source(observation_for(SourceState.NO_COMPATIBLE))
    for inferred_reason in ("policy", "ineligible", "not eligible"):
        assert inferred_reason not in explanation


def test_restricted_review_superseded_and_withdrawn_states_suppress_availability() -> None:
    for state in (
        SourceState.RESTRICTED,
        SourceState.REVIEW_REQUIRED,
        SourceState.SUPERSEDED,
        SourceState.WITHDRAWN,
    ):
        explanation = explain_source(observation_for(state))
        suppressed = (
            "not presented as current availability" in explanation
            or "no current availability is established here" in explanation
            or "does not indicate current availability" in explanation
        )
        assert suppressed, state.value


def test_review_required_requests_official_review() -> None:
    explanation = explain_source(observation_for(SourceState.REVIEW_REQUIRED))
    assert "human parser review" in explanation


def test_fresh_never_claims_a_flight_or_guarantee() -> None:
    explanation = explain_source(observation_for(SourceState.FRESH))
    assert "not a confirmed flight" in explanation
    assert "official verification" in explanation


def test_explanation_ignores_unknown_source_time() -> None:
    known = observation_for(SourceState.FRESH)
    unknown = known.model_copy(update={"provenance": provenance(source_time=None)})
    assert unknown.provenance.source_time is None
    assert explain_source(unknown) == explain_source(known)
